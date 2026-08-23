// netlify/functions/phenom-test.js
// One-shot Phenom probe. Tests jobs.memorialhermann.org /widgets refineSearch.
// Designed to answer, in a SINGLE deploy, all of:
//   1. Does Lambda reach it at all, or hit Cloudflare/403/429?
//   2. Does empty refNum work (single-tenant), or do we need a real refNum?
//   3. What's the response shape / field names?
//   4. Can we auto-discover the refNum from the page HTML?
// Usage: /.netlify/functions/phenom-test           (default: Memorial Hermann)
//        /.netlify/functions/phenom-test?domain=jobs.example.com&kw=nurse
//        /.netlify/functions/phenom-test?refnum=ABC123   (force a refNum)

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const domain = q.domain || "jobs.memorialhermann.org";
  const kw = q.kw || "nurse";
  const forcedRef = q.refnum || null;

  const out = { domain, keyword: kw, steps: {} };

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

  // ---- Step A: try to discover refNum from the search-results HTML ----
  let discoveredRef = null;
  try {
    const htmlUrl = `https://${domain}/global/en/search-results`;
    const r = await fetch(htmlUrl, { headers: { "User-Agent": UA, "Accept": "text/html" } });
    out.steps.htmlFetch = { url: htmlUrl, status: r.status };
    if (r.ok) {
      const html = await r.text();
      out.steps.htmlFetch.length = html.length;
      const m = html.match(/"refNum"\s*:\s*"([^"]+)"/);
      if (m) { discoveredRef = m[1]; out.steps.htmlFetch.refNum = discoveredRef; }
      else {
        // Cloudflare challenge pages are short + contain these markers
        out.steps.htmlFetch.looksLikeCloudflare =
          /cloudflare|cf-browser-verification|challenge-platform|Just a moment/i.test(html);
        out.steps.htmlFetch.refNum = null;
      }
    }
  } catch (e) {
    out.steps.htmlFetch = { error: e.message };
  }

  const refNum = forcedRef || discoveredRef || ""; // empty may work on single-tenant
  out.usingRefNum = refNum || "(empty)";

  // ---- Step B: POST the widgets refineSearch endpoint ----
  const widgetsUrl = `https://${domain}/widgets`;
  const payload = {
    lang: "en_global", deviceType: "desktop", country: "global",
    pageName: "search-results", size: 20, from: 0,
    jobs: true, counts: true,
    all_fields: ["category", "country", "city", "type"],
    clearAll: false, jdsource: "facets", isSliderEnable: false,
    pageId: "page20", siteType: "external",
    keywords: kw, global: true, selected_fields: {},
    sort: { order: "desc", field: "postedDate" },
    locationData: {}, refNum: refNum, ddoKey: "refineSearch"
  };

  try {
    const r = await fetch(widgetsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": UA,
        "Origin": `https://${domain}`,
        "Referer": `https://${domain}/global/en/search-results`
      },
      body: JSON.stringify(payload)
    });
    out.steps.widgets = { url: widgetsUrl, status: r.status, contentType: r.headers.get("content-type") };
    const text = await r.text();
    out.steps.widgets.bodyLength = text.length;

    let json = null;
    try { json = JSON.parse(text); } catch {}

    if (json) {
      const rs = json.refineSearch || {};
      const data = rs.data || {};
      const jobs = data.jobs || [];
      out.steps.widgets.totalHits = rs.totalHits ?? null;
      out.steps.widgets.jobsReturned = Array.isArray(jobs) ? jobs.length : 0;
      out.steps.widgets.topKeys = Object.keys(json);
      if (jobs[0]) {
        out.steps.widgets.firstJobKeys = Object.keys(jobs[0]);
        out.steps.widgets.sample = jobs.slice(0, 3).map(j => ({
          title: j.title, location: j.location, category: j.category,
          type: j.type, posted: j.postedDate,
          seq: j.jobSeqNo, apply: j.applyUrl,
          teaser: (j.descriptionTeaser || "").slice(0, 120)
        }));
      }
      out.ok = out.steps.widgets.jobsReturned > 0;
    } else {
      // Not JSON -> likely a Cloudflare / bot wall. Capture a snippet to confirm.
      out.steps.widgets.looksLikeCloudflare =
        /cloudflare|cf-browser-verification|challenge-platform|Just a moment|Attention Required/i.test(text);
      out.steps.widgets.bodySnippet = text.slice(0, 400);
      out.ok = false;
    }
  } catch (e) {
    out.steps.widgets = { url: widgetsUrl, error: e.message };
    out.ok = false;
  }

  // ---- Verdict ----
  out.verdict =
    out.ok ? "WORKS: Phenom widgets callable from Lambda; jobs returned."
    : (out.steps.widgets && out.steps.widgets.looksLikeCloudflare) ? "BLOCKED: Cloudflare/bot wall."
    : (out.steps.widgets && [403,429].includes(out.steps.widgets.status)) ? "BLOCKED: 403/429 (rate or bot protection)."
    : "INCONCLUSIVE: see steps.";

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(out, null, 2)
  };
};
