// netlify/functions/talemetry.js
//
// Employer-agnostic proxy for Talemetry / CSNS ("Career Site Next-gen
// Search") career sites — the platform behind HCA Healthcare and other
// large employers whose careers page ships a `window.csns.paths` block.
//
// These sites self-document a clean JSON search endpoint:
//
//     GET https://{host}/search/jobs.json?keyword=...&page=N
//
// (the path comes from window.csns.paths.search_jobs_json = "/search/jobs.json").
// It returns structured JSON — NO auth, NO key, NO cookie required:
//
//     { current_page, per_page, total_entries,
//       entries: [ { id, permalink, title,
//                    location:{ locality, region_abbr, region_full,
//                               postal_code, country, ... } }, ... ] }
//
// One function serves EVERY Talemetry employer — the host, company label,
// and sector are passed in as query params, so adding a new employer is a
// one-line client roster entry, not new code here (same design as workday.js).
//
// WHY THIS IS A LIVE PER-SEARCH SOURCE (not a roster fetch-all):
//   HCA alone is ~16,700 postings. We never pull the whole board. The user's
//   keyword is passed straight to the endpoint (server-side search), so each
//   query returns a small, focused set. We page a few times within budget and
//   stop. Like Phenom, this is queried live on every search.
//
// FIELD NOTES:
//   * location is STRUCTURED (locality + region_abbr + region_full + country)
//     — cleaner than Workday's free text. We build "City, ST" for display,
//     which means US-filtering and city search both work naturally. No
//     facility-name problem.
//   * job URL = {host}/jobs/{permalink}  (permalink is the SEO slug; the
//     numeric id also resolves at /jobs/{id}, but permalink links are cleaner).
//   * per_page defaults to 25 and is honored up to ~100 — we ask for 100 to
//     cover more ground per call inside the time budget.
//   * total_entries drifts by 1 between pages as postings open/close; that's
//     normal, we only use it to know when to stop paging.
//
// Returns [] safe on any failure so it can never break search.

const MAX_PAGES  = 3;    // 3 x 100 = up to 300 focused roles per search
const PAGE_SIZE  = 100;  // Talemetry honors per_page up to ~100
const TIME_BUDGET_MS = 9000;

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36';

exports.handler = async function (event) {
  const qs = event.queryStringParameters || {};
  const keyword = (qs.keyword || '').trim();
  const host    = (qs.host    || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const company = (qs.company || 'Employer').trim();
  const sector  = (qs.sector  || '').trim();
  const diag    = qs.diag === '1';

  if (!host) {
    return json(400, { ok: false, error: 'missing host', jobs: [] });
  }

  const base     = `https://${host}`;
  const endpoint = `${base}/search/jobs.json`;
  const started  = Date.now();

  const errors = [];
  let all = [];
  let total = null;
  let loggedShape = false;

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (Date.now() - started > TIME_BUDGET_MS) break;

      const url = `${endpoint}?keyword=${encodeURIComponent(keyword)}` +
                  `&page=${page}&per_page=${PAGE_SIZE}`;

      let resp;
      try {
        resp = await fetch(url, {
          method: 'GET',
          headers: {
            // Talemetry/CSNS returns JSON to XHR requests. The careers page
            // calls jobs.json via fetch with X-Requested-With, so we mirror a
            // real in-page XHR as closely as possible — this is what gets a
            // datacenter request past the WAF that a bare curl-like GET trips.
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': BROWSER_UA,
            'Referer': `${base}/search/jobs`,
            'Origin': base,
            'X-Requested-With': 'XMLHttpRequest',
            'sec-ch-ua': '"Chromium";v="120", "Not(A:Brand";v="24", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin'
          }
        });
      } catch (e) {
        errors.push(`page ${page}: fetch ${String(e && e.message)}`);
        break;
      }

      if (!resp.ok) {
        let snippet = '';
        try { snippet = (await resp.text()).slice(0, 200); } catch (e) {}
        console.log(`[talemetry:${host}] upstream ${resp.status} body: ${snippet}`);
        errors.push(`page ${page}: upstream ${resp.status}`);
        if (page === 1) {
          return json(200, {
            ok: false, error: `talemetry upstream ${resp.status}`,
            host, jobs: [], ...(diag ? { errors } : {})
          });
        }
        break;
      }

      let data;
      try { data = await resp.json(); }
      catch (e) { errors.push(`page ${page}: bad json`); break; }

      const entries = Array.isArray(data.entries) ? data.entries : [];
      if (total == null && typeof data.total_entries === 'number') {
        total = data.total_entries;
      }

      if (!loggedShape && entries.length) {
        console.log(`[talemetry:${host}] first entry: ` +
          JSON.stringify(entries[0]).slice(0, 400));
        loggedShape = true;
      }

      if (!entries.length) break;

      all = all.concat(
        entries.map(e => mapEntry(e, base, company, sector)).filter(Boolean)
      );

      const perPage = Number(data.per_page) || PAGE_SIZE;
      if (entries.length < perPage) break;                 // last page
      if (total != null && page * perPage >= total) break; // covered all
    }

    // De-dupe by url.
    const seen = new Set();
    const jobs = all.filter(j => {
      if (seen.has(j.url)) return false;
      seen.add(j.url);
      return true;
    });

    return json(200, {
      ok: true, count: jobs.length, total, jobs,
      ...(diag ? { host, pagesTried: MAX_PAGES, errors } : {})
    });
  } catch (e) {
    console.error(`[talemetry:${host}] error`, e && e.message);
    return json(200, { ok: false, error: String(e && e.message), jobs: [] });
  }
};

// ---- helpers ----------------------------------------------------------

function mapEntry(e, base, company, sector) {
  if (!e || typeof e !== 'object') return null;

  const permalink = e.permalink || e.id;
  if (!permalink) return null;
  const url = `${base}/jobs/${permalink}`;

  const title = e.title || 'Untitled role';

  // Structured location -> "City, ST" (falls back gracefully).
  const loc = e.location || {};
  let location = '';
  const city = (loc.locality || '').trim();
  const st   = (loc.region_abbr || loc.region_full || '').trim();
  if (city && st) location = `${city}, ${st}`;
  else if (city)  location = city;
  else if (st)    location = st;
  else if (loc.country) location = String(loc.country);
  else location = '—';

  return {
    title: String(title),
    company: company,
    board: company,
    sector: sector || '',
    location: String(location),
    url: url,
    posted: null,     // list carries no reliable posted date
    salary: '',
    source: 'talemetry',
    id: String(e.id || permalink),
    ats: 'talemetry'
  };
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300'
    },
    body: JSON.stringify(obj)
  };
}
