// netlify/functions/ashby.js

const ASHBY_BOARDS = [
  { board: "anthropic", company: "Anthropic" },
  { board: "cursor", company: "Cursor" },
  { board: "replit", company: "Replit" },
  { board: "perplexity", company: "Perplexity" },
  { board: "cohere", company: "Cohere" },
  { board: "ramp", company: "Ramp" },
  { board: "notion", company: "Notion" },
  { board: "linear", company: "Linear" },
  { board: "scaleai", company: "Scale AI" },
  { board: "runway", company: "Runway" },
  { board: "zapier", company: "Zapier" },
  { board: "airtable", company: "Airtable" }
];

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
    const keyword = (url.searchParams.get("keyword") || "").toLowerCase();
    const location = (url.searchParams.get("location") || "").toLowerCase();

    const allJobs = [];

    for (const source of ASHBY_BOARDS) {
      const board = source.board;
      const company = source.company;

      try {
        const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`;
        const resp = await fetch(apiUrl);
        if (!resp.ok) continue;

        const data = await resp.json();  
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];

        for (const j of jobs) {
          const title = String(j.title || "Job posting").replace(/<[^>]+>/g, "");
          const loc =
            j.locationName ||
            j.location ||
            (Array.isArray(j.locationNames) ? j.locationNames.join(", ") : "") ||
            (j.isRemote ? "Remote" : "—");

          const text = `${title} ${loc} ${company}`.toLowerCase();

          if (keyword && !text.includes(keyword)) continue;
          if (location && location !== "remote" && !text.includes(location)) continue;

          allJobs.push({
            title,
            company,
            sector: "tech",
            location: loc,
            url: j.applyUrl || j.jobUrl || `https://jobs.ashbyhq.com/${board}`,
            posted: j.publishedAt ? Date.parse(j.publishedAt) : null,
            salary: "",
            source: "ashby"
          });
        }
      } catch (_) {}
    }

    return new Response(JSON.stringify({ ok: true, count: allJobs.length, jobs: allJobs }), {
      status: 200,
      headers: cors
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err), jobs: [] }), {
      status: 200,
      headers: cors
    });
  }
};
