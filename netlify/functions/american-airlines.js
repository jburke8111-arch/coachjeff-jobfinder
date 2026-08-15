// netlify/functions/american-airlines.js
//
// Server-side proxy for American Airlines' careers API.
//
// AA runs a SuccessFactors / Jobs2Web back end behind a Phenom-style
// front end. The job list the site shows is loaded client-side via a
// POST to:
//
//     https://jobs.aa.com/services/recruiting/v1/jobs
//
// with a JSON body (confirmed from the live site's Network payload):
//
//     {
//       locale: "en_US",
//       pageNumber: 0,          // ZERO-indexed
//       sortBy: "",
//       keywords: "analyst",    // <-- keyword goes here (plural "keywords")
//       location: "",           // <-- free-text location
//       facetFilters: {},
//       alertId: "", brand: "", categoryId: 0,
//       rcmCandidateId: "", skills: []
//     }
//
// We POST that from the server (so there's no browser CORS problem, same
// pattern as the usajobs / careeronestop functions), normalize the
// response, and hand the client a clean { ok, jobs:[...] } payload.
//
// The AA response field names are NOT yet confirmed from a Preview grab,
// so the mapper below reads from several likely field names for each
// value and falls back gracefully. On the first deploy, check the
// function log: it prints the KEYS of the first raw record once, so you
// can see the real field names and tighten the mapper if needed. Nothing
// breaks in the meantime — unknown fields just fall back to defaults, and
// any record without a usable apply URL is dropped rather than rendered
// as a dead link.

const AA_ENDPOINT = 'https://jobs.aa.com/services/recruiting/v1/jobs';

// How many pages to sweep at most (each page is ~10-20 roles). Kept small
// so a keyword with thousands of hits can't make the function run long.
const MAX_PAGES = 3;

exports.handler = async function (event) {
  const qs = event.queryStringParameters || {};
  const keyword = (qs.keyword || '').trim();
  const location = (qs.location || '').trim();

  try {
    let all = [];
    let loggedShape = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      const body = {
        locale: 'en_US',
        pageNumber: page,          // zero-indexed, matches the live payload
        sortBy: '',
        keywords: keyword,
        location: location,
        facetFilters: {},
        alertId: '',
        brand: '',
        categoryId: 0,
        rcmCandidateId: '',
        skills: []
      };

      const resp = await fetch(AA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // Some SuccessFactors/Jobs2Web tenants reject requests that
          // don't look browser-originated. These headers make the POST
          // resemble the site's own call.
          'Origin': 'https://jobs.aa.com',
          'Referer': 'https://jobs.aa.com/search/',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/120.0 Safari/537.36'
        },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        // First page failing is a real error; a later page failing just
        // ends the sweep with whatever we already gathered.
        if (page === 0) {
          return json(502, {
            ok: false,
            error: 'aa upstream ' + resp.status,
            jobs: []
          });
        }
        break;
      }

      const data = await resp.json();
      const records = extractRecords(data);

      // One-time shape log so you can confirm the real field names from
      // the deploy log, then tighten mapRecord() if you want to.
      if (!loggedShape && records.length) {
        console.log(
          '[aa] first record keys:',
          JSON.stringify(Object.keys(records[0]))
        );
        console.log(
          '[aa] first record sample:',
          JSON.stringify(records[0]).slice(0, 800)
        );
        loggedShape = true;
      }

      if (!records.length) break;

      all = all.concat(records.map(mapRecord).filter(Boolean));

      // If a page returned fewer than a full batch, we've reached the end.
      if (records.length < 10) break;
    }

    // De-dupe by apply URL (pagination overlap safety).
    const seen = new Set();
    const jobs = all.filter(j => {
      if (seen.has(j.url)) return false;
      seen.add(j.url);
      return true;
    });

    return json(200, { ok: true, jobs });
  } catch (e) {
    console.error('[aa] error', e && e.message);
    return json(200, { ok: false, error: String(e && e.message), jobs: [] });
  }
};

// ---- helpers ----------------------------------------------------------

// The record array lives under one of a few possible keys depending on
// how the tenant is configured. Try the common ones; fall back to the
// first array-of-objects we can find on the response.
function extractRecords(data) {
  if (!data || typeof data !== 'object') return [];
  const candidates = [
    data.jobs,
    data.data && data.data.jobs,
    data.results,
    data.hits,
    data.jobList,
    data.requisitionList
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length && typeof c[0] === 'object') return c;
  }
  // Last resort: find the first array of objects anywhere one level deep.
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v;
    if (v && typeof v === 'object') {
      for (const k2 of Object.keys(v)) {
        const v2 = v[k2];
        if (Array.isArray(v2) && v2.length && typeof v2[0] === 'object') return v2;
      }
    }
  }
  return [];
}

// Read the first present, non-empty value among several candidate keys.
function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return '';
}

// Build the public apply URL. AA detail pages are jobs.aa.com/job/{id}/...
// but the record usually carries an explicit apply/detail URL — prefer
// that, and only synthesize from an id/slug if we must.
function buildUrl(rec) {
  const explicit = pick(rec, [
    'applyUrl', 'jobApplyUrl', 'detailUrl', 'jobDetailUrl',
    'url', 'jobUrl', 'canonicalUrl', 'externalPath'
  ]);
  if (explicit) {
    // externalPath is a relative path on some tenants.
    if (/^https?:\/\//i.test(explicit)) return explicit;
    return 'https://jobs.aa.com' + (explicit.startsWith('/') ? '' : '/') + explicit;
  }
  const id = pick(rec, ['jobId', 'id', 'reqId', 'requisitionId', 'jobSeqNo']);
  const slug = pick(rec, ['jobSlug', 'slug', 'titleSlug']);
  if (id) {
    return 'https://jobs.aa.com/job/' + encodeURIComponent(id) +
      (slug ? '/' + encodeURIComponent(slug) : '');
  }
  return '';
}

function mapRecord(rec) {
  if (!rec || typeof rec !== 'object') return null;

  const url = buildUrl(rec);
  if (!url) return null; // no apply link -> drop, never render a dead card

  const title = pick(rec, [
    'title', 'jobTitle', 'name', 'unifiedStandardTitle', 'displayJobTitle'
  ]) || 'Untitled role';

  // Location can be a string or an object; handle both.
  let location = pick(rec, [
    'location', 'jobLocation', 'primaryLocation', 'cityStateCountry',
    'formattedLocation', 'locationsText'
  ]);
  if (location && typeof location === 'object') {
    location =
      [location.city, location.state, location.country]
        .filter(Boolean)
        .join(', ') || '—';
  }
  if (!location) location = '—';

  const posted = pick(rec, [
    'postedDate', 'postedOn', 'datePosted', 'createDate',
    'referencedate', 'lastModified'
  ]) || null;

  const id = pick(rec, [
    'jobId', 'id', 'reqId', 'requisitionId', 'jobSeqNo'
  ]) || ('aa-' + url);

  return {
    title: String(title),
    company: 'American Airlines',
    board: 'American Airlines',
    sector: 'industrial',        // matches your COMPANIES tag for AA
    location: String(location),
    url: url,
    posted: posted,
    salary: '',
    source: 'american-airlines',
    id: String(id),
    ats: 'aa'
  };
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // 5-min edge cache
    },
    body: JSON.stringify(obj)
  };
}
