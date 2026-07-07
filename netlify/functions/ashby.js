// netlify/functions/ashby.js

const ASHBY_BOARDS = [
  "anthropic",
  "cursor",
  "replit",
  "perplexity",
  "cohere",
  "ramp",
  "notion",
  "linear",
  "scaleai",
  "runway",
  "zapier",
  "airtable"
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

    for (const board of ASHBY_BOARDS) {
      try {
        const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`;
        const resp = await fetch(apiUrl);
        if (!resp.ok) continue;

        const data = await resp.json();
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];

        for (const j of jobs) {
          const title = j.title || "";
          const loc =
            j.locationName ||
            j.location ||
            (j.locationNames && j.locationNames.join(", ")) ||
            "—";

          const text = `${title} ${loc}`.toLowerCase();

          if (keyword && !text.includes(keyword)) continue;
          if (location && !text.includes(location) && location !== "remote") continue;

          allJobs.push({
            title,
            company: board,
            sector: "tech",
            location: loc,
            url: j.jobUrl || j.applyUrl || `https://jobs.ashbyhq.com/${board}`,
            posted: j.publishedAt ? Date.parse(j.publishedAt) : null,
            salary: "",
            source: "ashby",
          });
        }
      } catch {
        // Skip failed board
      }
    }

    return new Response(
      JSON.stringify({ ok: true, count: allJobs.length, jobs: allJobs }),
      { status: 200, headers: cors }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err.message || err), jobs: [] }),
      { status: 200, headers: cors }
    );
  }
};
