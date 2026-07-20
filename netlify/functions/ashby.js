// netlify/functions/ashby.js
//
// Queries public Ashby-hosted job boards. Ashby has no cross-company search,
// so (like Greenhouse/Lever) we query a curated list of companies known to use
// Ashby, then filter by keyword/location here before returning.
//
// No API key needed. Any board name that 404s is silently skipped, so an
// out-of-date name can never break the search — it just contributes nothing.
//
// Endpoint per company:
//   https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true
//
// TO ADD MORE BOARDS (mirrors the smartrecruiters.js workflow):
//   1. Collect candidate board names from jobs.ashbyhq.com/SLUG careers URLs.
//      Don't test them one at a time.
//   2. Paste them all into ASHBY_BOARDS below, deploy.
//   3. Open /.netlify/functions/ashby?diag=1 — returns a live/empty/dead
//      status + listed-posting count for every board at once.
//   4. Delete the dead/empty rows, deploy again.
//   Two deploys for any batch size, instead of one URL check per company.

const ASHBY_BOARDS = [
  // Verify these are live by hitting the function with ?diag=1.
  // Names that aren't real Ashby boards are harmlessly skipped.
  { board: "ramp", company: "Ramp" },
  { board: "notion", company: "Notion" },
  { board: "linear", company: "Linear" },
  { board: "runway", company: "Runway" },
  { board: "deel", company: "Deel" },
  { board: "reddit", company: "Reddit" },
  { board: "vanta", company: "Vanta" },
  { board: "mercury", company: "Mercury" },
  { board: "watershed", company: "Watershed" },
  { board: "hex", company: "Hex" },
  { board: "posthog", company: "PostHog" },
  { board: "replit", company: "Replit" },
  { board: "zapier", company: "Zapier" },
  { board: "airtable", company: "Airtable" },
  { board: "scaleai", company: "Scale AI" },
  { board: "cohere", company: "Cohere" },
  { board: "perplexity", company: "Perplexity" },
  { board: "clipboardhealth", company: "Clipboard Health" },
  { board: "benchling", company: "Benchling" },
  { board: "moderntreasury", company: "Modern Treasury" },

  // ---- Added 2026-07-16 (API-verified: 9 listed US postings) ----
  // Scrunch is a Sitecore company (AI search visibility for marketing teams).
  // Board carries early-career-relevant roles beyond engineering: AI Search
  // Analyst, Solutions Engineer, several Customer Success posts.
  { board: "scrunch", company: "Scrunch" },
];

// ---------------------------------------------------------------------------
// EXPERIENCE GATE
// ---------------------------------------------------------------------------
// Implements the server-side experience scan described in the index.html
// known-issues block. Title regexes cannot tell a new-grad "Analyst" from a
// 4-year "Analyst" — only the requirements text can. Ashby hands us
// descriptionPlain in the SAME board response, so this costs no extra fetch
// (unlike the Greenhouse/Lever path, which needs a per-job call).
//
// Returns { minYears, preferred }:
//   minYears  - the highest years-floor stated anywhere in the posting, 0 if none
//   preferred - true when THAT binding requirement was softened ("preferred",
//               "a plus", "nice to have") rather than hard-required
//
// Deliberately conservative: it reads the LOW end of a range ("2-4 years" -> 2)
// and ignores unrelated numbers by requiring the word "year(s)" adjacent.
//
// WHY preferred MATTERS: the Early-Career Experience Equivalency Guide treats
// "3-5 years preferred" very differently from "3-5 years required" — the former
// is often crossable with a strong internship-heavy portfolio, the latter rarely
// is. A bare number can't carry that distinction, so we track it per-match: the
// softness of the requirement that SET minYears is what counts, not whether the
// word "preferred" happens to appear somewhere else in the posting (it usually
// does — in the benefits or EEO boilerplate).
const SOFT_RX = /\b(preferred|preferable|a plus|nice[- ]to[- ]have|desired|ideally|bonus|would be great|not required)\b/;

// Sentences describing company age / tenure / durations that are NOT a
// candidate experience requirement. A "N years" inside one of these must never
// set minYears. This is the single biggest source of false "senior" mis-tiers:
// "serving customers for 20 years" on an entry-level role would otherwise
// report a 20-year requirement and bury the job in the caution tier.
const NON_REQ_CONTEXT_RX = /\b(in business|founded|established|since \d{4}|for (over |more than )?\d+ years,|years in (business|operation|the (industry|market))|year history|years of combined|years running|anniversary|our (\d+|history)|track record spanning|serving (customers|clients)|over the (past|last)|in the past|ago\b|warranty|lease|term of|per year|years old|age of|years of age)\b/;

// Spelled-out small numbers, so "at least three years" is caught, not read as 0.
const WORD_NUM = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };

// Isolate the sentence/clause a match sits in (not a blind char window), so a
// softener attached to a DIFFERENT requirement in the same paragraph ("3 years
// required. Master's preferred.") doesn't wrongly soften this one.
function matchSentence(haystack, index, matchLen){
  const before = haystack.slice(0, index);
  const after  = haystack.slice(index + matchLen);
  const sentStart = Math.max(before.lastIndexOf('. '), before.lastIndexOf('\n'),
                             before.lastIndexOf('; '), before.lastIndexOf('\u2022'));
  const relEnd = after.search(/[.\n;\u2022]/);
  const sentEnd = relEnd === -1 ? haystack.length : index + matchLen + relEnd;
  return haystack.slice(Math.max(0, sentStart + 1), sentEnd);
}

function isSoftened(haystack, index, matchLen){
  return SOFT_RX.test(matchSentence(haystack, index, matchLen));
}

function inNonReqContext(haystack, index, matchLen){
  return NON_REQ_CONTEXT_RX.test(matchSentence(haystack, index, matchLen));
}

// Fold one candidate "N years" figure into the running max, unless it's noise
// (out of range, or sitting in company-age boilerplate). Tracks whether the
// figure that SET the max was softened — that binding-requirement softness is
// what the tier label reads, per the Early-Career Experience Equivalency Guide.
function considerYears(original, n, index, matchLen, state){
  if(n <= 0 || n > 15) return;                       // 0 = none; >15 = "20 years in business" noise
  if(inNonReqContext(original, index, matchLen)) return;
  if(n > state.max){ state.max = n; state.soft = isSoftened(original, index, matchLen); }
}

// Returns { minYears, preferred }. See the guide note above for why `preferred`
// is tracked per-binding-match rather than "does the word appear anywhere".
function experienceRequirement(text){
  if(!text) return { minYears: 0, preferred: false };
  const original = String(text).toLowerCase();
  let t = original;
  const state = { max: 0, soft: false };

  // Spelled-out numbers: scan the ORIGINAL so offsets line up for context checks.
  const spelled = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*\+?\s*years?\b/g;
  let sm;
  while((sm = spelled.exec(original)) !== null){
    considerYears(original, WORD_NUM[sm[1]], sm.index, sm[0].length, state);
  }

  // Ranges FIRST: "2-4 years", "2 to 4 years", "2\u20134 years" -> the low end (2).
  // Each match is blanked so the single-value pass below can't re-match the
  // range's tail ("4 years") and overstate the requirement.
  const range = /\b(\d{1,2})\s*(?:-|\u2013|\u2014|to)\s*\d{1,2}\s*\+?\s*years?\b/g;
  t = t.replace(range, (full, low, offset) => {
    considerYears(original, parseInt(low, 10), offset, full.length, state);
    return " ".repeat(full.length);   // keep offsets aligned for the pass below
  });

  // Single values: "3+ years", "minimum 3 years", "at least 5 years".
  const single = /\b(?:minimum(?: of)?\s*|at least\s*)?(\d{1,2})\s*\+?\s*years?\b/g;
  let m;
  while((m = single.exec(t)) !== null){
    considerYears(original, parseInt(m[1], 10), m.index, m[0].length, state);
  }

  return { minYears: state.max, preferred: state.max > 0 && state.soft };
}

async function withTimeout(promise, ms){
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error("timeout")), ms); });
  try { return await Promise.race([promise, timeout]); }
  finally { clearTimeout(t); }
}

// ---------------------------------------------------------------------------
// DIAGNOSTIC MODE:  /.netlify/functions/ashby?diag=1
// ---------------------------------------------------------------------------
// Returns one row per board with its live status and listed-posting count,
// instead of returning jobs. Use this after pasting in a batch of candidate
// board names: anything marked "dead" or "empty" can be deleted from
// ASHBY_BOARDS. Does not affect the normal search path in any way.
//
// Mirrors the ?diag=1 contract in smartrecruiters.js. Ashby differs in shape:
// there is no totalFound field and no server-side country filter, so the count
// is derived by counting jobs where isListed !== false.
async function runDiagnostics(){
  const rows = await Promise.all(ASHBY_BOARDS.map(async (source) => {
    const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${source.board}`;
    try {
      const resp = await withTimeout(fetch(apiUrl), 7000);
      if (!resp.ok) {
        return { board: source.board, company: source.company, status: "dead",
                 httpStatus: resp.status, listedPostings: 0 };
      }
      const data = await resp.json();
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      const listed = jobs.filter(j => j.isListed !== false);
      const sample = listed[0] || null;
      return {
        board: source.board,
        company: source.company,
        status: listed.length > 0 ? "live" : "empty",
        listedPostings: listed.length,
        sampleTitle: sample ? sample.title : null,
        sampleHasApplyUrl: sample ? Boolean(sample.applyUrl) : null
      };
    } catch (e) {
      return { board: source.board, company: source.company, status: "error",
               listedPostings: 0, error: String((e && e.message) || e).slice(0, 80) };
    }
  }));

  const live  = rows.filter(r => r.status === "live");
  const total = live.reduce((sum, r) => sum + r.listedPostings, 0);

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    summary: {
      boards: rows.length,
      live: live.length,
      empty: rows.filter(r => r.status === "empty").length,
      dead:  rows.filter(r => r.status === "dead" || r.status === "error").length,
      totalListedPostings: total
    },
    diag: rows.sort((a, b) => b.listedPostings - a.listedPostings)
  };
}

export default async (request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: cors });
  }

  try {
    const url = new URL(request.url);

    // Diagnostic mode — board health check, no jobs returned.
    const diag = url.searchParams.get("diag");
    if (diag === "1" || diag === "true") {
      const out = await runDiagnostics();
      return new Response(JSON.stringify(out, null, 2), {
        status: 200,
        headers: { ...cors, "Cache-Control": "no-store" },
      });
    }

    const keyword = (url.searchParams.get("keyword") || "").toLowerCase().trim();
    const location = (url.searchParams.get("location") || "").toLowerCase().trim();

    // Query all boards in parallel (fast, and 404s are skipped).
    const perBoard = await Promise.all(ASHBY_BOARDS.map(async (source) => {
      try {
        const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${source.board}?includeCompensation=true`;
        const resp = await withTimeout(fetch(apiUrl), 7000);
        if (!resp.ok) return [];
        const data = await resp.json();
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const out = [];
        for (const j of jobs) {
          if (j.isListed === false) continue;

          const title = String(j.title || "Job posting").replace(/<[^>]+>/g, "").trim();
          const loc =
            j.location ||
            j.locationName ||
            (Array.isArray(j.secondaryLocations) && j.secondaryLocations[0] && j.secondaryLocations[0].location) ||
            (j.isRemote ? "Remote" : "—");

          // Token-AND match: every word in the keyword must appear somewhere in
          // the searchable text, in any order. A plain substring match required
          // the user's words to be contiguous and in the same order as the
          // title, so "analyst ai search" or "scrunch analyst" found nothing.
          const text = `${title} ${loc} ${source.company}`.toLowerCase();
          if (keyword) {
            const terms = keyword.split(/\s+/).filter(Boolean);
            if (!terms.every(t => text.includes(t))) continue;
          }
          if (location && location !== "remote" && !text.includes(location)) continue;

          let salary = "";
          if (j.compensation && j.compensation.scrapeableCompensationSalarySummary) {
            salary = `${j.compensation.scrapeableCompensationSalarySummary} (listed)`;
          }

          // Read the real requirements, not just the title.
          const { minYears, preferred } = experienceRequirement(j.descriptionPlain || "");

          out.push({
            title,
            company: source.company,
            sector: "tech",
            location: loc,
            url: j.applyUrl || j.jobUrl || `https://jobs.ashbyhq.com/${source.board}`,
            posted: j.publishedAt ? Date.parse(j.publishedAt) : null,
            salary,
            source: "ashby",
            minYears,                    // 0 = nothing stated
            yearsPreferred: preferred,   // true = "preferred"/"a plus", not hard-required
            expFlag: minYears >= 2,      // kept: index.html still reads it
          });
        }
        return out;
      } catch (_) {
        return [];
      }
    }));

    const allJobs = perBoard.flat();
    return new Response(JSON.stringify({ ok: true, count: allJobs.length, jobs: allJobs }), {
      status: 200, headers: cors,
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String((err && err.message) || err), jobs: [] }), {
      status: 200, headers: cors,
    });
  }
};
