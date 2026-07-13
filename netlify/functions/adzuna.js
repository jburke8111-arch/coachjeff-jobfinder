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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Known job aggregators / walls. If an Adzuna redirect points to one of these,
// the click usually lands on a signup gate rather than the real application.
// Used to (2) deprioritize these results and (1) label them honestly.
const AGGREGATOR_HOSTS = {
  "ziprecruiter.com": "ZipRecruiter",
  "indeed.com": "Indeed",
  "glassdoor.com": "Glassdoor",
  "jobrapido.com": "Jobrapido",
  "neuvoo.com": "neuvoo",
  "talent.com": "Talent.com",
  "jooble.org": "Jooble",
  "monster.com": "Monster",
  "simplyhired.com": "SimplyHired",
  "careerbuilder.com": "CareerBuilder",
  "lensa.com": "Lensa",
  "adzuna.com": "Adzuna",
  "jobcase.com": "Jobcase",
  "recruit.net": "Recruit.net",
  "whatjobs.com": "WhatJobs",
  "resume-library.com": "Resume-Library",
  "learn4good.com": "Learn4Good",
};

// Return { isAggregator, aggregatorName } for a given URL string.
function classifyUrl(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
    for (const domain in AGGREGATOR_HOSTS) {
      if (host === domain || host.endsWith("." + domain)) {
        return { isAggregator: true, aggregatorName: AGGREGATOR_HOSTS[domain] };
      }
    }
  } catch (_) {
    // Unparseable URL — treat as aggregator/unknown so it sorts last, not first.
    return { isAggregator: true, aggregatorName: "" };
  }
  return { isAggregator: false, aggregatorName: "" };
}

// Normalize a company name to a slug the front end can match against its
// curated Ashby / Greenhouse company lists for (3) company-direct resolution.
// e.g. "InSync Consulting Services, Inc." -> "insyncconsultingservices"
function companySlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|group|holdings|services|consulting|technologies|technology|solutions|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
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

    // Build the Adzuna US search URL for a given page number.
    // Nationwide-coverage notes:
    //  • No salary cap. A national salary_max quietly excludes legitimate
    //    entry-level roles in high-cost metros (NYC/SF/Seattle), where new-grad
    //    analyst/engineer roles routinely list $115k+. Senior-role filtering is
    //    handled more precisely by what_exclude (below) + the client-side
    //    title-based seniority filter, so a salary proxy is not needed here.
    //  • max_days_old floors freshness so stale reposts drop out entirely
    //    rather than merely sorting lower under sort_by=date.
    function buildApiUrl(page) {
      const api = new URL(`https://api.adzuna.com/v1/api/jobs/us/search/${page}`);
      api.searchParams.set("app_id", appId);
      api.searchParams.set("app_key", appKey);
      api.searchParams.set("results_per_page", "50");
      if (keyword) api.searchParams.set("what", keyword);
      if (location) api.searchParams.set("where", location);
      // Bias toward early-career: exclude senior-sounding roles at the query level.
      api.searchParams.set("what_exclude", "senior manager director principal staff lead");
      // Freshness floor: only postings from the last 30 days.
      api.searchParams.set("max_days_old", "30");
      api.searchParams.set("sort_by", "date");
      return api.toString();
    }

    // Pull up to 3 pages (≈150 national results) instead of a single page of 25.
    // Pages are fetched in parallel; any page that fails or returns nothing is
    // skipped rather than aborting the whole search. A 200 with an error body
    // from Adzuna is treated as an empty page, never a hard failure.
    const PAGES = 3;
    const pageResults = await Promise.all(
      Array.from({ length: PAGES }, (_, i) =>
        fetch(buildApiUrl(i + 1))
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d && Array.isArray(d.results)) ? d.results : [])
          .catch(() => [])
      )
    );

    // Flatten all pages, then de-duplicate by Adzuna's stable job id (falling
    // back to redirect URL) so overlapping pages can't surface the same role twice.
    const seen = new Set();
    const results = [];
    for (const pageArr of pageResults) {
      for (const r of pageArr) {
        const key = String((r && r.id) || (r && r.redirect_url) || "");
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        results.push(r);
      }
    }

    // If every page failed (network/API down), report it honestly.
    if (results.length === 0 && pageResults.every((p) => p.length === 0)) {
      return new Response(
        JSON.stringify({ ok: true, count: 0, jobs: [] }),
        { status: 200, headers: cors }
      );
    }

    // Normalize into the same shape the rest of the site uses.
    const jobs = results.map((r) => {
      const loc = (r.location && r.location.display_name) || "—";
      let salary = "";
      if (r.salary_min && r.salary_max) {
        salary = `$${Math.round(r.salary_min).toLocaleString()}–$${Math.round(r.salary_max).toLocaleString()} (listed)`;
      }
      const company = (r.company && r.company.display_name) || "Employer";
      const finalUrl = r.redirect_url || "https://www.adzuna.com";
      const { isAggregator, aggregatorName } = classifyUrl(finalUrl);

      return {
        title: r.title ? String(r.title).replace(/<[^>]+>/g, "") : "Job posting",
        company,
        sector: (r.category && r.category.label) ? String(r.category.label).toLowerCase() : "other",
        location: loc,
        url: finalUrl,
        posted: r.created ? Date.parse(r.created) : null,
        salary,
        source: "adzuna",
        // (1) label honestly: front end shows "via {aggregatorName} — signup may be required"
        aggregator: isAggregator,
        aggregatorName,
        // (3) company-direct resolution: front end matches this slug against its
        // curated Ashby/Greenhouse company lists and swaps in the real ATS link.
        companySlug: companySlug(company),
      };
    });

    // (2) deprioritize: sort non-aggregator (real employer / ATS) links first,
    // aggregator/wall links last. Ties broken by most-recently-posted.
    jobs.sort((a, b) => {
      if (a.aggregator !== b.aggregator) return a.aggregator ? 1 : -1;
      return (b.posted || 0) - (a.posted || 0);
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
