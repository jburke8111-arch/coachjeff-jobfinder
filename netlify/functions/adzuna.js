// netlify/functions/adzuna.js
//
// Server-side function that queries the Adzuna job-aggregator API and returns
// clean results to the browser. Adzuna uses TWO credentials (app_id + app_key),
// both held here in Netlify environment variables — never in the browser.
//
// The browser calls this at:
//   /.netlify/functions/adzuna?keyword=data%20analyst&location=Texas
//
// Required environment variables (set in the Netlify UI, NOT in code):
//   ADZUNA_APP_ID    -> the App ID from developer.adzuna.com
//   ADZUNA_APP_KEY   -> the App Key from developer.adzuna.com

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

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  // Fail gracefully if not configured yet — never break the rest of the search.
  if (!appId || !appKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Adzuna not configured (missing app id/key).", jobs: [] }),
      { status: 200, headers: cors }
    );
  }

  try {
    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") || "";
    const location = url.searchParams.get("location") || "";

    // Adzuna US search endpoint, page 1.
    const api = new URL("https://api.adzuna.com/v1/api/jobs/us/search/1");
    api.searchParams.set("app_id", appId);
    api.searchParams.set("app_key", appKey);
    api.searchParams.set("results_per_page", "25");
    if (keyword) api.searchParams.set("what", keyword);
    if (location) api.searchParams.set("where", location);
    // Bias toward early-career: exclude senior-sounding roles at the query level.
    api.searchParams.set("what_exclude", "senior manager director principal staff lead");
    // Max salary cap helps filter out senior roles (entry roles rarely exceed this).
    api.searchParams.set("salary_max", "110000");
    api.searchParams.set("sort_by", "date");

    const resp = await fetch(api.toString());
    if (!resp.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `Adzuna API returned ${resp.status}`, jobs: [] }),
        { status: 200, headers: cors }
      );
    }

    const data = await resp.json();
    const results = (data && Array.isArray(data.results)) ? data.results : [];

    // Normalize into the same shape the rest of the site uses.
    const jobs = results.map((r) => {
      const loc = (r.location && r.location.display_name) || "—";
      let salary = "";
      if (r.salary_min && r.salary_max) {
        salary = `$${Math.round(r.salary_min).toLocaleString()}–$${Math.round(r.salary_max).toLocaleString()} (listed)`;
      }
      return {
        title: r.title ? String(r.title).replace(/<[^>]+>/g, "") : "Job posting",
        company: (r.company && r.company.display_name) || "Employer",
        sector: (r.category && r.category.label) ? String(r.category.label).toLowerCase() : "other",
        location: loc,
        url: r.redirect_url || "https://www.adzuna.com",
        posted: r.created ? Date.parse(r.created) : null,
        salary,
        source: "adzuna",
      };
    });

    return new Response(
      JSON.stringify({ ok: true, count: jobs.length, jobs }),
      { status: 200, headers: cors }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String((err && err.message) || err), jobs: [] }),
      { status: 200, headers: cors }
    );
  }
};
