// netlify/functions/greenhouse.js
//
// Queries public Greenhouse-hosted job boards. Greenhouse has no cross-company
// search, so (like Ashby/Lever) we query a curated list of companies, then
// filter by keyword/location here before returning.
//
// No API key needed. Any board name that 404s is silently skipped, so an
// out-of-date name can never break the search — it just contributes nothing.
//
// Endpoint per company:
//   https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true
//
// REWRITTEN 2026-07-24. Three changes from the original:
//   1. Board list merged with the ats:"gh" entries from COMPANIES in
//      index.html — 12 boards became 95. The two lists had drifted apart and
//      index.html's was far more complete; this is now the single source of
//      truth for Greenhouse and index.html's copy should not be re-added.
//   2. Sequential for-loop replaced with batched parallel fetches. 95 boards
//      one at a time would exceed the function timeout; batching keeps total
//      wall-clock near the slowest batch instead of the sum of 95 round trips.
//   3. Added ?diag=1 board health check and the experience gate, both
//      mirroring ashby.js.
//
// PRUNED 2026-07-24 after the first ?diag=1 run: temporal, plaid, and canva
// all returned 404. Note that plaid and canva existed ONLY in the original
// 12-board list here — a quarter of that list was dead and silently
// contributing nothing, which is the case for running ?diag=1 after any
// board edit rather than assuming a slug still works.
//
// TO ADD MORE BOARDS (same workflow as ashby.js / lever.js):
//   1. Collect candidate board names from boards.greenhouse.io/SLUG or
//      job-boards.greenhouse.io/SLUG careers URLs. Don't test one at a time.
//   2. Paste them all into GREENHOUSE_BOARDS below, deploy.
//   3. Open /.netlify/functions/greenhouse?diag=1 — returns live/empty/dead
//      status + posting count for every board at once.
//   4. Delete the dead/empty rows, deploy again.

const GREENHOUSE_BOARDS = [  // ---- tech / software ----
  { board: "stripe", company: "Stripe", sector: "tech" },
  { board: "databricks", company: "Databricks", sector: "tech" },
  { board: "airbnb", company: "Airbnb", sector: "tech" },
  { board: "coinbase", company: "Coinbase", sector: "fintech" },
  { board: "dropbox", company: "Dropbox", sector: "tech" },
  { board: "instacart", company: "Instacart", sector: "tech" },
  { board: "robinhood", company: "Robinhood", sector: "fintech" },
  { board: "gitlab", company: "GitLab", sector: "tech" },
  { board: "cloudflare", company: "Cloudflare", sector: "tech" },
  { board: "asana", company: "Asana", sector: "tech" },
  { board: "figma", company: "Figma", sector: "tech" },
  { board: "twitch", company: "Twitch", sector: "media" },
  { board: "affirm", company: "Affirm", sector: "fintech" },
  { board: "samsara", company: "Samsara", sector: "tech" },
  { board: "reddit", company: "Reddit", sector: "media" },
  { board: "pinterest", company: "Pinterest", sector: "media" },
  { board: "discord", company: "Discord", sector: "tech" },
  { board: "datadog", company: "Datadog", sector: "tech" },
  { board: "twilio", company: "Twilio", sector: "tech" },
  { board: "elastic", company: "Elastic", sector: "tech" },
  { board: "mongodb", company: "MongoDB", sector: "tech" },
  { board: "roblox", company: "Roblox", sector: "tech" },
  { board: "lyft", company: "Lyft", sector: "tech" },
  { board: "flexport", company: "Flexport", sector: "tech" },
  { board: "verkada", company: "Verkada", sector: "tech" },
  { board: "scaleai", company: "Scale AI", sector: "tech" },
  { board: "anthropic", company: "Anthropic", sector: "tech" },
  { board: "chime", company: "Chime", sector: "fintech" },
  { board: "gusto", company: "Gusto", sector: "fintech" },
  { board: "airtable", company: "Airtable", sector: "tech" },
  { board: "webflow", company: "Webflow", sector: "tech" },
  { board: "vercel", company: "Vercel", sector: "tech" },

  // ---- finance / fintech ----
  { board: "sofi", company: "SoFi", sector: "fintech" },
  { board: "betterment", company: "Betterment", sector: "fintech" },
  { board: "marqeta", company: "Marqeta", sector: "fintech" },
  { board: "blend", company: "Blend", sector: "fintech" },
  { board: "point72", company: "Point72", sector: "finance" },

  // ---- consumer / retail / media ----
  { board: "glossier", company: "Glossier", sector: "consumer" },
  { board: "peloton", company: "Peloton", sector: "consumer" },
  { board: "sweetgreen", company: "Sweetgreen", sector: "consumer" },
  { board: "thefarmersdog", company: "The Farmer's Dog", sector: "consumer" },
  { board: "buzzfeed", company: "BuzzFeed", sector: "media" },

  // ---- healthcare / bio ----
  { board: "oscar", company: "Oscar Health", sector: "healthcare" },

  // ---- enterprise / industrial / defense / other ----
  { board: "relativity", company: "Relativity Space", sector: "defense" },
  { board: "faire", company: "Faire", sector: "tech" },
  { board: "toast", company: "Toast", sector: "fintech" },
  { board: "gemini", company: "Gemini", sector: "fintech" },

  // ---- Lever ----
  { board: "brex", company: "Brex", sector: "fintech" },
  { board: "attentive", company: "Attentive", sector: "tech" },
  { board: "upgrade", company: "Upgrade", sector: "fintech" },
  { board: "sigmacomputing", company: "Sigma Computing", sector: "tech" },
  { board: "fanaticsinc", company: "Fanatics", sector: "consumer" },
  { board: "coherehealth", company: "Cohere Health", sector: "tech" },
  { board: "nuro", company: "Nuro", sector: "industrial" },

  // ---- more tech / AI ----
  { board: "amplitude", company: "Amplitude", sector: "tech" },
  { board: "mixpanel", company: "Mixpanel", sector: "tech" },
  { board: "postman", company: "Postman", sector: "tech" },
  { board: "grafanalabs", company: "Grafana Labs", sector: "tech" },
  { board: "cockroachlabs", company: "Cockroach Labs", sector: "tech" },
  { board: "applovin", company: "AppLovin", sector: "tech" },
  { board: "duolingo", company: "Duolingo", sector: "tech" },
  { board: "squarespace", company: "Squarespace", sector: "tech" },
  { board: "calendly", company: "Calendly", sector: "tech" },

  // ---- finance / banking / consulting ----
  { board: "jumptrading", company: "Jump Trading", sector: "finance" },
  { board: "imc", company: "IMC Trading", sector: "finance" },
  { board: "akunacapital", company: "Akuna Capital", sector: "finance" },
  { board: "carta", company: "Carta", sector: "fintech" },
  { board: "current", company: "Current", sector: "fintech" },
  { board: "mercury", company: "Mercury", sector: "fintech" },

  // ---- healthcare / biotech / climate / energy ----
  { board: "flatironhealth", company: "Flatiron Health", sector: "healthcare" },
  { board: "komodohealth", company: "Komodo Health", sector: "healthcare" },
  { board: "ginkgobioworks", company: "Ginkgo Bioworks", sector: "healthcare" },
  { board: "watershed", company: "Watershed", sector: "climate" },
  { board: "redwoodmaterials", company: "Redwood Materials", sector: "climate" },

  // ---- e-commerce / retail / consumer brands ----
  { board: "renttherunway", company: "Rent the Runway", sector: "retail" },
  { board: "misfitsmarket", company: "Misfits Market", sector: "retail" },
  { board: "ritual", company: "Ritual", sector: "consumer" },
  { board: "oura", company: "Oura", sector: "consumer" },
  { board: "liquiddeath", company: "Liquid Death", sector: "consumer" },

  // ---- cybersecurity / devtools / infrastructure ----
  { board: "wizinc", company: "Wiz", sector: "security" },
  { board: "abnormalsecurity", company: "Abnormal Security", sector: "security" },
  { board: "tailscale", company: "Tailscale", sector: "security" },
  { board: "okta", company: "Okta", sector: "security" },
  { board: "planetscale", company: "PlanetScale", sector: "tech" },
  { board: "clickhouse", company: "ClickHouse", sector: "tech" },

  // ---- robotics / aerospace / hardware ----
  { board: "astranis", company: "Astranis", sector: "industrial" },
  { board: "figure", company: "Figure", sector: "industrial" },
  { board: "spacex", company: "SpaceX", sector: "industrial" },
  { board: "waymo", company: "Waymo", sector: "industrial" },
  { board: "wing", company: "Wing", sector: "industrial" },

  // ---- insurance / proptech / legal tech ----
  { board: "hometap", company: "Hometap", sector: "fintech" },
  { board: "everlaw", company: "Everlaw", sector: "tech" },

  // ---- finance / fintech ----

  // ---- tech / software ----
];

// How many boards to fetch at once. 95 sequential fetches would blow the
// function's execution window; 95 fully parallel risks rate-limiting from
// Greenhouse and a memory spike from holding every board's full job content
// in flight simultaneously. 12 at a time keeps both in check — roughly 8
// batches, each bounded by the 7s per-board timeout.
const BATCH_SIZE = 12;

// ---------------------------------------------------------------------------
// EXPERIENCE GATE
// ---------------------------------------------------------------------------
// Same logic as ashby.js and lever.js — kept as a copy rather than a shared
// import because Netlify functions bundle independently and a shared local
// module adds a build step this project doesn't otherwise need. If this logic
// changes, change it in ALL THREE files.
//
// Greenhouse returns the full posting body in j.content when content=true, so
// reading real requirements costs no extra fetch. The content is HTML-escaped
// HTML, so it needs unescaping before the regexes can see sentence boundaries.
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

// Greenhouse returns job bodies as HTML-escaped HTML (&lt;p&gt;...), so a
// single tag-strip pass isn't enough: unescape first, then strip, or the
// regexes below see literal "&lt;p&gt;" instead of sentence boundaries and
// the experience gate silently under-reads every posting.
function unescapeHtml(s){
  return String(s || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

function cleanText(value){
  return unescapeHtml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Keep paragraph and list breaks as newlines so matchSentence() can find real
// sentence boundaries. Stripping all tags to spaces would merge a requirements
// bullet into its neighbours and let a softener from one requirement wrongly
// apply to another.
function descriptionText(value){
  return unescapeHtml(value)
    .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function getLocation(job) {
  if (job.location && job.location.name) return job.location.name;
  if (job.offices && job.offices.length) return job.offices.map(o => o.name).join(", ");
  return "\u2014";
}

async function fetchBoard(board, ms = 7000){
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;
  const resp = await withTimeout(fetch(apiUrl, { headers: { "Accept": "application/json" } }), ms);
  if(!resp.ok) return { ok: false, httpStatus: resp.status, jobs: [] };
  let data;
  try { data = await resp.json(); }
  catch(_){ return { ok: false, httpStatus: resp.status, jobs: [] }; }
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  return { ok: true, httpStatus: resp.status, jobs };
}

// Run an async mapper over the board list in fixed-size batches.
async function inBatches(items, size, fn){
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    out.push(...await Promise.all(slice.map(fn)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// DIAGNOSTIC MODE:  /.netlify/functions/greenhouse?diag=1
// ---------------------------------------------------------------------------
async function runDiagnostics(){
  const rows = await inBatches(GREENHOUSE_BOARDS, BATCH_SIZE, async (source) => {
    try {
      const res = await fetchBoard(source.board);
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
        sampleTitle: sample ? cleanText(sample.title) : null,
        sampleHasContent: sample ? Boolean(sample.content) : null
      };
    } catch(e){
      return { board: source.board, company: source.company, status: "error",
               postings: 0, error: String((e && e.message) || e).slice(0, 80) };
    }
  });

  const live = rows.filter(r => r.status === "live");
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    summary: {
      boards: rows.length,
      live: live.length,
      empty: rows.filter(r => r.status === "empty").length,
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
    "Content-Type": "application/json"
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
        headers: { ...cors, "Cache-Control": "no-store" }
      });
    }

    const keyword = (url.searchParams.get("keyword") || "").toLowerCase().trim();
    const location = (url.searchParams.get("location") || "").toLowerCase().trim();

    const perBoard = await inBatches(GREENHOUSE_BOARDS, BATCH_SIZE, async (source) => {
      try {
        const res = await fetchBoard(source.board);
        if(!res.ok) return [];

        const out = [];
        for (const j of res.jobs) {
          const title = cleanText(j.title);
          if(!title) continue;

          const loc = getLocation(j);
          const description = descriptionText(j.content || "");

          // Token-AND match, same rule as ashby.js: every word the user typed
          // must appear somewhere in the searchable text, in any order. The
          // original used a plain substring test, which required the user's
          // words to be contiguous and in the same order as the title — so
          // "analyst data" found nothing while "data analyst" worked.
          //
          // Description is included in the haystack (it was in the original
          // too), which keeps recall high but means a keyword can match on a
          // passing mention rather than the role itself. Left as-is
          // deliberately: for a new grad, a false positive costs a glance
          // while a false negative costs a job they never saw.
          const searchable = `${title} ${loc} ${source.company} ${description}`.toLowerCase();

          if (keyword) {
            const terms = keyword.split(/\s+/).filter(Boolean);
            if (!terms.every(t => searchable.includes(t))) continue;
          }

          if (location) {
            const isRemoteSearch = location === "remote";
            if (isRemoteSearch) {
              if (!/remote/i.test(`${loc} ${description}`)) continue;
            } else if (!searchable.includes(location)) {
              continue;
            }
          }

          const { minYears, preferred } = experienceRequirement(description);

          out.push({
            title,
            company: source.company,
            board: source.board,
            sector: source.sector,
            location: loc,
            url: j.absolute_url || `https://boards.greenhouse.io/${source.board}/jobs/${j.id}`,
            posted: j.updated_at ? Date.parse(j.updated_at) : null,
            salary: "",
            source: "greenhouse",
            id: j.id,
            ats: "gh",
            minYears,
            yearsPreferred: preferred,
            expFlag: minYears >= 2
          });
        }
        return out;
      } catch (_) {
        return [];
      }
    });

    const allJobs = perBoard.flat();
    return new Response(JSON.stringify({
      ok: true,
      count: allJobs.length,
      jobs: allJobs
    }), {
      status: 200,
      headers: cors
    });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: String((err && err.message) || err),
      jobs: []
    }), {
      status: 200,
      headers: cors
    });
  }
};
