// netlify/functions/smartrecruiters.js
//
// SmartRecruiters public Posting API fetcher for Grad Job Finder.
// Mirrors the pattern of adzuna.js / usajobs.js: a Netlify serverless
// function that proxies public job data and returns it in the tool's
// normalized job schema.
//
// WHY A SERVERLESS FUNCTION (not a direct browser fetch):
//   SmartRecruiters' API does not send CORS headers that allow direct
//   calls from the browser, so — exactly like Adzuna and USAJobs — the
//   request has to be made server-side. Unlike those two, there is NO
//   API KEY here: the public Posting API is keyless. So this function
//   is a pure fetch → normalize → return proxy with nothing secret in it.
//
// ENDPOINT (official public Posting API, keyless):
//   GET https://api.smartrecruiters.com/v1/companies/{slug}/postings
//        ?q={query}&limit={limit}&offset={offset}&country={country}
//   The list endpoint supports server-side full-text search (q) and
//   country/city filters, so in most cases we do NOT need the per-posting
//   detail call — the list rows already carry title, location, department,
//   experienceLevel, and applyUrl.
//
// RATE LIMITS (per SmartRecruiters docs): 10 req/sec, 8 concurrent.
//   We fan out across the employer list in small concurrent batches and
//   stay well under that.

// ---------------------------------------------------------------------------
// CURATED EMPLOYER LIST  ***VERIFY BEFORE TRUSTING***
// ---------------------------------------------------------------------------
// These 4 employers were live-verified on the public Posting API (each
// returned recent US postings when tested). All are high-volume employers
// that hire entry-level across many US locations — a good fit for grads.
//
// Verified live: 2026-07-14
//   Visa                        ~US postings, incl. Austin TX
//   BoschGroup                  4,700+ global; country=us filter applied
//   Expeditors                  164 US postings (logistics/supply chain)
//   ChristianBrothersAutomotive 565 US postings (automotive, TX-founded)
//
// ---------------------------------------------------------------------------
// TO ADD MORE EMPLOYERS LATER:
//   1. Find a company whose careers page URL is on SmartRecruiters, e.g.
//        jobs.smartrecruiters.com/SLUG   (the SLUG is the last part)
//   2. Test it in a browser (SLUG is CASE-SENSITIVE):
//        https://api.smartrecruiters.com/v1/companies/SLUG/postings?limit=1&country=us
//   3. If you see a recent US job, add a line below: { slug: "SLUG", name: "Company" },
//   The function skips any dead/empty slug automatically, so a bad entry
//   never breaks a search — it just returns nothing.
// ---------------------------------------------------------------------------
const EMPLOYERS = [
  { slug: "Visa",                        name: "Visa" },
  { slug: "BoschGroup",                  name: "Bosch" },
  { slug: "Expeditors",                  name: "Expeditors" },
  { slug: "ChristianBrothersAutomotive", name: "Christian Brothers Automotive" },

  // ---- Add newly verified employers below this line ----

];

// SmartRecruiters experienceLevel ids that are relevant for new grads.
// Used for optional server-friendly filtering at normalize time.
const GRAD_LEVELS = new Set([
  "entry_level",
  "associate",
  "internship",
  "not_applicable", // many grad reqs are tagged this way; keep unless noisy
]);

const API_BASE = "https://api.smartrecruiters.com/v1/companies";
const PER_COMPANY_LIMIT = 50;     // postings pulled per employer per query
const CONCURRENCY = 6;            // stay under the 8-concurrent ceiling
const FETCH_TIMEOUT_MS = 12000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// Pull active postings for one employer, filtered server-side by q + country.
async function fetchEmployer(emp, query, country) {
  const params = new URLSearchParams({
    limit: String(PER_COMPANY_LIMIT),
    offset: "0",
  });
  if (query)   params.set("q", query);
  if (country) params.set("country", country);

  const url = `${API_BASE}/${encodeURIComponent(emp.slug)}/postings?${params}`;

  let res;
  try {
    res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  } catch (e) {
    // Network error / timeout — skip this employer, don't fail the run.
    console.warn(`SmartRecruiters ${emp.slug}: fetch error ${e.name}`);
    return [];
  }

  // 404 = renamed/wrong slug. 4xx/5xx = skip gracefully.
  if (!res.ok) {
    if (res.status !== 404) {
      console.warn(`SmartRecruiters ${emp.slug}: HTTP ${res.status}`);
    }
    return [];
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return [];
  }

  const postings = Array.isArray(data.content) ? data.content : [];
  return postings.map((p) => normalize(p, emp));
}

// Map a SmartRecruiters posting into the tool's shared job schema.
// Adjust field names on the RIGHT to match whatever your other sources
// (adzuna.js / greenhouse.js) already emit, so everything stays uniform.
function normalize(p, emp) {
  const loc = p.location || {};
  const locationStr = [loc.city, loc.region, loc.country ? loc.country.toUpperCase() : ""]
    .filter(Boolean)
    .join(", ");

  return {
    source: "smartrecruiters",
    company: emp.name,
    title: p.name || "",
    location: locationStr,
    remote: !!loc.remote,
    department: p.department && p.department.label ? p.department.label : "",
    experienceLevel: p.experienceLevel && p.experienceLevel.id ? p.experienceLevel.id : "",
    applyUrl: p.applyUrl || p.ref || "",
    postedAt: p.releasedDate || p.createdOn || "",
    id: `sr_${emp.slug}_${p.id || p.uuid || ""}`,
  };
}

// Optional grad-level filter. Off by default (many good grad roles are
// mistagged), but here if you want to tighten results.
function isGradLevel(job) {
  if (!job.experienceLevel) return true;
  return GRAD_LEVELS.has(job.experienceLevel);
}

// Simple concurrency-limited map so we respect the rate ceiling.
async function mapLimit(items, limit, fn) {
  const results = [];
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Netlify handler
// ---------------------------------------------------------------------------
exports.handler = async (event) => {
  const qs = (event && event.queryStringParameters) || {};
  const query   = (qs.q || qs.query || "").trim();
  const country = (qs.country || "us").trim().toLowerCase();
  const gradOnly = qs.gradOnly === "1" || qs.gradOnly === "true";

  try {
    const perEmployer = await mapLimit(EMPLOYERS, CONCURRENCY, (emp) =>
      fetchEmployer(emp, query, country)
    );

    let jobs = perEmployer.flat();
    if (gradOnly) jobs = jobs.filter(isGradLevel);

    // De-dupe on id just in case.
    const seen = new Set();
    jobs = jobs.filter((j) => (seen.has(j.id) ? false : (seen.add(j.id), true)));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
      body: JSON.stringify({
        source: "smartrecruiters",
        count: jobs.length,
        employersQueried: EMPLOYERS.length,
        jobs,
      }),
    };
  } catch (err) {
    console.error("smartrecruiters handler error:", err);
    return {
      statusCode: 200, // fail soft: return empty rather than breaking the UI
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "smartrecruiters", count: 0, jobs: [], error: "fetch_failed" }),
    };
  }
};
