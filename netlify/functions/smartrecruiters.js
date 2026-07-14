// netlify/functions/smartrecruiters.js
//
// SmartRecruiters public Posting API fetcher for Grad Job Finder.
// Matches the same output contract as ashby.js / greenhouse.js:
//   returns  { ok: true, jobs: [ ... ] }
// and each job carries: title, company, board, sector, location, url,
// posted, salary, source:'smartrecruiters', id, ats:'sr'
//
// WHY A SERVERLESS FUNCTION (not a direct browser fetch):
//   SmartRecruiters' API does not send permissive CORS headers, so — like
//   Adzuna and USAJobs — the request must be made server-side. Unlike those,
//   there is NO API KEY: the public Posting API is keyless. This function is
//   a pure fetch -> normalize -> return proxy with nothing secret in it.
//
// ENDPOINT (official public Posting API, keyless):
//   GET https://api.smartrecruiters.com/v1/companies/{slug}/postings
//        ?q={kw}&limit=&offset=&country=us
//   The list endpoint supports server-side full-text search (q) and a
//   country filter, so the list rows already carry everything we need
//   (title, location, applyUrl) — no per-posting detail call required.
//
// RATE LIMITS (per SmartRecruiters docs): 10 req/sec, 8 concurrent.
//   We fan out in small concurrent batches and stay well under that.

// ---------------------------------------------------------------------------
// CONFIRMED-LIVE EMPLOYERS  (live-verified on the public Posting API)
// ---------------------------------------------------------------------------
// Each returned recent US postings when tested on 2026-07-14. All are
// high-volume employers hiring entry-level across many US locations.
//
// TO ADD MORE LATER:
//   1. Find a company whose careers URL is jobs.smartrecruiters.com/SLUG
//   2. Test it (SLUG is CASE-SENSITIVE):
//        https://api.smartrecruiters.com/v1/companies/SLUG/postings?limit=1&country=us
//   3. Recent US job? Add a line: { slug:"SLUG", name:"Company", sector:"..." },
//   Dead/empty slugs are skipped automatically and never break a search.
const EMPLOYERS = [
  { slug: "Visa",                        name: "Visa",                         sector: "fintech" },
  { slug: "BoschGroup",                  name: "Bosch",                        sector: "manufacturing" },
  { slug: "Expeditors",                  name: "Expeditors",                   sector: "logistics" },
  { slug: "ChristianBrothersAutomotive", name: "Christian Brothers Automotive", sector: "automotive" },

  // ---- Add newly verified employers below this line ----

];

const API_BASE = "https://api.smartrecruiters.com/v1/companies";
const PER_COMPANY_LIMIT = 50;   // postings pulled per employer per query
const CONCURRENCY = 6;          // stay under the 8-concurrent ceiling
const FETCH_TIMEOUT_MS = 12000;

function withTimeout(url, ms){
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(t));
}

async function fetchEmployer(emp, keyword, location){
  const params = new URLSearchParams({ limit: String(PER_COMPANY_LIMIT), offset: "0", country: "us" });
  if (keyword) params.set("q", keyword);

  const url = `${API_BASE}/${encodeURIComponent(emp.slug)}/postings?${params}`;
  let res;
  try { res = await withTimeout(url, FETCH_TIMEOUT_MS); }
  catch { return []; }                    // network/timeout -> skip employer
  if (!res.ok) return [];                  // 404/4xx/5xx -> skip employer

  let data;
  try { data = await res.json(); }
  catch { return []; }

  const postings = Array.isArray(data.content) ? data.content : [];

  return postings.map(p => {
    const loc = p.location || {};
    const locationStr = [loc.city, loc.region, (loc.country||"").toUpperCase()]
      .filter(Boolean).join(", ") || "—";
    const applyUrl = p.applyUrl || p.ref || "";
    return {
      title:    p.name || "Untitled role",
      company:  emp.name,
      board:    emp.name,
      sector:   emp.sector || "",
      location: loc.remote ? (locationStr === "—" ? "Remote" : locationStr + " (Remote)") : locationStr,
      url:      applyUrl,
      posted:   p.releasedDate || p.createdOn || null,
      salary:   "",
      source:   "smartrecruiters",
      id:       "sr-" + emp.slug + "-" + (p.id || p.uuid || applyUrl),
      ats:      "sr"
    };
  }).filter(j => j.url);   // no apply link => unusable, skip (matches greenhouse)
}

// Optional location filter applied in-function (SmartRecruiters q covers
// keyword; we keep country=us at the API and do a light client-side location
// contains-match so behavior lines up with your other sources).
function locationMatches(job, location){
  if (!location) return true;
  return String(job.location||"").toLowerCase().includes(String(location).toLowerCase());
}

async function mapLimit(items, limit, fn){
  const results = [];
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length){ const idx = i++; results[idx] = await fn(items[idx]); }
  });
  await Promise.all(workers);
  return results;
}

exports.handler = async (event) => {
  const qs = (event && event.queryStringParameters) || {};
  const keyword  = (qs.keyword || qs.q || "").trim();
  const location = (qs.location || qs.loc || "").trim();

  try {
    const perEmployer = await mapLimit(EMPLOYERS, CONCURRENCY, (emp) =>
      fetchEmployer(emp, keyword, location)
    );

    let jobs = perEmployer.flat().filter(j => locationMatches(j, location));

    // de-dupe on id
    const seen = new Set();
    jobs = jobs.filter(j => (seen.has(j.id) ? false : (seen.add(j.id), true)));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
      body: JSON.stringify({ ok: true, jobs })
    };
  } catch (err) {
    return {
      statusCode: 200,   // fail soft: empty rather than breaking the UI
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, jobs: [] })
    };
  }
};
