// netlify/functions/greenhouse.js

const GREENHOUSE_BOARDS = [
  { board: "spacex", company: "SpaceX", sector: "tech" },
  { board: "stripe", company: "Stripe", sector: "tech" },
  { board: "figma", company: "Figma", sector: "tech" },
  { board: "databricks", company: "Databricks", sector: "tech" },
  { board: "robinhood", company: "Robinhood", sector: "finance" },
  { board: "plaid", company: "Plaid", sector: "finance" },
  { board: "airbnb", company: "Airbnb", sector: "tech" },
  { board: "dropbox", company: "Dropbox", sector: "tech" },
  { board: "reddit", company: "Reddit", sector: "tech" },
  { board: "discord", company: "Discord", sector: "tech" },
  { board: "duolingo", company: "Duolingo", sector: "education" },
  { board: "canva", company: "Canva", sector: "tech" }
];

function cleanText(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getLocation(job) {
  if (job.location && job.location.name) return job.location.name;
  if (job.offices && job.offices.length) return job.offices.map(o => o.name).join(", ");
  return "—";
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
    const keyword = (url.searchParams.get("keyword") || "").toLowerCase().trim();
    const location = (url.searchParams.get("location") || "").toLowerCase().trim();

    const allJobs = [];

    for (const source of GREENHOUSE_BOARDS) {
      try {
        const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${source.board}/jobs?content=true`;
        const resp = await fetch(apiUrl);

        if (!resp.ok) continue;

        const data = await resp.json();
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];

        for (const j of jobs) {
          const title = cleanText(j.title);
          const loc = getLocation(j);
          const description = cleanText(j.content || "");
          const searchable = `${title} ${loc} ${source.company} ${description}`.toLowerCase();

          if (keyword && !searchable.includes(keyword)) continue;

          if (location) {
            const locationMatches =
              searchable.includes(location) ||
              (location === "remote" && /remote/i.test(`${loc} ${description}`));

            if (!locationMatches) continue;
          }

          allJobs.push({
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
            ats: "gh"
          });
        }
      } catch (_) {}
    }

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
      error: String(err.message || err),
      jobs: []
    }), {
      status: 200,
      headers: cors
    });
  }
};
