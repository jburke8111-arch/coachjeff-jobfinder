// netlify/functions/mcloud.js
// CareerBuilder "CWS" jobs API (jobsapi-internal.m-cloud.io) — a shared, key-free,
// CloudFront-fronted JSON endpoint keyed by Organization + ats_portalid facet.
// One integration = many employers. Add to CBCWS_EMPLOYERS to expand coverage.
//
// Pattern mirrors themuse.js / greenhouse.js: batched parallel fetches via a
// continuous concurrency pool, withTimeout, ?diag=1, keyword-AND + experience gate,
// records normalized to source:'mcloud' / ats:'cbcws'. Descriptions arrive inline
// so these are excluded from checkjobs enrichment (like Adzuna/Muse).

const API = "https://jobsapi-internal.m-cloud.io/api/job";

// --- Employer roster. Each entry is one CareerBuilder-CWS employer. -----------
// To add an employer: open their CWS career site, do a search, and in DevTools
// grab the Organization (number) and the ats_portalid facet from the /api/job call.
const CBCWS_EMPLOYERS = [
  { name: "Texas Health Resources", org: "2277", portalid: "TexasHealth-Taleo-External" },
  // { name: "Example Health",       org: "####", portalid: "Example-Taleo-External" },
];

// --- Tunables (kept within Netlify's 10s sync function limit) -----------------
const PAGE_LIMIT      = 50;    // records per API page (API max observed = 50)
const MAX_PAGES       = 6;     // per employer per keyword -> up to 300 records
const PER_FETCH_MS    = 3500;  // per-request timeout
const TIME_BUDGET_MS  = 9000;  // overall soft budget
const POOL_SIZE       = 8;     // concurrent in-flight requests

const BOOST = "addtnl_categories:0.5,description:0.5,parent_category:0.5,primary_category:0.5,ref:0.5,title:30";

// --- Experience gating --------------------------------------------------------
// The API exposes structured level / years_experience / education, so we gate on
// those first and fall back to title heuristics. levelMode mirrors the client's
// experience-level selector.
const SENIOR_TITLE = /\b(senior|sr\.?|staff|principal|lead|manager|director|vp|vice president|head of|chief|architect|expert|ii{2,}|iv|v\b)\b/i;
const EARLY_TITLE  = /\b(intern|internship|new grad|new-grad|graduate|entry[- ]?level|junior|jr\.?|associate|trainee|apprentice|early career|campus|university|residency|resident|fellow)\b/i;

// Sub-baccalaureate roles: this tool serves (soon-to-be) college graduates, so
// roles whose CREDENTIAL is a vocational certificate / license below a bachelor's
// are excluded outright. Two signals: (a) the title names such a role, or (b) the
// description states a sub-degree credential as the requirement. Note "associate"
// is intentionally NOT here (it's ambiguous: associate-degree vs associate-level
// job title) — we handle associate DEGREE only via description wording below.
const SUBDEGREE_TITLE = /\b(lvn|licensed vocational nurse|lpn|licensed practical nurse|cna|certified nursing assistant|nurse aide|nursing assistant|patient care (tech|technician|assistant)|pct\b|medical assistant|\bma\b|phlebotom(y|ist)|\bemt\b|paramedic|surgical tech(nologist|nician)?|surg tech|sterile processing|monitor tech|telemetry tech|pharmacy tech(nician)?|dental assistant|home health aide|\bhha\b|caregiver|orderly|dietary aide|environmental services|housekeep|food service|scrub tech)\b/i;

// Description wording that indicates the REQUIRED education tops out below a degree.
const SUBDEGREE_REQ = /\b(high school diploma|hs diploma|ged|vocational (certificate|program|school|diploma)|certificate program|certified (nurse|nursing|medical)|licensed vocational|licensed practical|state certification required|completion of an? (accredited )?(certificate|vocational|diploma) program)\b/i;

// A degree requirement that should PROTECT a role from sub-degree exclusion
// (so we don't drop, say, "Nurse Practitioner" that merely mentions supervising CNAs).
const DEGREE_REQ = /\b(bachelor'?s?|baccalaureate|\bbsn\b|\bbs\b|\bba\b|master'?s?|\bmsn\b|\bmba\b|\bmph\b|doctora|\bphd\b|\bmd\b|4-year degree|four-year degree|undergraduate degree)\b/i;

function isSubDegreeRole(job) {
  const title = (job.title || "").toString();
  const desc  = (job.description || "").toString();
  // Title match is decisive for the classic sub-degree job names.
  if (SUBDEGREE_TITLE.test(title)) return true;
  // Otherwise, only exclude on description wording if it names a sub-degree
  // requirement AND does not also call for a bachelor's+ degree.
  if (SUBDEGREE_REQ.test(desc) && !DEGREE_REQ.test(desc)) return true;
  return false;
}

function passesExperience(job, levelMode) {
  if (!levelMode || levelMode === "all") return true;
  const title = (job.title || "").toString();
  const lvl   = (job.level || "").toString().toLowerCase();
  const yrsRaw = job.years_experience;
  const yrs = typeof yrsRaw === "number" ? yrsRaw
            : (parseInt(String(yrsRaw).replace(/[^\d]/g, ""), 10) || null);

  const wantsEarly = levelMode === "internship" || levelMode === "newgrad" ||
                     levelMode === "entry" || levelMode === "early";

  if (wantsEarly) {
    // Hard excludes
    if (isSubDegreeRole(job)) return false;   // sub-baccalaureate credential roles
    if (SENIOR_TITLE.test(title)) return false;
    if (yrs != null && yrs >= 4) return false;
    if (/\b(senior|staff|principal|lead|director|manager|executive)\b/.test(lvl)) return false;

    if (levelMode === "internship") return /\b(intern|internship|co-?op)\b/i.test(title) || /intern/.test(lvl);
    if (levelMode === "newgrad")    return EARLY_TITLE.test(title) || (yrs != null && yrs <= 1);
    if (levelMode === "entry")      return EARLY_TITLE.test(title) || (yrs != null && yrs <= 2) || /entry|junior|associate/.test(lvl);
    // "early" = any early-career
    return EARLY_TITLE.test(title) || (yrs != null && yrs <= 3) || /entry|junior|associate|intern/.test(lvl) || !SENIOR_TITLE.test(title) && (yrs == null);
  }
  return true;
}

// --- Keyword AND matching (tokens must all appear in title/desc/category) -----
function matchesKeywords(job, tokens) {
  if (!tokens.length) return true;
  const hay = [
    job.title, job.description, job.primary_category, job.parent_category,
    job.sub_category, job.function, job.department
  ].filter(Boolean).join(" ").toLowerCase();
  return tokens.every(t => hay.includes(t));
}

// --- Location filter (optional; matches city/state/zip substrings) ------------
function matchesLocations(job, locs) {
  if (!locs.length) return true;
  const hay = [
    job.primary_city, job.primary_state, job.primary_zip, job.primary_country,
    job.primary_location, job.addtnl_locations
  ].filter(Boolean).join(" ").toLowerCase();
  return locs.some(l => hay.includes(l));
}

function withTimeout(promise, ms, tag) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout:${tag}`)), ms))
  ]);
}

function buildUrl({ portalid, org, searchText, offset }) {
  const p = new URLSearchParams();
  p.set("SearchText", searchText || "");
  p.append("facet[]", `ats_portalid:${portalid}`);
  p.set("boost", BOOST);
  p.set("Limit", String(PAGE_LIMIT));
  p.set("Organization", org);
  p.set("offset", String(offset));
  p.set("useBooleanKeywordSearch", "true");
  return `${API}?${p.toString()}`;
}

async function fetchPage(job) {
  const url = buildUrl(job);
  const res = await withTimeout(fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; CoachJeffJobFinder/1.0)",
      "Referer": "https://jobs.texashealth.org/listjobs/"
    }
  }), PER_FETCH_MS, "fetch");
  if (!res.ok) throw new Error(`http:${res.status}`);
  const json = await res.json();
  const jobs = Array.isArray(json.queryResult) ? json.queryResult : [];
  return { jobs, totalHits: json.totalHits ?? jobs.length };
}

// Strip Microsoft-Word / rich HTML down to readable plain text.
function cleanDescription(html) {
  if (!html) return "";
  return String(html)
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")   // block ends -> newline
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\u2022 ")               // list items -> bullet
    .replace(/<[^>]+>/g, "")                          // drop all remaining tags
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");
}

function normalize(j, employerName) {
  const city = j.primary_city, st = j.primary_state;
  // NOTE: primary_location is a [lng,lat] geo pair, NOT a display string — don't use it.
  const loc = [city, st].filter(Boolean).join(", ") || j.primary_country || "";
  return {
    id: `mcloud_${j.id}`,
    source: "mcloud",
    ats: "cbcws",
    title: j.title || "",
    company: j.company_name || j.brand || employerName,
    location: loc,
    city: city || "", state: st || "",
    url: j.url || j.seo_url || j.fndly_url || "",
    description: cleanDescription(j.description),
    salary: j.salary || "",
    employmentType: j.employment_type || j.job_type || "",
    schedule: j.schedule || j.shift || "",
    category: j.primary_category || j.parent_category || j.function || "",
    level: j.level || "",
    yearsExperience: j.years_experience ?? "",
    education: j.education || "",
    postedDate: j.open_date || j.update_date || "",
    _employer: employerName
  };
}

// Continuous concurrency pool: workers pull jobs from a shared queue.
async function runPool(tasks, size, onResult) {
  let i = 0;
  const start = Date.now();
  async function worker() {
    while (i < tasks.length && (Date.now() - start) < TIME_BUDGET_MS) {
      const idx = i++;
      try { onResult(await tasks[idx]()); }
      catch (e) { onResult({ error: e.message }); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker));
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const diag = q.diag === "1";
  const searchText = (q.q || q.keyword || q.SearchText || "").trim();
  const levelMode = (q.level || q.experience || "early").toLowerCase();
  const tokens = searchText.toLowerCase().split(/\s+/).filter(Boolean);
  const locs = (q.location || q.locations || "").toLowerCase().split(/[;,]/).map(s => s.trim()).filter(Boolean);

  const errors = [];
  let rawPulled = 0;
  const seen = new Set();
  const results = [];

  // Build task list: for each employer, page 1 first to learn totalHits,
  // then remaining pages. To stay simple + within budget we queue MAX_PAGES
  // pages per employer up front and let the pool + time budget bound it.
  const tasks = [];
  for (const emp of CBCWS_EMPLOYERS) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE_LIMIT + 1; // confirmed: 1-based record cursor
      tasks.push(async () => {
        const { jobs, totalHits } = await fetchPage({
          portalid: emp.portalid, org: emp.org, searchText, offset
        });
        return { emp, page, jobs, totalHits };
      });
    }
  }

  await runPool(tasks, POOL_SIZE, (r) => {
    if (!r || r.error) { if (r && r.error) errors.push(r.error); return; }
    rawPulled += r.jobs.length;
    for (const j of r.jobs) {
      const key = `mcloud_${j.id}`;
      if (seen.has(key)) continue;
      if (!matchesKeywords(j, tokens)) continue;
      if (!matchesLocations(j, locs)) continue;
      if (!passesExperience(j, levelMode)) continue;
      seen.add(key);
      results.push(normalize(j, r.emp.name));
    }
  });

  const body = diag
    ? { source: "mcloud", ats: "cbcws", keyed: true,
        employers: CBCWS_EMPLOYERS.map(e => e.name),
        searchText, levelMode, locs,
        rawPulled, unique: results.length,
        overlap: rawPulled - seen.size >= 0 ? rawPulled - seen.size : 0,
        errors, jobs: results }
    : { jobs: results };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body)
  };
};
