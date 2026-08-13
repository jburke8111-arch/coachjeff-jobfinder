// netlify/functions/themuse.js
//
// The Muse public jobs API — https://www.themuse.com/api/public/jobs
// Broad early-career source, same role as Adzuna: one endpoint returns roles
// from hundreds of employers, no per-company slug discovery.
//
// The Muse does NOT support a freetext keyword search. It filters by:
//   category (fixed list), level (Entry Level / Internship / ...), location,
//   company, page (required, 0-indexed, 20 results/page), descending.
// So we map the user's keyword to Muse categories server-side, sweep the
// "Entry Level" and "Internship" levels across those categories in parallel,
// then keyword-AND filter the titles here before returning. The client applies
// its own scoring/senior gate on top, exactly as it does for Adzuna.
//
// THEMUSE_API_KEY (optional): a free registered key raises the rate limit from
// 500 to 3600 requests/hour. Passed as the api_key query param when present.
// Everything works without it for testing.

const API_BASE = 'https://www.themuse.com/api/public/jobs';
const API_KEY = process.env.THEMUSE_API_KEY || '';

// Overall server-side time budget. Netlify's default function timeout is 10s;
// stay well under so a slow Muse response can't make the whole search hang.
const TIME_BUDGET_MS = 7000;
const PER_FETCH_TIMEOUT_MS = 4000;

// Levels we care about for a new-grad tool. Mid/Senior/management are excluded
// at the source so we never waste our page budget pulling roles the client
// would only throw away.
const LEVELS = ['Entry Level', 'Internship'];

// Pages to pull per (category, level) combo. 20 results/page. Two pages = up to
// 40 roles per combo before client filtering. Kept small so a broad multi-
// category query stays within the time budget.
const PAGES_PER_COMBO = 2;

// ---- Keyword -> Muse category mapping ------------------------------------
// The Muse's fixed category list (from the v2 docs). We map the user's search
// words to one or more of these. A search that matches no category falls back
// to a small default set of the broadest early-career categories rather than
// sweeping all ~30 (which would blow the time budget).
const MUSE_CATEGORIES = [
  'Accounting', 'Accounting and Finance', 'Account Management',
  'Account Management/Customer Success', 'Administration and Office',
  'Advertising and Marketing', 'Animal Care', 'Arts', 'Business Operations',
  'Cleaning and Facilities', 'Computer and IT', 'Construction', 'Corporate',
  'Customer Service', 'Data and Analytics', 'Data Science', 'Design',
  'Design and UX', 'Editor', 'Education', 'Energy Generation and Mining',
  'Entertainment and Travel Services', 'Farming and Outdoors',
  'Food and Hospitality Services', 'Healthcare', 'HR',
  'Human Resources and Recruitment', 'Installation, Maintenance, and Repairs',
  'IT', 'Law', 'Legal Services', 'Management', 'Manufacturing and Warehouse',
  'Marketing', 'Mechanic', 'Media, PR, and Communications', 'Mental Health',
  'Nurses', 'Office Administration', 'Personal Care and Services',
  'Physical Assistant', 'Product', 'Product Management', 'Project Management',
  'Protective Services', 'Public Relations', 'Real Estate', 'Recruiting',
  'Retail', 'Sales', 'Science and Engineering', 'Social Services',
  'Software Engineer', 'Software Engineering',
  'Sports, Fitness, and Recreation', 'Transportation and Logistics',
  'UX', 'Videography', 'Writer', 'Writing and Editing'
];

// Map from a search token to the Muse categories it should pull. Keys are
// lowercase substrings tested against the user's keyword. Deliberately generous
// so common role searches land on the right buckets.
const KEYWORD_TO_CATEGORIES = [
  [['software','developer','engineer','programming','full stack','frontend','front end','backend','back end','web dev'],
    ['Software Engineering','Software Engineer','Computer and IT']],
  [['data','analyst','analytics','machine learning','ml','ai ','scientist'],
    ['Data and Analytics','Data Science']],
  [['it ','information technology','sysadmin','network','help desk','helpdesk','support engineer','cyber','security'],
    ['Computer and IT','IT']],
  [['market','seo','brand','content','social media','growth'],
    ['Marketing','Advertising and Marketing']],
  [['sales','account exec','business development','bdr','sdr'],
    ['Sales','Account Management']],
  [['account manager','customer success','client'],
    ['Account Management','Account Management/Customer Success']],
  [['customer service','customer support','call center','service rep'],
    ['Customer Service']],
  [['design','ux','ui','graphic','product design'],
    ['Design','Design and UX','UX']],
  [['product manager','product management','product owner'],
    ['Product','Product Management']],
  [['project','program manager','program coordinator','pmo'],
    ['Project Management']],
  [['hr','human resource','people ops','talent','recruit'],
    ['Human Resources and Recruitment','HR','Recruiting']],
  [['finance','financial','accounting','accountant','auditor','bookkeep'],
    ['Accounting and Finance','Accounting']],
  [['nurse','rn ','clinical','healthcare','medical','patient'],
    ['Healthcare','Nurses']],
  [['mental health','therapist','counselor','social work','case manager'],
    ['Mental Health','Social Services']],
  [['legal','law','paralegal','attorney','compliance'],
    ['Legal Services','Law']],
  [['teacher','education','instructor','tutor','curriculum'],
    ['Education']],
  [['writer','editor','journalis','copywrit','communications','pr '],
    ['Writing and Editing','Writer','Editor','Media, PR, and Communications','Public Relations']],
  [['operations','business operations','logistics','supply chain','warehouse'],
    ['Business Operations','Transportation and Logistics','Manufacturing and Warehouse']],
  [['admin','office','executive assistant','receptionist','coordinator'],
    ['Administration and Office','Office Administration']],
  [['retail','store','merchandis','cashier'],
    ['Retail']],
  [['engineer','mechanical','electrical','civil','chemical','industrial'],
    ['Science and Engineering']],
  [['real estate','property','leasing'],
    ['Real Estate']],
  [['hospitality','hotel','restaurant','food service','culinary'],
    ['Food and Hospitality Services','Entertainment and Travel Services']],
];

// Broadest early-career buckets, used when the keyword maps to nothing.
const DEFAULT_CATEGORIES = [
  'Business Operations', 'Administration and Office', 'Customer Service',
  'Sales', 'Marketing', 'Data and Analytics'
];

function categoriesForKeyword(keyword){
  const kw = ' ' + String(keyword || '').toLowerCase().trim() + ' ';
  if(kw.trim().length === 0) return DEFAULT_CATEGORIES.slice();
  const hits = new Set();
  for(const [tokens, cats] of KEYWORD_TO_CATEGORIES){
    if(tokens.some(t => kw.includes(t))){
      cats.forEach(c => hits.add(c));
    }
  }
  if(hits.size === 0) return DEFAULT_CATEGORIES.slice();
  // Cap the category fan-out so the total combo count (cats x levels x pages)
  // stays inside the time budget. 4 categories x 2 levels x 2 pages = 16 fetches.
  return Array.from(hits).slice(0, 4);
}

// ---- Fetch helpers --------------------------------------------------------
function withTimeout(promise, ms){
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

function buildUrl(category, level, page){
  const p = new URLSearchParams();
  p.set('category', category);
  p.set('level', level);
  p.set('page', String(page));
  p.set('descending', 'true'); // newest-ish first
  if(API_KEY) p.set('api_key', API_KEY);
  return API_BASE + '?' + p.toString();
}

// Muse location strings look like "New York, NY" or "Flexible / Remote".
// Keep US + remote, drop obviously-foreign ones, mirroring how the client
// treats Adzuna. This is a light server-side pre-filter; the client does the
// authoritative location handling.
const US_STATE_RX = /,\s*[A-Z]{2}\b/;
function isUsOrRemote(locName){
  if(!locName) return true; // let the client decide
  const l = locName.toLowerCase();
  if(l.includes('remote') || l.includes('flexible')) return true;
  if(US_STATE_RX.test(locName)) return true;
  if(l.includes('united states') || l.includes(', us')) return true;
  return false;
}

// Strip Muse's HTML-ish contents field down to nothing we rely on; the client
// scores on title. We only keep a short plain-text blurb for display parity.
function plainSnippet(html){
  if(!html) return '';
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

// token-AND keyword match against the title, matching the greenhouse/ashby
// server-side filter behavior so results are relevant before they ever reach
// the client.
function titleMatches(title, keyword){
  if(!keyword) return true;
  const t = String(title || '').toLowerCase();
  const tokens = String(keyword).toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every(tok => t.includes(tok));
}

function normalize(job, level){
  const company = (job.company && job.company.name) || 'Employer';
  const locs = Array.isArray(job.locations)
    ? job.locations.map(l => l.name).filter(Boolean)
    : [];
  const location = locs.length ? locs.join('; ') : '—';
  const url = (job.refs && job.refs.landing_page) || '';
  return {
    title: job.name || 'Untitled role',
    company,
    board: company,
    sector: (Array.isArray(job.categories) && job.categories[0] && job.categories[0].name) || '',
    location,
    url,
    posted: job.publication_date || null,
    salary: '',
    source: 'themuse',
    id: (job.id != null ? ('muse-' + job.id) : ('muse-' + url)),
    ats: 'muse',
    museLevel: level
  };
}

exports.handler = async function(event){
  const started = Date.now();
  const qs = (event && event.queryStringParameters) || {};
  const keyword = qs.keyword || '';
  const location = qs.location || '';
  const diag = qs.diag === '1';

  const categories = categoriesForKeyword(keyword);

  // Build the full combo list: category x level x page.
  const combos = [];
  for(const category of categories){
    for(const level of LEVELS){
      for(let page = 0; page < PAGES_PER_COMBO; page++){
        combos.push({ category, level, page });
      }
    }
  }

  const diagInfo = { categories, combos: combos.length, fetched: 0, errors: 0, rawJobs: 0 };

  async function fetchCombo({ category, level, page }){
    const remaining = TIME_BUDGET_MS - (Date.now() - started);
    if(remaining <= 200) return [];
    try {
      const resp = await withTimeout(
        fetch(buildUrl(category, level, page), {
          headers: { 'Accept': 'application/json' }
        }),
        Math.min(PER_FETCH_TIMEOUT_MS, remaining)
      );
      diagInfo.fetched++;
      if(!resp.ok) return [];
      const data = await resp.json();
      const results = Array.isArray(data.results) ? data.results : [];
      diagInfo.rawJobs += results.length;
      return results.map(j => normalize(j, level));
    } catch(e){
      diagInfo.errors++;
      return [];
    }
  }

  let jobs = [];
  try {
    const batches = await Promise.all(combos.map(fetchCombo));
    jobs = batches.flat();
  } catch(e){
    return json(200, { ok: false, error: 'fetch_failed', jobs: [] });
  }

  // Filter: must have an apply URL, US/remote, and title matches the keyword.
  const seen = new Set();
  const filtered = [];
  for(const j of jobs){
    if(!j.url) continue;
    if(!isUsOrRemote(j.location)) continue;
    if(!titleMatches(j.title, keyword)) continue;
    if(seen.has(j.id)) continue;
    seen.add(j.id);
    filtered.push(j);
  }

  const payload = {
    ok: true,
    jobs: filtered,
    keyed: !!API_KEY,
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
