// netlify/functions/oracle.js
//
// Oracle Fusion / Oracle Cloud Recruiting (ORC) connector for the Job Finder.
//
// Employer-agnostic: drive it with { host, siteNumber } so one function serves
// ANY Oracle Fusion candidate-experience site, not just Providence. Same leverage
// as the Workday/Phenom connectors.
//
// Go/no-go already passed for Providence (evac.fa.us2.oraclecloud.com, CX_1):
//   unauthenticated JSON, TotalJobsCount ~2037, structured Id/Title/PostedDate.
//
// STILL REQUIRED before wiring fetchOracle into the client UI:
//   deploy this, hit ?diag=1, confirm rawJobs > 0 FROM NETLIFY (Lambda datacenter IP).
//   Oracle Cloud instances sometimes sit behind a WAF (the HCA trap). Verify live first.
//
// Endpoint shape (public, same call the candidate site's own JS makes):
//   GET {host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions
//        ?onlyData=true
//        &expand=requisitionList.secondaryLocations,flexFieldsFacet.values
//        &finder=findReqs;siteNumber={SITE},limit={N},offset={O},sortBy=POSTING_DATES_DESC[,keyword={KW}]
//
// List call returns TRUNCATED descriptions -> this source is EXCLUDED from checkjobs
// enrichment (like Adzuna/Ashby/Muse/mcloud). Experience gating reads title +
// structured fields, so that's fine.

const DEFAULT_TIME_BUDGET_MS = 9000;   // Netlify sync function hard limit is 10s
const PER_REQUEST_TIMEOUT_MS = 3500;
const POOL_SIZE = 8;                    // continuous-concurrency pool cap (raised from 6 so multiple employers' early pages run at once)
const PAGE_LIMIT = 200;                 // Oracle accepts large page sizes; cuts round-trips
const MAX_PAGES_PER_EMPLOYER = 6;       // safety cap (1200 reqs/employer) within budget

// ---- Employer roster ------------------------------------------------------
// host: the Oracle Cloud pod hostname; site: the CX site number; regions: US
// states this employer covers (for hybrid location-aware selection, mirrors
// PHENOM_EMPLOYERS). national:true => always queried regardless of user location.
const ORACLE_EMPLOYERS = [
  {
    name: "Providence",
    host: "evac.fa.us2.oraclecloud.com",
    site: "CX_1",
    sector: "healthcare",
    national: true,                     // 52 hospitals across 7 states
    regions: ["AK", "CA", "MT", "NM", "OR", "TX", "WA"],
  },
  {
    name: "Northwell Health",
    host: "eppr.fa.us2.oraclecloud.com",
    site: "CX_2",
    sector: "healthcare",
    national: true,                     // largest NY employer, ~61k, 21+ hospitals
    regions: ["NY", "CT"],
    // Careers front end is jobs.northwell.edu (Symphony Talent WordPress wrapper);
    // real ATS is Oracle CE, found via apply_join_ats_url in the page config.
    // Live ?diag test: TotalJobsCount 1292, clean "City, County/State, United States".
  },
  // Add more Oracle Fusion employers here once each passes the live ?diag=1 test.
  // Find them: a careers apply flow that lands on *.oraclecloud.com/hcmUI/CandidateExperience/...
  // The site number (CX_1, CX_2, ...) is in that URL path.
];

// ---- State name <-> abbreviation maps (for location filtering) ------------
// Oracle stores "City, ST, United States"; users type full state names.
const STATE_TO_ABBR = {
  "alabama":"al","alaska":"ak","arizona":"az","arkansas":"ar","california":"ca",
  "colorado":"co","connecticut":"ct","delaware":"de","florida":"fl","georgia":"ga",
  "hawaii":"hi","idaho":"id","illinois":"il","indiana":"in","iowa":"ia",
  "kansas":"ks","kentucky":"ky","louisiana":"la","maine":"me","maryland":"md",
  "massachusetts":"ma","michigan":"mi","minnesota":"mn","mississippi":"ms","missouri":"mo",
  "montana":"mt","nebraska":"ne","nevada":"nv","new hampshire":"nh","new jersey":"nj",
  "new mexico":"nm","new york":"ny","north carolina":"nc","north dakota":"nd","ohio":"oh",
  "oklahoma":"ok","oregon":"or","pennsylvania":"pa","rhode island":"ri","south carolina":"sc",
  "south dakota":"sd","tennessee":"tn","texas":"tx","utah":"ut","vermont":"vt",
  "virginia":"va","washington":"wa","west virginia":"wv","wisconsin":"wi","wyoming":"wy",
  "district of columbia":"dc",
};
const ABBR_TO_STATE = Object.fromEntries(
  Object.entries(STATE_TO_ABBR).map(([name, abbr]) => [abbr, name])
);

// ---- Sub-degree exclusion (ported from mcloud.js) -------------------------
// Jeff's audience is degree-seekers; drop credentials below a bachelor's.
const SUBDEGREE_TITLE_RX = new RegExp(
  [
    "\\bLVN\\b", "\\bLPN\\b", "\\bCNA\\b", "\\bC\\.N\\.A\\b",
    "certified nursing assistant", "nursing assistant", "nurse assistant",
    "patient care (tech|technician|assistant)", "\\bPCT\\b", "\\bPCA\\b",
    "nurse tech(nician)?", "nurse extern", "\\bstudent nurse\\b",
    "medical assistant", "\\bMA\\b(?![a-z])", "phlebotom", "\\bEMT\\b",
    "surg(ical)? tech", "surgical technolog", "sterile process",
    "pharmacy tech", "\\bCPhT\\b", "monitor tech", "telemetry tech",
    "care partner", "health unit coordinator", "unit secretary",
    "dietary aide", "food service", "environmental service", "\\bEVS\\b",
    "housekeep", "transporter", "\\bscribe\\b", "\\bcaregiver\\b",
    "home health aide", "\\bHHA\\b", "\\bCMA\\b",
  ].join("|"),
  "i"
);

// A role explicitly requiring/awarding a degree survives even if a sub-degree
// word appears incidentally. "Associate" is deliberately NOT blocked (ADN/RN).
const DEGREE_REQ_RX = /\b(bachelor|baccalaureate|\bBS\b|\bBSN\b|\bBA\b|master|\bMS\b|\bMSN\b|\bMBA\b|doctora|\bPhD\b|\bMD\b|degree required|RN\b|registered nurse|new grad|residency|resident)\b/i;

// ---- Experience gate (early-career default) -------------------------------
const SENIOR_RX = /\b(senior|sr\.?|lead|principal|staff|manager|mgr|director|head of|vp|vice president|chief|supervisor|coordinator (iii|iv|v)|ii{2,})\b/i;
const EXPERIENCED_NURSE_RX = /\b(charge nurse|nurse examiner|forensic nurse|sexual assault nurse|nurse manager|nurse educator|clinical nurse (specialist|lead|educator)|nurse practitioner|\bNP\b|\bCRNA\b)\b/i;
const EARLY_HINT_RX = /\b(new grad|new graduate|resident|residency|entry.?level|early career|associate|\bi\b|\bintern\b|internship|junior|jr\.?|graduate program|trainee)\b/i;

function isEarlyCareer(title) {
  if (!title) return false;
  if (SENIOR_RX.test(title)) return false;
  if (EXPERIENCED_NURSE_RX.test(title)) return false;
  return true; // default-open; positive hint not required (matches main filter)
}

// ---- Location filtering ---------------------------------------------------
const NONUS_RX = /\b(canada|ontario|british columbia|quebec|alberta|united kingdom|england|ireland|india|philippines|mexico|australia|singapore|germany|france|remote - international)\b/i;

function isUSJob(loc) {
  if (!loc) return true; // Oracle usually gives City, ST; treat unknown as US (curated roster)
  return !NONUS_RX.test(loc);
}

// ---- utilities ------------------------------------------------------------
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`timeout:${label || "req"}`)), ms)
    ),
  ]);
}

function buildUrl(host, site, { limit, offset, keyword }) {
  const finderParts = [
    `siteNumber=${site}`,
    `limit=${limit}`,
    `offset=${offset}`,
    `sortBy=POSTING_DATES_DESC`,
  ];
  if (keyword && keyword.trim()) {
    // Oracle's finder takes keyword inline; encode commas/semicolons safely.
    finderParts.push(`keyword=${encodeURIComponent(keyword.trim())}`);
  }
  const finder = `findReqs;${finderParts.join(",")}`;
  const qs = [
    `onlyData=true`,
    `expand=${encodeURIComponent("requisitionList.secondaryLocations,flexFieldsFacet.values")}`,
    `finder=${finder}`,
  ].join("&");
  return `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?${qs}`;
}

async function fetchPage(host, site, opts) {
  const url = buildUrl(host, site, opts);
  const res = await withTimeout(
    fetch(url, {
      headers: {
        Accept: "application/json",
        // Oracle CE REST wants this header for the anonymous candidate context:
        "REST-Framework-Version": "2",
      },
    }),
    PER_REQUEST_TIMEOUT_MS,
    "oracle-page"
  );
  if (!res.ok) throw new Error(`http:${res.status}`);
  const json = await res.json();
  const root = Array.isArray(json.items) ? json.items[0] : json;
  const list = (root && root.requisitionList) || [];
  const total = (root && root.TotalJobsCount) || 0;
  return { list, total };
}

function normalize(rec, employer) {
  const primary = rec.PrimaryLocation || rec.Location || "";
  const secondaries = Array.isArray(rec.secondaryLocations)
    ? rec.secondaryLocations.map((s) => s.Name || s.PrimaryLocation).filter(Boolean)
    : [];
  const location = primary || secondaries[0] || "";
  return {
    id: `oracle:${employer.site}:${rec.Id}`,
    source: "oracle",
    ats: "orc",
    employer: employer.name,
    title: rec.Title || "",
    location,
    allLocations: [primary, ...secondaries].filter(Boolean),
    url: `https://${employer.host}/hcmUI/CandidateExperience/en/sites/${employer.site}/job/${rec.Id}`,
    postedDate: rec.PostedDate || rec.PostingStartDate || null,
    // description intentionally omitted -> excluded from checkjobs enrichment
  };
}

function passesFilters(job, { keyword, level }) {
  // US filter
  if (!isUSJob(job.location) && !job.allLocations.some(isUSJob)) return false;

  // Sub-degree exclusion (title-based; degree-req guard)
  if (SUBDEGREE_TITLE_RX.test(job.title) && !DEGREE_REQ_RX.test(job.title)) {
    return false;
  }

  // Experience gate (unless "all levels")
  if (level && level !== "all") {
    if (!isEarlyCareer(job.title)) return false;
  }

  // NOTE: no local keyword re-filter. Oracle's finder already keyword-filters
  // server-side, and it matches across title + description + category — broader
  // than the title text. Re-asserting title-only AND-match here wrongly cut
  // good early-career roles ("RN Resident", "Graduate Nurse") whose titles
  // don't contain the literal search token. Trust the server keyword filter.

  return true;
}

// Continuous-concurrency pool over a list of async task factories.
async function runPool(tasks, size, deadline) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length && Date.now() < deadline) {
      const idx = i++;
      try {
        results[idx] = await tasks[idx]();
      } catch (e) {
        results[idx] = { error: String(e && e.message || e) };
      }
    }
  }
  const workers = Array.from({ length: Math.min(size, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

// Which employers to query given the user's location (hybrid, mirrors Phenom).
function selectEmployers(userState) {
  const day = new Date().getUTCDate();
  const out = [];
  const regionals = [];
  for (const e of ORACLE_EMPLOYERS) {
    if (e.national) { out.push(e); continue; }
    if (userState && e.regions && e.regions.includes(userState)) out.push(e);
    else regionals.push(e);
  }
  if (!userState && regionals.length) {
    // rotate a daily slice of regionals when location is blank
    const sliceSize = Math.max(1, Math.ceil(regionals.length / 3));
    const start = (day % Math.ceil(regionals.length / sliceSize)) * sliceSize;
    out.push(...regionals.slice(start, start + sliceSize));
  }
  return out;
}

exports.handler = async (event) => {
  const qp = (event && event.queryStringParameters) || {};
  const keyword = qp.keyword || qp.q || "";
  const location = qp.location || "";
  const level = qp.level || "early";
  const userState = (qp.state || "").toUpperCase() || null;
  const diag = qp.diag === "1";

  const started = Date.now();
  const deadline = started + DEFAULT_TIME_BUDGET_MS;

  const employers = selectEmployers(userState);
  const diagInfo = { employers: employers.map((e) => e.name), errors: [], perEmployer: {} };

  // Build one task per (employer, page), INTERLEAVED page-major: every
  // employer's page 0 before any employer's page 1, etc. Employer-major
  // ordering let the first employer (Providence) saturate the POOL_SIZE
  // worker pool and hit the deadline before later employers (Northwell) ran,
  // so a 2nd employer silently returned nothing. Interleaving guarantees each
  // employer gets an early worker slot.
  const tasks = [];
  for (let p = 0; p < MAX_PAGES_PER_EMPLOYER; p++) {
    for (const emp of employers) {
      tasks.push(async () => {
        const { list, total } = await fetchPage(emp.host, emp.site, {
          limit: PAGE_LIMIT,
          offset: p * PAGE_LIMIT,
          keyword,
        });
        return { emp, page: p, list, total };
      });
    }
  }

  const pageResults = await runPool(tasks, POOL_SIZE, deadline);

  let rawCount = 0;
  const byId = new Map();
  for (const r of pageResults) {
    if (!r || r.error) {
      if (r && r.error) diagInfo.errors.push(r.error);
      continue;
    }
    const { emp, list, total } = r;
    diagInfo.perEmployer[emp.name] = { total, pulled: (diagInfo.perEmployer[emp.name]?.pulled || 0) + list.length };
    for (const rec of list) {
      rawCount++;
      const job = normalize(rec, emp);
      if (passesFilters(job, { keyword, level, location })) {
        byId.set(job.id, job); // dedup by req id
      }
    }
  }

  // Optional location post-filter (Oracle facets are richer, but keep a simple
  // client-parity contains-match here for typed city/state).
  // IMPORTANT: Oracle stores locations as "City, ST, United States" (abbrev),
  // but users type full state names ("California"). Expand each token to include
  // its state-abbrev counterpart (and vice versa) so both match. Without this,
  // "California" -> 0 while "CA" -> many (confirmed bug, Aug 31).
  let jobs = Array.from(byId.values());
  if (location && location.trim()) {
    const baseToks = location.toLowerCase().split(/[\s,]+/).filter(Boolean);
    const expanded = new Set(baseToks);
    // full state name -> abbrev
    for (const t of baseToks) {
      if (STATE_TO_ABBR[t]) expanded.add(STATE_TO_ABBR[t]);
      if (ABBR_TO_STATE[t]) {
        // abbrev -> full name tokens (e.g. "ca" -> "california")
        for (const w of ABBR_TO_STATE[t].split(" ")) expanded.add(w);
      }
    }
    // handle two-word state names typed in full (e.g. "new york") by also
    // mapping the joined phrase to its abbrev
    const joined = baseToks.join(" ");
    if (STATE_TO_ABBR[joined]) expanded.add(STATE_TO_ABBR[joined]);

    const locToks = Array.from(expanded);
    jobs = jobs.filter((j) => {
      const hay = (j.allLocations.join(" ")).toLowerCase();
      return locToks.some((t) => hay.includes(t));
    });
  }

  const body = {
    source: "oracle",
    count: jobs.length,
    jobs,
  };

  if (diag) {
    body.diag = {
      keyed: true,
      rawJobs: rawCount,
      unique: byId.size,
      matched: jobs.length,
      elapsedMs: Date.now() - started,
      ...diagInfo,
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
};
