// netlify/functions/usajobs.js
//
// Server-side function that queries the USAJOBS API and returns clean job
// results to the browser. The API key lives in Netlify environment variables
// (process.env) and never touches the browser — that's the whole point of
// running this on the server.
//
// The browser calls this at:  /.netlify/functions/usajobs?keyword=data%20analyst&location=Texas
//
// Required environment variables (set these in the Netlify UI, NOT in code):
//   USAJOBS_API_KEY   -> the key from the second USAJOBS email
//   USAJOBS_EMAIL     -> the email address you used to request the key
//     (USAJOBS requires your email as the User-Agent header)

export default async (request, context) => {
  // CORS: allow the browser on your own site to call this function
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Browsers send a preflight OPTIONS request first — answer it.
  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: cors });
  }

  const apiKey = process.env.USAJOBS_API_KEY;
  const email = process.env.USAJOBS_EMAIL;

  // If the keys aren't configured yet, fail gracefully with a clear message
  // instead of crashing — so the rest of the site keeps working.
  if (!apiKey || !email) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "USAJOBS not configured yet (missing API key or email env vars).",
        jobs: [],
      }),
      { status: 200, headers: cors }
    );
  }

  try {
    // Read search params the browser passed in
    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") || "";
    const location = url.searchParams.get("location") || "";

    // Build the USAJOBS API request
    const api = new URL("https://data.usajobs.gov/api/search");
    if (keyword) api.searchParams.set("Keyword", keyword);
    if (location) api.searchParams.set("LocationName", location);
    // Bias toward entry-level federal grades (GS-05/07/09) that fit new grads.
    // USAJOBS uses PayGradeLow/High for GS grades.
    api.searchParams.set("PayGradeLow", "05");
    api.searchParams.set("PayGradeHigh", "09");
    api.searchParams.set("ResultsPerPage", "25");

    const apiResp = await fetch(api.toString(), {
      headers: {
        "Host": "data.usajobs.gov",
        "User-Agent": email,
        "Authorization-Key": apiKey,
      },
    });

    if (!apiResp.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `USAJOBS API returned ${apiResp.status}`,
          jobs: [],
        }),
        { status: 200, headers: cors }
      );
    }

    const data = await apiResp.json();
    let items = (data &&
      data.SearchResult &&
      data.SearchResult.SearchResultItems) || [];

    // Drop jobs a new grad CANNOT apply to. USAJOBS marks eligibility with a
    // HiringPath array. We keep only roles open to the general public (or the
    // student / recent-graduate Pathways paths) and drop internal-only,
    // competitive-service-only, land-management, and senior-executive postings.
    // If HiringPath is missing, we keep the job (fail-open, don't hide good ones).
    const OK_PATHS = ["public", "student", "recent-graduate"];
    items = items.filter((item) => {
      const d = (item && item.MatchedObjectDescriptor) || {};
      const paths = (d.UserArea && d.UserArea.Details && d.UserArea.Details.HiringPath) || d.HiringPath;
      if (!Array.isArray(paths) || paths.length === 0) return true; // unknown -> keep
      return paths.some((p) => OK_PATHS.includes(String(p).toLowerCase()));
    });

    // Normalize into the same simple shape the rest of the site uses,
    // so USAJOBS results slot in alongside Greenhouse/Lever results.
    const jobs = items.map((item) => {
      const d = (item && item.MatchedObjectDescriptor) || {};
      const loc =
        (d.PositionLocationDisplay) ||
        (Array.isArray(d.PositionLocation) && d.PositionLocation[0] &&
          d.PositionLocation[0].LocationName) ||
        "—";
      const pay =
        (d.PositionRemuneration && d.PositionRemuneration[0]) || null;
      const salary = pay
        ? `$${Math.round(pay.MinimumRange).toLocaleString()}–$${Math.round(
            pay.MaximumRange
          ).toLocaleString()} (federal, posted)`
        : "";

      return {
        title: d.PositionTitle || "Federal position",
        company: (d.OrganizationName || "U.S. Federal Government"),
        sector: "government",
        location: loc,
        url: d.PositionURI || d.ApplyURI?.[0] || "https://www.usajobs.gov",
        posted: d.PublicationStartDate
          ? Date.parse(d.PublicationStartDate)
          : null,
        salary,
        source: "usajobs",
      };
    });

    return new Response(
      JSON.stringify({ ok: true, count: jobs.length, jobs }),
      { status: 200, headers: cors }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: String((err && err.message) || err),
        jobs: [],
      }),
      { status: 200, headers: cors }
    );
  }
};
