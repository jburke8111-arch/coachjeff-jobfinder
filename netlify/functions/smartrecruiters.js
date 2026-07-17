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
//   (title, location, apply link) — no per-posting detail call required.
//
// RATE LIMITS (per SmartRecruiters docs): 10 req/sec, 8 concurrent.
//   We fan out in small concurrent batches and stay well under that.

// ---------------------------------------------------------------------------
// CONFIRMED-LIVE EMPLOYERS  (live-verified on the public Posting API)
// ---------------------------------------------------------------------------
// Each returned a non-zero US totalFound when tested against the public
// Posting API. Names are deliberately qualified where the tenant is a
// subsidiary or RPO arm rather than the parent company (see notes below).
//
// TO ADD MORE LATER:
//   1. Find a company whose careers URL is careers.smartrecruiters.com/SLUG
//      or jobs.smartrecruiters.com/SLUG
//   2. Test the API (a live careers page does NOT guarantee API access):
//        https://api.smartrecruiters.com/v1/companies/SLUG/postings?limit=1&country=us
//   3. Look at "totalFound". If it's > 0, add a line:
//        { slug:"SLUG", name:"Company", sector:"..." },
//      If it 404s or totalFound is 0, skip it.
//   Dead/empty slugs are skipped automatically and never break a search.
//
// A FASTER WAY TO CHECK MANY AT ONCE (use this for batches):
//   1. Collect slugs from careers.smartrecruiters.com/SLUG URLs. Don't test
//      them individually.
//   2. Paste them all into EMPLOYERS below, deploy.
//   3. Open /.netlify/functions/smartrecruiters?diag=1 — returns a
//      live/empty/dead status + US posting count for every employer at once.
//   4. Delete the dead/empty rows, deploy again.
//   Two deploys for any batch size, instead of one URL check per employer.
const EMPLOYERS = [
  { slug: "Visa",                        name: "Visa",                          sector: "fintech" },
  { slug: "BoschGroup",                  name: "Bosch",                         sector: "manufacturing" },
  { slug: "Expeditors",                  name: "Expeditors",                    sector: "logistics" },
  { slug: "ChristianBrothersAutomotive", name: "Christian Brothers Automotive", sector: "automotive" },

  // ---- Added 2026-07-15 (verified: non-zero US totalFound) ----

  // NOTE: Korn Ferry's SmartRecruiters tenant is Futurestep, their RPO arm.
  // Some postings may be roles Futurestep is filling FOR CLIENTS rather than
  // at Korn Ferry itself. Name reflects that.
  { slug: "FuturestepAKornFerryCompany1",     name: "Korn Ferry (Futurestep)",      sector: "consulting" },

  // NOTE: AWS Truepower is a legacy brand now part of UL Solutions.
  { slug: "AWSTruepower",                     name: "UL Solutions (AWS Truepower)", sector: "energy" },

  // NOTE: This is the federal subsidiary, not Convergint at large.
  // Federal roles often carry clearance requirements.
  { slug: "ConvergintFederalSolutions",       name: "Convergint Federal Solutions", sector: "security" },

  { slug: "cornerstonebuildingbrandscareers", name: "Cornerstone Building Brands",  sector: "manufacturing" },
  { slug: "MATHoldings",                      name: "MAT Holdings",                 sector: "manufacturing" },
  { slug: "Microchip",                        name: "Microchip Technology",         sector: "semiconductors" },
  { slug: "RRDonnelley",                      name: "RRD",                          sector: "marketing" },
  { slug: "seniorlifestyle1",                 name: "Senior Lifestyle",             sector: "healthcare" },

  // NOTE: linkedin3 postings carry no applyUrl; the public posting page at
  // jobs.smartrecruiters.com/linkedin3/{id} resolves correctly (verified),
  // which is what resolveApplyUrl()'s third fallback builds.
  { slug: "linkedin3",                        name: "LinkedIn",                     sector: "tech" },

  // NOTE: Walmart30 is run through Cielo (their RPO). Volume skews toward
  // hourly store/pharmacy roles, but it does carry genuine early-career
  // professional postings too (e.g. Graduate Public Policy Research
  // Associate, Washington DC), so the sector stays plain 'retail'.
  // Postings here carry no applyUrl and their "ATS Link" field is unreliable
  // (see resolveApplyUrl notes) — they fall back to the SmartRecruiters
  // posting page.
  { slug: "Walmart30",                        name: "Walmart",                      sector: "retail" },

  // ---- Added 2026-07-15: CANDIDATES, NOT YET API-VERIFIED ----
  // Slugs taken from live careers.smartrecruiters.com pages. A live careers
  // page does NOT prove the public Posting API is open for that tenant, so
  // these have not been confirmed. Run ?diag=1 after deploying and delete any
  // row that comes back "dead" or "empty". Dead slugs fail soft in the
  // meantime — they cost one wasted fetch and never break a search.
  { slug: "aubergecollection",                name: "Auberge Resorts Collection",   sector: "hospitality" },
  { slug: "Winsupply1",                       name: "Winsupply",                    sector: "distribution" },
  { slug: "msxinternational",                 name: "MSX International",            sector: "automotive" },
  { slug: "signode",                          name: "Signode",                      sector: "manufacturing" },
  { slug: "mcwaneinc",                        name: "McWane",                       sector: "manufacturing" },
  { slug: "AWPSafety",                        name: "AWP Safety",                   sector: "infrastructure" },
  { slug: "ProgressRail",                     name: "Progress Rail (Caterpillar)",  sector: "manufacturing" },
  { slug: "californiaclosets",                name: "California Closets",           sector: "retail" },
  { slug: "eversana1",                        name: "EVERSANA",                     sector: "life-sciences" },
  { slug: "Dungarvin",                        name: "Dungarvin",                    sector: "healthcare" },
  { slug: "thewonderfulcompany",              name: "The Wonderful Company",        sector: "consumer-goods" },
  { slug: "Eataly",                           name: "Eataly",                       sector: "hospitality" },
  { slug: "LLNL",                             name: "Lawrence Livermore National Laboratory", sector: "research" },
  { slug: "NorthwesternMutual",               name: "Northwestern Mutual",          sector: "finance" },
  { slug: "IHeartMedia",                      name: "iHeartMedia",                  sector: "media" },
  { slug: "fanniemae",                        name: "Fannie Mae",                   sector: "finance" },

  // ---- Added 2026-07-16: CANDIDATES, NOT YET API-VERIFIED ----
  // Careers pages confirmed live; Posting API access not yet confirmed.
  // Run ?diag=1 after deploy and delete any "dead"/"empty" rows.
  { slug: "MissionCriticalGroup",             name: "Mission Critical Group",       sector: "manufacturing" },
  { slug: "achieve1",                         name: "Achieve",                      sector: "fintech" },
  { slug: "AHRCNYC1",                         name: "AHRC New York City",           sector: "nonprofit" },
  { slug: "AsburyCommunities",                name: "Asbury Communities",           sector: "healthcare" },

  // NOTE: careers URL has a sub-path (/charlies-main), which is a careers-site
  // section, not part of the API slug. Tenant slug is CharliesProduce1.
  { slug: "CharliesProduce1",                 name: "Charlie's Produce",            sector: "food-distribution" },

  // NOTE: Equus Workforce Solutions is a workforce-services provider; some
  // postings may be roles staffed for client programs.
  { slug: "Equus",                            name: "Equus Workforce Solutions",    sector: "workforce-services" },

  // NOTE: staffing firm — postings are largely client placements, not
  // internal roles.
  { slug: "IndotronixInternationalCorp1",     name: "Indotronix International",     sector: "staffing" },

  { slug: "IngramBargeCompany",               name: "Ingram Barge Company",         sector: "logistics" },
  { slug: "KPFFConsultingEngineers",          name: "KPFF Consulting Engineers",    sector: "engineering" },
  { slug: "LEARN2",                           name: "LEARN Behavioral",             sector: "healthcare" },

  // NOTE: McGee Air Services is Alaska Airlines' ground-handling subsidiary.
  { slug: "McGeeAirServices",                 name: "McGee Air Services (Alaska Airlines)", sector: "aviation" },

  { slug: "SpectrumRetirementCommunities",    name: "Spectrum Retirement Communities", sector: "healthcare" },
  { slug: "Trucordia1",                       name: "Trucordia",                    sector: "insurance" },

  // NOTE: short/generic slug — confirm the diag sampleTitle matches the
  // employer you expect before trusting the name below.
  { slug: "wgc",                              name: "WGC",                          sector: "professional-services" },

  // ---- Added 2026-07-17: CANDIDATES, NOT YET API-VERIFIED ----
  // Source: bloomberry.com/data/smartrecruiters (ranks employers by ATS usage,
  // NOT by new-grad hiring — so the list needed filtering before it landed here).
  // Careers pages confirmed loading; Posting API access NOT confirmed. A careers
  // page rendering does not mean the tenant exposes /v1/companies/{slug}/postings.
  // Run ?diag=1 after deploy and delete any "dead"/"empty" rows.
  //
  // Already cut from the source list as poor fits for early-career/degree roles:
  // CircleLogistics1, AllCareTherapies, ArgusHomeHealthcare,
  // ChristianLivingCommunities, ModernDentalLaboratories.
  { slug: "AbacusTechnologyCorporation",      name: "Abacus Technology",            sector: "it-services" },
  { slug: "buzzclanllc",                      name: "BuzzClan",                     sector: "it-services" },
  { slug: "GDKNCorp",                         name: "GDKN Corporation",             sector: "it-services" },
  { slug: "MetasysTechnologiesInc1",          name: "Metasys Technologies",         sector: "it-services" },
  { slug: "respecinc",                        name: "RESPEC",                       sector: "engineering" },
  { slug: "WiserSolutions",                   name: "Wiser Solutions",              sector: "tech" },
  { slug: "HSMC1",                            name: "HSMC",                         sector: "professional-services" },
  { slug: "KnobelsdorffEnterprises",          name: "Knobelsdorff Enterprises",     sector: "engineering" },

  // NOTE: clinical-leaning employers. Kept because they also post corporate/IT
  // roles, but expect most volume to be licensed/clinical and therefore filtered
  // out client-side by NONDEGREE_RX / the degree-track filter. If diag shows high
  // posting counts but searches surface nothing, these are the ones to cut first.
  { slug: "careflite",                        name: "CareFlite",                    sector: "healthcare" },
  { slug: "integrateddermatology",            name: "Integrated Dermatology",       sector: "healthcare" },
  { slug: "LucidHearingHoldingCompanyLLC",    name: "Lucid Hearing",                sector: "healthcare" },
  { slug: "TVG-MedullaLLC",                   name: "Medulla (Chiro One)",          sector: "healthcare" },
];

const API_BASE = "https://api.smartrecruiters.com/v1/companies";
const PER_COMPANY_LIMIT = 50;   // postings pulled per employer per query
const CONCURRENCY = 6;          // stay under SmartRecruiters' 8-concurrent ceiling
const FETCH_TIMEOUT_MS = 6000;  // lowered from 12000 when the list passed 40 — see below

// NOTE ON SCALING: with 56 employers at CONCURRENCY 6 there are ~10 rounds.
// Responses are normally fast (~200-400ms), so a healthy run finishes in ~3s.
// The risk is the tail: one stalled employer holds its round open for the full
// timeout, and enough of those in sequence would blow Netlify's 10s synchronous
// function limit — which fails the ENTIRE SmartRecruiters source, not just the
// slow tenant.
//
// At 12s per request that was a real possibility with a list this size (a single
// timed-out round would have consumed the whole budget), so FETCH_TIMEOUT_MS is
// now 6s: still generous for an API that normally answers in under half a
// second, but low enough that two bad rounds don't take the source down. This is
// the fix this note originally called for when the list grew past ~40; raising
// CONCURRENCY past 8 is not an option (SmartRecruiters' ceiling).
//
// A slow employer is not worth stalling the whole search for. Anything that
// can't answer in 6s is treated as empty and skipped — the same as a 404.

function withTimeout(url, ms){
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(t));
}

// ---------------------------------------------------------------------------
// APPLY URL RESOLUTION
// ---------------------------------------------------------------------------
// The old code fell back to p.ref, but p.ref is the API endpoint for the
// posting (api.smartrecruiters.com/...), NOT an apply page. A user clicking it
// would land on raw JSON. Worse, ref is always truthy, so the
// `.filter(j => j.url)` guard never caught it.
//
// Correct order of preference:
//   1. p.applyUrl — present on most tenants, the canonical link
//   2. jobs.smartrecruiters.com/{slug}/{id} — the public posting page; a
//      valid, working URL pattern for ANY SmartRecruiters tenant, so it is a
//      safe universal fallback (verified live on linkedin3)
// p.ref is never used as a user-facing link.
//
// WHY NOT THE "ATS Link" customField:
//   Some tenants (Walmart30/Cielo) expose an "ATS Link" pointing at their own
//   careers site, e.g. careers.walmart.com/us/en/jobs/R-2532817. Tested
//   2026-07-15: that URL is real, but Walmart redirects it to their Workday
//   instance and the deep link does NOT survive the hop — the user lands on a
//   generic search page with ~2,000 unrelated jobs and no way back to the
//   role. It fails silently (no 404), which is worse than a broken link.
//   The SmartRecruiters posting page below is reliable, so we skip ATS Link.
function resolveApplyUrl(posting, slug){
  if (posting.applyUrl) return posting.applyUrl;

  if (posting.id) {
    return `https://jobs.smartrecruiters.com/${encodeURIComponent(slug)}/${encodeURIComponent(posting.id)}`;
  }

  return "";
}

function normalizePosting(p, emp){
  const loc = p.location || {};
  const parts = [loc.city, loc.region, (loc.country || "").toUpperCase()].filter(Boolean);
  let locationStr = parts.join(", ") || "—";

  // Surface remote/hybrid, which the old version only partly handled.
  if (loc.remote) {
    locationStr = (locationStr === "—") ? "Remote" : locationStr + " (Remote)";
  } else if (loc.hybrid) {
    locationStr = (locationStr === "—") ? "Hybrid" : locationStr + " (Hybrid)";
  }

  const url = resolveApplyUrl(p, emp.slug);

  return {
    title:    p.name || "Untitled role",
    company:  emp.name,
    board:    emp.name,
    sector:   emp.sector || "",
    location: locationStr,
    url,
    posted:   p.releasedDate || p.createdOn || null,
    salary:   "",
    source:   "smartrecruiters",
    id:       "sr-" + emp.slug + "-" + (p.id || p.uuid || url),
    ats:      "sr"
  };
}

async function fetchEmployer(emp, keyword){
  const params = new URLSearchParams({
    limit:  String(PER_COMPANY_LIMIT),
    offset: "0",
    country: "us"
  });
  if (keyword) params.set("q", keyword);

  const url = `${API_BASE}/${encodeURIComponent(emp.slug)}/postings?${params}`;

  let res;
  try { res = await withTimeout(url, FETCH_TIMEOUT_MS); }
  catch { return []; }                     // network/timeout -> skip employer
  if (!res.ok) return [];                  // 404/4xx/5xx -> skip employer

  let data;
  try { data = await res.json(); }
  catch { return []; }

  const postings = Array.isArray(data.content) ? data.content : [];

  return postings
    .map(p => normalizePosting(p, emp))
    .filter(j => j.url && !j.url.startsWith(API_BASE));  // never ship an API link
}

// Optional location filter applied in-function (SmartRecruiters q covers
// keyword; we keep country=us at the API and do a light client-side location
// contains-match so behavior lines up with your other sources).
function locationMatches(job, location){
  if (!location) return true;
  return String(job.location || "").toLowerCase()
    .includes(String(location).toLowerCase());
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

// ---------------------------------------------------------------------------
// DIAGNOSTIC MODE:  /.netlify/functions/smartrecruiters?diag=1
// ---------------------------------------------------------------------------
// Returns one row per employer with its live status and US posting count,
// instead of returning jobs. Use this after pasting in a batch of candidate
// slugs: anything marked "dead" or "empty" can be deleted from EMPLOYERS.
// Does not affect the normal search path in any way.
async function runDiagnostics(){
  const rows = await mapLimit(EMPLOYERS, CONCURRENCY, async (emp) => {
    const url = `${API_BASE}/${encodeURIComponent(emp.slug)}/postings?limit=1&country=us`;
    try {
      const res = await withTimeout(url, FETCH_TIMEOUT_MS);
      if (!res.ok) {
        return { slug: emp.slug, name: emp.name, status: "dead",
                 httpStatus: res.status, usPostings: 0 };
      }
      const data = await res.json();
      const n = Number(data.totalFound) || 0;
      const sample = (data.content && data.content[0]) || null;
      return {
        slug: emp.slug,
        name: emp.name,
        status: n > 0 ? "live" : "empty",
        usPostings: n,
        sampleTitle: sample ? sample.name : null,
        sampleHasApplyUrl: sample ? Boolean(sample.applyUrl) : null
      };
    } catch (e) {
      return { slug: emp.slug, name: emp.name, status: "error",
               usPostings: 0, error: String(e && e.message || e).slice(0, 80) };
    }
  });

  const live  = rows.filter(r => r.status === "live");
  const total = live.reduce((sum, r) => sum + r.usPostings, 0);

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    summary: {
      employers: rows.length,
      live: live.length,
      empty: rows.filter(r => r.status === "empty").length,
      dead:  rows.filter(r => r.status === "dead" || r.status === "error").length,
      totalUsPostings: total
    },
    diag: rows.sort((a, b) => b.usPostings - a.usPostings)
  };
}

exports.handler = async (event) => {
  const qs = (event && event.queryStringParameters) || {};

  // Diagnostic mode — slug health check, no jobs returned.
  if (qs.diag === "1" || qs.diag === "true") {
    try {
      const out = await runDiagnostics();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(out, null, 2)
      };
    } catch (err) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, diag: [], error: String(err) })
      };
    }
  }

  const keyword  = (qs.keyword || qs.q || "").trim();
  const location = (qs.location || qs.loc || "").trim();

  try {
    const perEmployer = await mapLimit(EMPLOYERS, CONCURRENCY, (emp) =>
      fetchEmployer(emp, keyword)
    );

    let jobs = perEmployer.flat().filter(j => locationMatches(j, location));

    // de-dupe on id
    const seen = new Set();
    jobs = jobs.filter(j => (seen.has(j.id) ? false : (seen.add(j.id), true)));

    // newest first, undated last
    jobs.sort((a, b) => {
      const ta = a.posted ? Date.parse(a.posted) : 0;
      const tb = b.posted ? Date.parse(b.posted) : 0;
      return tb - ta;
    });

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
