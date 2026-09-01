// netlify/functions/phenom.js
// Phenom People career sites via the public, no-auth POST /widgets refineSearch
// endpoint. One function serves every Phenom employer in the roster below.
//
// KEY FACTS (confirmed against jobs.memorialhermann.org):
//  - POST https://{domain}/widgets  with ddoKey:"refineSearch" + refNum -> JSON
//  - Jobs at refineSearch.data.jobs ; count at refineSearch.totalHits
//  - Keyword goes in the top-level "keywords" field
//  - refNum auto-discovers from /global/en/search-results HTML, but we HARDCODE it
//    per employer so live searches skip the HTML fetch (one POST each = fast).
//  - Rich inline fields incl. descriptionTeaser (used as description; no 2nd fetch).
//
// SELECTION (hybrid, location-aware) to keep request count sane:
//  - National employers: always queried.
//  - Regional employers: queried when the user's location matches their regions;
//    when location is blank, a rotating slice of regionals is queried so all get
//    coverage over time without hitting every one each search.
//
// Records normalized to source:'phenom' / ats:'phenom'. Excluded from checkjobs
// enrichment (teaser is inline). Returns { ok, jobs } (+ diag fields when ?diag=1).

// ---- Employer roster --------------------------------------------------------
// Add an employer: { name, domain, refNum, regions:[...states/metros...], national:false }
// Discover refNum once: GET https://{domain}/global/en/search-results and read
// "refNum":"XXXX" from the HTML (or hit phenom-test.js?domain=...). Then hardcode it.
const PHENOM_EMPLOYERS = [
  { name: "Memorial Hermann", domain: "jobs.memorialhermann.org", refNum: "MHHSUS", localePath: "global/en",
    regions: ["tx","texas","houston","katy","sugar land","the woodlands","cypress","pearland","conroe"], national: false },
  { name: "Baylor Scott & White", domain: "jobs.bswhealth.com", refNum: "BSWHUS", localePath: "us/en",
    regions: ["tx","texas","dallas","fort worth","dfw","plano","frisco","temple","waco","austin","round rock","college station","killeen"], national: false },
  // Add more: open the careers page, Ctrl+F "phenompeople", read refNum from the
  // cdn.phenompeople.com/CareerConnectResources/prod/XXXX/ path. localePath is the
  // segment before /search-results (usually "global/en" or "us/en").

  // ===== BATCH 2026-08 (refNum/domain/localePath verified against live Phenom
  // sites; NOT yet endpoint-tested via the /widgets POST — confirm each with
  // ?diag=1 after deploy and prune any that return 0). =====
  // ---- health systems / care providers ----
  { name: "SSM Health", domain: "jobs.ssmhealth.com", refNum: "SHWSHLUS", localePath: "us/en",
    regions: ["mo","missouri","il","illinois","ok","oklahoma","wi","wisconsin","st louis","st. louis","madison"], national: false },
  { name: "Franciscan Health", domain: "jobs.franciscanhealth.org", refNum: "FHBFHYUS", localePath: "us/en",
    regions: ["in","indiana","il","illinois","indianapolis","lafayette","crown point","michigan city"], national: false },
  { name: "Bon Secours Mercy Health", domain: "careers.bsmhealth.org", refNum: "BSMBSMUS", localePath: "us/en",
    regions: [], national: true },
  { name: "ChenMed", domain: "careers.chenmed.com", refNum: "CHENUS", localePath: "us/en",
    regions: [], national: true },
  { name: "Aspen Dental", domain: "careers.aspendental.com", refNum: "ASDEUS", localePath: "us/en",
    regions: [], national: true },
  { name: "FOX Rehabilitation", domain: "careers.foxrehab.org", refNum: "FOREUS", localePath: "us/en",
    regions: [], national: true },
  { name: "Children's Hospital of Philadelphia", domain: "careers.chop.edu", refNum: "CHOPUS", localePath: "us/en",
    regions: ["pa","pennsylvania","nj","new jersey","philadelphia","philly"], national: false },
  // ---- non-healthcare (added by request; different sector than the rest) ----
  { name: "GE Aerospace", domain: "careers.geaerospace.com", refNum: "GAOGAYGLOBAL", localePath: "global/en",
    regions: [], national: true },
  { name: "Truist", domain: "careers.truist.com", refNum: "TBJTBFUS", localePath: "us/en",
    regions: [], national: true },
  { name: "Southwest Airlines", domain: "careers.southwestair.com", refNum: "SOUTUS", localePath: "us/en",
    regions: [], national: true },
];

// ---- Tunables (within Netlify's 10s sync limit) -----------------------------
const SIZE            = 50;    // jobs per employer request
const PER_FETCH_MS    = 4000;  // per-request timeout
const TIME_BUDGET_MS  = 9000;  // overall soft budget
const POOL_SIZE       = 6;     // concurrent employer requests
const ROTATE_WHEN_BLANK = 4;   // regionals to sample when location is blank

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// ---- Sub-degree exclusion (shared intent with mcloud.js) --------------------
const SUBDEGREE_TITLE = /\b(lvn|licensed vocational nurse|lpn|licensed practical nurse|cna|certified nursing assistant|nurse aide|nursing assistant|patient care (tech|technician|assistant)|pct\b|medical assistant|\bma\b|phlebotom(y|ist)|\bemt\b|paramedic|surgical tech(nologist|nician)?|surg tech|sterile processing|monitor tech|telemetry tech|pharmacy tech(nician)?|dental assistant|home health aide|\bhha\b|caregiver|orderly|dietary aide|environmental services|housekeep|food service|scrub tech)\b/i;
const SUBDEGREE_REQ = /\b(high school diploma|hs diploma|ged|vocational (certificate|program|school|diploma)|certificate program|certified (nurse|nursing|medical)|licensed vocational|licensed practical|completion of an? (accredited )?(certificate|vocational|diploma) program)\b/i;
const DEGREE_REQ = /\b(bachelor'?s?|baccalaureate|\bbsn\b|\bbs\b|\bba\b|master'?s?|\bmsn\b|\bmba\b|\bmph\b|doctora|\bphd\b|\bmd\b|4-year degree|four-year degree|undergraduate degree|associate degree|associate'?s degree|\badn\b)\b/i;

const SENIOR_TITLE = /\b(senior|sr\.?|staff|principal|lead|manager|director|vp|vice president|head of|chief|architect|expert|iii|iv|v)\b/i;
const EARLY_TITLE  = /\b(intern|internship|new grad|new-grad|graduate|entry[- ]?level|junior|jr\.?|associate|trainee|apprentice|early career|campus|university|residency|resident|fellow|\bi\b|\bii\b)\b/i;

function isSubDegreeRole(job) {
  const title = (job.title || "").toString();
  const desc  = (job.descriptionTeaser || "").toString();
  if (SUBDEGREE_TITLE.test(title)) return true;
  if (SUBDEGREE_REQ.test(desc) && !DEGREE_REQ.test(desc)) return true;
  return false;
}

function passesExperience(job, levelMode) {
  if (!levelMode || levelMode === "all") return true;
  const wantsEarly = ["internship","newgrad","entry","early"].includes(levelMode);
  if (!wantsEarly) return true;
  const title = (job.title || "").toString();
  if (isSubDegreeRole(job)) return false;
  if (SENIOR_TITLE.test(title)) return false;
  if (levelMode === "internship") return /\b(intern|internship|co-?op)\b/i.test(title);
  return EARLY_TITLE.test(title) || !SENIOR_TITLE.test(title);
}

function withTimeout(promise, ms, tag) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout:${tag}`)), ms))
  ]);
}

function buildPayload(refNum, keyword, size) {
  return {
    lang: "en_global", deviceType: "desktop", country: "global",
    pageName: "search-results", size, from: 0,
    jobs: true, counts: true,
    all_fields: ["category","country","city","type"],
    clearAll: false, jdsource: "facets", isSliderEnable: false,
    pageId: "page20", siteType: "external",
    keywords: keyword || "", global: true, selected_fields: {},
    sort: { order: "desc", field: "postedDate" },
    locationData: {}, refNum: refNum || "", ddoKey: "refineSearch"
  };
}

async function fetchEmployer(emp, keyword) {
  const url = `https://${emp.domain}/widgets`;
  const res = await withTimeout(fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", "Accept": "application/json",
      "User-Agent": UA,
      "Origin": `https://${emp.domain}`,
      "Referer": `https://${emp.domain}/${emp.localePath || "global/en"}/search-results`
    },
    body: JSON.stringify(buildPayload(emp.refNum, keyword, SIZE))
  }), PER_FETCH_MS, emp.name);
  if (!res.ok) throw new Error(`http:${res.status}`);
  const json = await res.json();
  const rs = json.refineSearch || {};
  const jobs = (rs.data && rs.data.jobs) || [];
  return { jobs, totalHits: rs.totalHits ?? jobs.length };
}

function normalize(j, emp) {
  const loc = j.cityStateCountry || j.cityState || j.location ||
              [j.city, j.state].filter(Boolean).join(", ") || "";
  // Prefer the Phenom detail page (clean, on the employer domain) over the raw applyUrl.
  const lp = emp.localePath || "global/en";
  const seo = j.jobSeqNo
    ? `https://${emp.domain}/${lp}/job/${j.jobSeqNo}/${String(j.title||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}`
    : (j.applyUrl || "");
  return {
    title: j.title || "Untitled role",
    company: emp.name,
    board: emp.name,
    sector: j.category || "",
    location: loc || "—",
    url: seo || j.applyUrl || "",
    posted: j.postedDate || null,
    salary: "",
    source: "phenom",
    id: "phenom_" + (j.jobSeqNo || j.jobId || j.reqId || (j.title + loc)),
    ats: "phenom"
  };
}

// State name <-> abbreviation, so a user typing "California" matches an
// employer whose regions list only has "ca" (and vice versa). Region lists are
// authored inconsistently (some have both forms, some one), so we expand the
// typed location to include BOTH forms before matching. This is employer
// SELECTION, not job filtering — Phenom can't defer this to the client (an
// unqueried employer returns no jobs for the client to filter), so unlike the
// other connectors the state logic has to live here.
const _ST_TO_ABBR = {
  "alabama":"al","alaska":"ak","arizona":"az","arkansas":"ar","california":"ca",
  "colorado":"co","connecticut":"ct","delaware":"de","florida":"fl","georgia":"ga",
  "hawaii":"hi","idaho":"id","illinois":"il","indiana":"in","iowa":"ia","kansas":"ks",
  "kentucky":"ky","louisiana":"la","maine":"me","maryland":"md","massachusetts":"ma",
  "michigan":"mi","minnesota":"mn","mississippi":"ms","missouri":"mo","montana":"mt",
  "nebraska":"ne","nevada":"nv","new hampshire":"nh","new jersey":"nj","new mexico":"nm",
  "new york":"ny","north carolina":"nc","north dakota":"nd","ohio":"oh","oklahoma":"ok",
  "oregon":"or","pennsylvania":"pa","rhode island":"ri","south carolina":"sc",
  "south dakota":"sd","tennessee":"tn","texas":"tx","utah":"ut","vermont":"vt",
  "virginia":"va","washington":"wa","west virginia":"wv","wisconsin":"wi","wyoming":"wy",
  "district of columbia":"dc",
};
const _ABBR_TO_ST = Object.fromEntries(Object.entries(_ST_TO_ABBR).map(([n,a]) => [a,n]));

// Return the set of location tokens to match against employer regions: the raw
// typed string plus any state-name/abbrev counterparts it implies.
function expandLocationTokens(loc) {
  const out = new Set();
  if (!loc) return out;
  out.add(loc);
  const words = loc.split(/[\s,]+/).filter(Boolean);
  for (const w of words) {
    out.add(w);
    if (_ST_TO_ABBR[w]) out.add(_ST_TO_ABBR[w]);
    if (_ABBR_TO_ST[w]) for (const p of _ABBR_TO_ST[w].split(" ")) out.add(p);
  }
  if (_ST_TO_ABBR[loc]) out.add(_ST_TO_ABBR[loc]);          // full two-word name -> abbrev
  if (_ABBR_TO_ST[loc]) _ABBR_TO_ST[loc].split(" ").forEach(p => out.add(p));
  return out;
}

// pick which employers to query
function selectEmployers(locStr) {
  const loc = (locStr || "").toLowerCase().trim();
  const national = PHENOM_EMPLOYERS.filter(e => e.national);
  const regional = PHENOM_EMPLOYERS.filter(e => !e.national);
  if (loc) {
    const locTokens = expandLocationTokens(loc);
    const matched = regional.filter(e =>
      (e.regions || []).some(r =>
        Array.from(locTokens).some(lt => {
          // 2-char tokens (state abbrevs) must match EXACTLY — substring
          // matching on "or"/"in"/"ma" etc. produces false hits inside city
          // and state names. Longer tokens keep the contains-either behavior
          // so "houston" matches a "houston" region and partial names work.
          if (lt.length === 2 || r.length === 2) return lt === r;
          return lt.includes(r) || r.includes(lt);
        })
      )
    );
    return { list: [...national, ...matched], mode: "location" };
  }
  // blank location: national + rotating slice of regionals (day-based rotation)
  const day = Math.floor(Date.now() / 86400000);
  const start = regional.length ? day % regional.length : 0;
  const slice = [];
  for (let i = 0; i < Math.min(ROTATE_WHEN_BLANK, regional.length); i++) {
    slice.push(regional[(start + i) % regional.length]);
  }
  return { list: [...national, ...slice], mode: "rotate" };
}

async function runPool(tasks, size, onResult) {
  let i = 0; const start = Date.now();
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
  const keyword = (q.q || q.keyword || "").trim();
  const location = (q.location || q.locations || "").trim();
  const levelMode = (q.level || q.experience || "early").toLowerCase();

  const { list, mode } = selectEmployers(location);
  const tokens = keyword.toLowerCase().split(/\s+/).filter(Boolean);

  const errors = [];
  let rawPulled = 0;
  const seen = new Set();
  const results = [];

  const tasks = list.map(emp => async () => {
    const { jobs, totalHits } = await fetchEmployer(emp, keyword);
    return { emp, jobs, totalHits };
  });

  await runPool(tasks, POOL_SIZE, (r) => {
    if (!r || r.error) { if (r && r.error) errors.push(r.error); return; }
    rawPulled += r.jobs.length;
    for (const j of r.jobs) {
      // keyword-AND across title + teaser + category (Phenom already keyword-filters,
      // but multi-word queries can be loose, so tighten locally)
      if (tokens.length) {
        const hay = [j.title, j.descriptionTeaser, j.category].filter(Boolean).join(" ").toLowerCase();
        if (!tokens.every(t => hay.includes(t))) continue;
      }
      if (!passesExperience(j, levelMode)) continue;
      const rec = normalize(j, r.emp);
      if (seen.has(rec.id)) continue;
      seen.add(rec.id);
      results.push(rec);
    }
  });

  const body = diag
    ? { source: "phenom", selectionMode: mode,
        employersQueried: list.map(e => e.name), location, keyword, levelMode,
        rawPulled, unique: results.length, errors, jobs: results }
    : { ok: results.length > 0, jobs: results };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body)
  };
};
