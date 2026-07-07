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

const ASHBY_BOARDS = [
  // Verify these are live by hitting the function with an empty keyword.
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
];

async function withTimeout(promise, ms){
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error("timeout")), ms); });
  try { return await Promise.race([promise, timeout]); }
  finally { clearTimeout(t); }
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

          const text = `${title} ${loc} ${source.company}`.toLowerCase();
          if (keyword && !text.includes(keyword)) continue;
          if (location && location !== "remote" && !text.includes(location)) continue;

          let salary = "";
          if (j.compensation && j.compensation.scrapeableCompensationSalarySummary) {
            salary = `${j.compensation.scrapeableCompensationSalarySummary} (listed)`;
          }

          out.push({
            title,
            company: source.company,
            sector: "tech",
            location: loc,
            url: j.applyUrl || j.jobUrl || `https://jobs.ashbyhq.com/${source.board}`,
            posted: j.publishedAt ? Date.parse(j.publishedAt) : null,
            salary,
            source: "ashby",
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
