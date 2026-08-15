// netlify/functions/careeronestop.js
//
// Serverless proxy for the CareerOneStop (U.S. DOL) "List Jobs" Web API (v2),
// which searches the National Labor Exchange (NLx) and recognizes the O*NET
// taxonomy. Keeps the CareerOneStop credentials server-side and returns a clean
// { ok, jobs[] } shape that index.html's fetchCareerOneStop() already expects.
//
// WHY v2: CareerOneStop only supports the v1 Jobs API for accounts enrolled
// BEFORE Aug 27, 2024. Accounts registered after that date (Jeff's was Aug 2026)
// are provisioned for v2 only — calling v1 with a v2 token returns 401
// Unauthorized. That was the original bug. v2 is the same path shape as v1 with
// "/v2/" and two extra query params (description snippet + metadata).
//
// ENV VARS (set in Netlify → Site settings → Environment variables):
//   COS_USERID  — your CareerOneStop API "User ID" (from the confirmation email)
//   COS_TOKEN   — your CareerOneStop API "Token key" (the long Bearer token)
// Register (free) at:
//   https://www.careeronestop.org/Developers/WebAPI/registration.aspx
//
// ATTRIBUTION (required by the COS license): every page that displays this data
// must acknowledge DOLETA and the Minnesota DEED, AND display the CareerOneStop
// logo. index.html's footer note covers the text; add the logo image too.
//
// v2 List Jobs endpoint (path params, all segments must be non-empty):
//   https://api.careeronestop.org/v2/jobsearch/{userId}/{keyword}/{location}
//        /{radius}/{sortColumns}/{sortOrder}/{startRecord}/{pageSize}/{days}
//        ?showFilters={f}&enableJobDescriptionSnippet={s}&enableMetaData={m}
//
// Notes on tuning below:
//   • location defaults to "US" (nationwide) when the client sends none.
//   • radius 0 with a "US" location = nationwide; with a city/state it's miles.
//   • sortColumns "accquisitiondate" / sortOrder "desc" = newest first.
//   • days 30 keeps results fresh, matching the rest of the tool's freshness floor.
//   • pageSize 50 balances coverage vs the 10s Netlify function budget.
//   • enableJobDescriptionSnippet=true so COS rows carry a snippet like the
//     other sources (v2-only capability).

const API_BASE = 'https://api.careeronestop.org/v2/jobsearch';
const TIMEOUT_MS = 8000;

// Broad, generic sectors don't map cleanly from NLx feed data, so we leave
// sector blank and let the client's own keyword/level filters do the work.

function withTimeout(promise, ms){
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('cos-timeout')), ms))
  ]);
}

function seg(v, fallback){
  const s = (v == null ? '' : String(v)).trim();
  return encodeURIComponent(s || fallback);
}

exports.handler = async (event) => {
  const diag = (event.queryStringParameters || {}).diag === '1';
  const userId = process.env.COS_USERID;
  const token  = process.env.COS_TOKEN;

  const fail = (body) => ({
    statusCode: 200, // always 200 so one dead source never breaks the client search
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(Object.assign({ ok: false, jobs: [] }, body || {}))
  });

  if(!userId || !token){
    return fail(diag ? { error: 'missing COS_USERID or COS_TOKEN env var', keyed: false } : {});
  }

  const q   = (event.queryStringParameters || {});
  const kw  = (q.keyword  || '').trim();
  const loc = (q.location || '').trim();

  // v2 requires every path segment; supply sane defaults.
  const keyword     = seg(kw,  'jobs');   // some keyword is required
  const location    = seg(loc, 'US');     // nationwide when the user gave none
  const radius      = seg(q.radius, loc ? '50' : '0'); // miles if a place is set, else nationwide
  const sortColumns = 'accquisitiondate'; // (COS's own spelling of the field)
  const sortOrder   = 'desc';             // newest first
  const startRecord = '0';
  const pageSize    = '50';
  const days        = '30';               // freshness floor, matches the rest of the tool
  const showFilters = 'false';

  // v2 query params: pull a short description snippet (so COS rows read like the
  // other sources) and skip the heavier metadata block we don't use.
  const url = `${API_BASE}/${encodeURIComponent(userId)}/${keyword}/${location}`
    + `/${radius}/${sortColumns}/${sortOrder}/${startRecord}/${pageSize}/${days}`
    + `?showFilters=${showFilters}&enableJobDescriptionSnippet=true&enableMetaData=false`;

  try {
    const resp = await withTimeout(fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json'
      }
    }), TIMEOUT_MS);

    if(!resp.ok){
      const text = diag ? await resp.text().catch(() => '') : '';
      return fail(diag ? { error: 'cos http ' + resp.status, status: resp.status, keyed: true, body: text.slice(0, 300) } : {});
    }

    const data = await resp.json();
    const raw = (data && Array.isArray(data.Jobs)) ? data.Jobs : [];

    const jobs = raw
      .filter(j => j && j.URL)               // drop anything without an apply link
      .map(j => ({
        title:    (j.JobTitle || '').trim() || 'Untitled role',
        company:  (j.Company  || '').trim() || 'Employer',
        board:    'CareerOneStop',
        sector:   '',                        // NLx feed doesn't give a clean sector
        location: (j.Location || '').trim() || '—',
        url:      j.URL,
        posted:   j.AccquisitionDate || j.AcquisitionDate || null, // COS misspells this key
        salary:   '',
        snippet:  (j.DescriptionSnippet || '').trim(), // v2-only; harmless if absent
        id:       j.JvId || null,
        ats:      'cos'
      }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(Object.assign(
        { ok: true, jobs },
        diag ? { keyed: true, rawJobs: raw.length, returned: jobs.length, jobcount: data && data.Jobcount } : {}
      ))
    };
  } catch(e){
    return fail(diag ? { error: String(e && e.message || e), keyed: true } : {});
  }
};
