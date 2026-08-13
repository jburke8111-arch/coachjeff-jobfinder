// netlify/functions/careerjet.js
//
// Careerjet public search API (v4) — https://search.api.careerjet.net/v4/query
// Broad aggregator source, same role as Adzuna: one endpoint, freetext keyword
// + location search across millions of postings from many providers. No per-
// company slug discovery and NO category mapping (unlike The Muse) — Careerjet
// takes the user's keyword directly.
//
// AUTH: v4 uses HTTP Basic auth. Username = your API key, password = empty.
// Get a free key from a Careerjet Publisher account:
//   https://www.careerjet.com/partners/register/as-publisher
// Store it as the CAREERJET_API_KEY env var in Netlify. Rate limit: 1000 req/hr.
// Without the key the API returns 403 and this function returns [] — it never
// breaks the rest of the search, same fail-safe pattern as the other sources.
//
// REQUIRED PARAMS: the API 403s without user_ip and user_agent. Because we call
// server-side, we forward the end-user's IP and UA from the incoming request
// headers, with safe fallbacks.
//
// LINKS: Careerjet job URLs are jobviewtrack.com redirect links, not direct
// employer pages, so records are flagged aggregator:true / aggregatorName:
// 'Careerjet'. The existing card renderer then shows the honest
// "via Careerjet — signup may be required" tag, exactly like Adzuna.

const API_ENDPOINT = 'https://search.api.careerjet.net/v4/query';
const API_KEY = process.env.CAREERJET_API_KEY || '';

const TIME_BUDGET_MS = 7000;
const PER_FETCH_TIMEOUT_MS = 5000;

// Pages to pull (page_size 100 = up to 100 roles/page). Two pages = up to 200
// postings before client scoring/filtering. Kept small to stay in budget.
const PAGE_SIZE = 100;
const PAGES = 2;

// US locale so results are US roles in English. Careerjet's locale code maps to
// its US site.
const LOCALE = 'en_US';

function withTimeout(promise, ms){
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

function basicAuthHeader(){
  // username = API key, password = empty string -> base64("key:")
  const token = Buffer.from(API_KEY + ':').toString('base64');
  return 'Basic ' + token;
}

function buildUrl(keyword, location, page){
  const p = new URLSearchParams();
  if(keyword) p.set('keywords', keyword);
  if(location) p.set('location', location);
  p.set('locale_code', LOCALE);
  p.set('sort', 'date');           // freshest first; client re-scores anyway
  p.set('page', String(page));     // 1..10
  p.set('page_size', String(PAGE_SIZE));
  return API_ENDPOINT + '?' + p.toString();
}

// Careerjet returns a single "locations" string like "New York, NY" or "Remote".
// Keep US + remote, drop obviously-foreign, mirroring the Adzuna/Muse pre-filter.
// The client does the authoritative location handling.
const US_STATE_RX = /,\s*[A-Z]{2}\b/;
const FOREIGN_HINTS = [
  'united kingdom', 'canada', 'australia', 'india', 'ireland', 'germany',
  'france', 'spain', 'netherlands', 'singapore', 'philippines', 'malaysia',
  ', uk', ', on', ', bc', ', qc'
];
function isUsOrRemote(locName){
  if(!locName) return true; // let the client decide
  const l = locName.toLowerCase();
  if(l.includes('remote') || l.includes('anywhere')) return true;
  if(FOREIGN_HINTS.some(h => l.includes(h))) return false;
  if(US_STATE_RX.test(locName)) return true;
  if(l.includes('united states') || l.includes(', us')) return true;
  // Unknown format: keep it and let the client's US filter decide.
  return true;
}

function plainSnippet(text){
  if(!text) return '';
  return String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

// Careerjet salary is a preformatted display string (e.g. "$30000 - 33000") plus
// a salary_type code. Keep the display string as-is; the client already knows
// how to show a salary string.
function salaryDisplay(job){
  return (job && typeof job.salary === 'string') ? job.salary.trim() : '';
}

function normalize(job){
  const url = job.url || '';
  const company = job.company || 'Employer';
  return {
    title: job.title || 'Untitled role',
    company,
    board: company,
    sector: '',
    location: job.locations || '—',
    url,
    posted: job.date || null,
    salary: salaryDisplay(job),
    source: 'careerjet',
    id: 'cj-' + (url || (job.title || '') + '-' + company),
    ats: 'cj',
    // jobviewtrack.com redirect -> flag as aggregator so the card shows the
    // honest "via Careerjet — signup may be required" tag and ranks below
    // direct/ATS links, exactly like Adzuna.
    aggregator: true,
    aggregatorName: 'Careerjet'
  };
}

exports.handler = async function(event){
  const started = Date.now();
  const qs = (event && event.queryStringParameters) || {};
  const keyword = qs.keyword || '';
  const location = qs.location || '';
  const diag = qs.diag === '1';

  // No key -> behave like a source that returned nothing, don't error the search.
  if(!API_KEY){
    const body = { ok: true, jobs: [], keyed: false, note: 'no_api_key' };
    if(diag) body.diag = { reason: 'CAREERJET_API_KEY not set' };
    return json(200, body);
  }

  // Forward the end-user's IP + UA (required by the API). Netlify puts the
  // client IP in x-nf-client-connection-ip; fall back through common headers.
  const headers = (event && event.headers) || {};
  const userIp =
    headers['x-nf-client-connection-ip'] ||
    (headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    headers['client-ip'] ||
    '8.8.8.8'; // last-resort public IP so the API doesn't 403
  const userAgent =
    headers['user-agent'] ||
    'Mozilla/5.0 (compatible; CoachJeffJobFinder/1.0)';

  const authHeader = basicAuthHeader();

  const diagInfo = { pages: PAGES, fetched: 0, errors: 0, rawJobs: 0, hits: null, mode: null };

  async function fetchPage(page){
    const remaining = TIME_BUDGET_MS - (Date.now() - started);
    if(remaining <= 200) return [];
    // user_ip and user_agent are required params AND we send UA as a header too.
    const url = buildUrl(keyword, location, page)
      + '&user_ip=' + encodeURIComponent(userIp)
      + '&user_agent=' + encodeURIComponent(userAgent);
    try {
      const resp = await withTimeout(
        fetch(url, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
            'User-Agent': userAgent
          }
        }),
        Math.min(PER_FETCH_TIMEOUT_MS, remaining)
      );
      diagInfo.fetched++;
      if(!resp.ok) return [];
      const data = await resp.json();
      diagInfo.mode = data.type || null;
      if(data.hits != null) diagInfo.hits = data.hits;
      // "LOCATIONS" mode means the location param was ambiguous/unmatched and no
      // actual job search ran. Treat as empty rather than crashing.
      if(data.type !== 'JOBS' || !Array.isArray(data.jobs)) return [];
      diagInfo.rawJobs += data.jobs.length;
      return data.jobs.map(normalize);
    } catch(e){
      diagInfo.errors++;
      return [];
    }
  }

  let jobs = [];
  try {
    const pages = [];
    for(let p = 1; p <= PAGES; p++) pages.push(p);
    const batches = await Promise.all(pages.map(fetchPage));
    jobs = batches.flat();
  } catch(e){
    return json(200, { ok: false, error: 'fetch_failed', jobs: [] });
  }

  // Filter: must have a URL, US/remote. No keyword re-filter here — Careerjet
  // already matched the keyword server-side (title/content/company), and the
  // client applies its own scoring + senior gate on top.
  const seen = new Set();
  const filtered = [];
  for(const j of jobs){
    if(!j.url) continue;
    if(!isUsOrRemote(j.location)) continue;
    if(seen.has(j.id)) continue;
    seen.add(j.id);
    filtered.push(j);
  }

  const payload = {
    ok: true,
    jobs: filtered,
    keyed: true,
    complete: (Date.now() - started) < TIME_BUDGET_MS
  };
  if(diag){
    diagInfo.returned = filtered.length;
    payload.diag = diagInfo;
  }
  return json(200, payload);
};

function json(status, body){
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=120'
    },
    body: JSON.stringify(body)
  };
}
