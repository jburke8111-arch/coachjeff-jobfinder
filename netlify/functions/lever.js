// netlify/functions/lever.js
//
// Queries public Lever-hosted job boards. Lever has no cross-company search,
// so (like Greenhouse/Ashby) we query a curated list of companies known to use
// Lever, then filter by keyword/location here before returning.
//
// No API key needed. Any board name that 404s is silently skipped, so an
// out-of-date name can never break the search — it just contributes nothing.
//
// Endpoint per company:
//   https://api.lever.co/v0/postings/{board}?mode=json&limit=100
//
// TWO LEVER-SPECIFIC GOTCHAS, both handled below:
//   1. Some customers DISABLE the public postings endpoint even though their
//      jobs.lever.co page works. Those return non-JSON (an HTML page) with a
//      200 status, so a naive `await resp.json()` throws. We check the content
//      type and bail rather than letting one board kill the batch.
//   2. Lever has no endpoint that enumerates customers, and slugs are not
//      guessable from company names as reliably as Greenhouse's. ?diag=1
//      matters more here than on the other boards — expect a higher dead rate
//      on any batch you paste in.
//
// TO ADD MORE BOARDS (mirrors the ashby.js / smartrecruiters.js workflow):
//   1. Collect candidate board names from jobs.lever.co/SLUG careers URLs.
//      Don't test them one at a time.
//   2. Paste them all into LEVER_BOARDS below, deploy.
//   3. Open /.netlify/functions/lever?diag=1 — returns a live/empty/dead
//      status + posting count for every board at once.
//   4. Delete the dead/empty rows, deploy again.

const LEVER_BOARDS = [
  // ---- Starter set. VERIFY WITH ?diag=1 BEFORE TRUSTING THIS LIST. ----
  // These are companies commonly reported to use Lever, but slugs change and
  // some customers turn the public endpoint off. Anything that comes back
  // dead or empty should be deleted rather than left to waste a fetch.
  { board: "netflix", company: "Netflix", sector: "tech" },
  { board: "kickstarter", company: "Kickstarter", sector: "tech" },
  { board: "atlassian", company: "Atlassian", sector: "tech" },
  { board: "shopify", company: "Shopify", sector: "tech" },
  { board: "spotify", company: "Spotify", sector: "tech" },
  { board: "twitch", company: "Twitch", sector: "tech" },
  { board: "quora", company: "Quora", sector: "tech" },
  { board: "nerdwallet", company: "NerdWallet", sector: "finance" },
  { board: "betterment", company: "Betterment", sector: "finance" },
  { board: "brex", company: "Brex", sector: "finance" },
  { board: "carta", company: "Carta", sector: "finance" },
  { board: "chime", company: "Chime", sector: "finance" },
  { board: "flexport", company: "Flexport", sector: "logistics" },
  { board: "eventbrite", company: "Eventbrite", sector: "tech" },
  { board: "lyft", company: "Lyft", sector: "tech" },
  { board: "coursera", company: "Coursera", sector: "education" },
  { board: "khanacademy", company: "Khan Academy", sector: "education" },
  { board: "mozilla", company: "Mozilla", sector: "tech" },
  { board: "wikimedia", company: "Wikimedia Foundation", sector: "nonprofit" },
  { board: "consumerreports", company: "Consumer Reports", sector: "nonprofit" },
];

// ---------------------------------------------------------------------------
// EXPERIENCE GATE
// ---------------------------------------------------------------------------
// Identical logic to ashby.js — kept as a copy rather than a shared import
// because Netlify functions bundle independently and a shared local module
// adds a build step this project doesn't otherwise need. If this logic changes,
// change it in BOTH files.
//
// Lever gives us descriptionPlain + additionalPlain in the SAME list response,
// so reading real requirements costs no extra fetch. additionalPlain matters
// here: Lever boards frequently put "Requirements" in that second field rather
// than in the main description, so scanning only descriptionPlain would miss
// the years-of-experience line on a large share of postings.
const SOFT_RX = /\b(preferred|preferable|a plus|nice[- ]to[- ]have|desired|ideally|bonus|would be great|not required)\b/;

const NON_REQ_CONTEXT_RX = /\b(in business|founded|established|since \d{4}|for (over |more than )?\d+ years,|years in (business|operation|the (industry|market))|year history|years of combined|years running|anniversary|our (\d+|history)|track record spanning|serving (customers|clients)|over the (past|last)|in the past|ago\b|warranty|lease|term of|per year|years old|age of|years of age)\b/;

const WORD_NUM = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };

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

function considerYears(original, n, index, matchLen, state){
  if(n <= 0 || n > 15) return;
  if(inNonReqContext(original, index, matchLen)) return;
  if(n > state.max){ state.max = n; state.soft = isSoftened(original, index, matchLen); }
}

function experienceRequirement(text){
  if(!text) return { minYears: 0, preferred: false };
  const original = String(text).toLowerCase();
  let t = original;
  const state = { max: 0, soft: false };

  const spelled = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*\+?\s*years?\b/g;
  let sm;
  while((sm = spelled.exec(original)) !== null){
    considerYears(original, WORD_NUM[sm[1]], sm.index, sm[0].length, state);
  }

  const range = /\b(\d{1,2})\s*(?:-|\u2013|\u2014|to)\s*\d{1,2}\s*\+?\s*years?\b/g;
  t = t.replace(range, (full, low, offset) => {
    considerYears(original, parseInt(low, 10), offset, full.length, state);
    return " ".repeat(full.length);
  });

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

function cleanText(value){
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Lever returns a bare JSON ARRAY (not an object with a .jobs key like
// Greenhouse/Ashby). Customers with the public endpoint disabled return an
// HTML page with a 200 status, so we verify both the content type and the
// array shape before trusting the payload.
async function fetchBoard(board, ms = 7000){
  const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json&limit=100`;
  const resp = await withTimeout(fetch(apiUrl, {
    headers: { "Accept": "application/json" }
  }), ms);

  if(!resp.ok) return { ok: false, httpStatus: resp.status, jobs: [] };

  const ctype = String(resp.headers.get("content-type") || "");
  if(!ctype.includes("json")){
    // Public postings endpoint disabled for this customer — served the
    // careers HTML page instead. Not an error worth surfacing; just skip.
    return { ok: false, httpStatus: resp.status, disabled: true, jobs: [] };
  }

  let data;
  try { data = await resp.json(); }
  catch(_){ return { ok: false, httpStatus: resp.status, disabled: true, jobs: [] }; }

  if(!Array.isArray(data)) return { ok: false, httpStatus: resp.status, disabled: true, jobs: [] };
  return { ok: true, httpStatus: resp.status, jobs: data };
}

// Lever nests location under categories, with allLocations as an array for
// multi-site roles. Prefer the array when present so a Dallas-based grad
// searching "texas" still matches a role listed primarily as "Remote - US"
// but also open in Austin.
function getLocation(j){
  const c = j.categories || {};
  if(Array.isArray(c.allLocations) && c.allLocations.length){
    return c.allLocations.join(", ");
  }
  if(c.location) return c.location;
  if(j.workplaceType === "remote") return "Remote";
  return "\u2014";
}

// ---------------------------------------------------------------------------
// DIAGNOSTIC MODE:  /.netlify/functions/lever?diag=1
// ---------------------------------------------------------------------------
// Returns one row per board with live status and posting count instead of
// jobs. "disabled" is its own status here (Lever-specific): the board exists
// but the customer turned the public API off, which is different from a dead
// slug and worth seeing separately when you're pruning the list.
async function runDiagnostics(){
  const rows = await Promise.all(LEVER_BOARDS.map(async (source) => {
    try {
      const res = await fetchBoard(source.board);
      if(res.disabled){
        return { board: source.board, company: source.company, status: "disabled",
                 httpStatus: res.httpStatus, postings: 0,
                 note: "public postings endpoint off — jobs page may still exist" };
      }
      if(!res.ok){
        return { board: source.board, company: source.company, status: "dead",
                 httpStatus: res.httpStatus, postings: 0 };
      }
      const sample = res.jobs[0] || null;
      return {
        board: source.board,
        company: source.company,
        status: res.jobs.length > 0 ? "live" : "empty",
        postings: res.jobs.length,
        sampleTitle: sample ? cleanText(sample.text) : null,
        sampleHasApplyUrl: sample ? Boolean(sample.applyUrl || sample.hostedUrl) : null,
        sampleHasDescription: sample
          ? Boolean(sample.descriptionPlain || sample.additionalPlain)
          : null
      };
    } catch(e){
      return { board: source.board, company: source.company, status: "error",
               postings: 0, error: String((e && e.message) || e).slice(0, 80) };
    }
  }));

  const live = rows.filter(r => r.status === "live");
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    summary: {
      boards: rows.length,
      live: live.length,
      empty: rows.filter(r => r.status === "empty").length,
      disabled: rows.filter(r => r.status === "disabled").length,
      dead: rows.filter(r => r.status === "dead" || r.status === "error").length,
      totalPostings: live.reduce((sum, r) => sum + r.postings, 0)
    },
    diag: rows.sort((a, b) => b.postings - a.postings)
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

    const perBoard = await Promise.all(LEVER_BOARDS.map(async (source) => {
      try {
        const res = await fetchBoard(source.board);
        if(!res.ok) return [];

        const out = [];
        for (const j of res.jobs) {
          const title = cleanText(j.text);
          if(!title) continue;

          const loc = getLocation(j);
          const cats = j.categories || {};

          // Token-AND match, same rule as ashby.js: every word the user typed
          // must appear somewhere in the searchable text, in any order.
          // Department and team are included because Lever boards often carry
          // the useful signal there rather than in the title — a posting
          // titled "Associate" sits under team "Data & Analytics".
          const text = `${title} ${loc} ${source.company} ${cats.team || ""} ${cats.department || ""} ${cats.commitment || ""}`.toLowerCase();

          if (keyword) {
            const terms = keyword.split(/\s+/).filter(Boolean);
            if (!terms.every(t => text.includes(t))) continue;
          }

          if (location) {
            const isRemoteSearch = location === "remote";
            const remoteish = j.workplaceType === "remote" || /remote/i.test(loc);
            if (isRemoteSearch) {
              if (!remoteish) continue;
            } else if (!text.includes(location)) {
              continue;
            }
          }

          // Scan BOTH description fields — Lever splits requirements across
          // them inconsistently, and the years-of-experience line lands in
          // additionalPlain on a large share of boards.
          const descText = `${j.descriptionPlain || ""}\n${j.additionalPlain || ""}`;
          const { minYears, preferred } = experienceRequirement(descText);

          // Lever's salaryRange is present only when the customer fills it in.
          let salary = "";
          if (j.salaryRange && (j.salaryRange.min || j.salaryRange.max)) {
            const cur = j.salaryRange.currency || "USD";
            const min = j.salaryRange.min ? Number(j.salaryRange.min).toLocaleString() : "";
            const max = j.salaryRange.max ? Number(j.salaryRange.max).toLocaleString() : "";
            if (min && max)      salary = `${cur} ${min}\u2013${max} (listed)`;
            else if (min)        salary = `${cur} ${min}+ (listed)`;
            else if (max)        salary = `up to ${cur} ${max} (listed)`;
          }

          out.push({
            title,
            company: source.company,
            board: source.board,
            sector: source.sector || "",
            location: loc,
            url: j.hostedUrl || j.applyUrl || `https://jobs.lever.co/${source.board}`,
            posted: j.createdAt ? Number(j.createdAt) : null,
            salary,
            source: "lever",
            id: j.id || `lv-${source.board}-${j.hostedUrl || title}`,
            ats: "lv",
            minYears,
            yearsPreferred: preferred,
            expFlag: minYears >= 2,
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
