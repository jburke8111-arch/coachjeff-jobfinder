// netlify/functions/thr-test.js
// Throwaway diagnostic: can we reach the Texas Health / CareerBuilder jobs API
// from a Netlify Function? Hit /.netlify/functions/thr-test  (add ?kw=nurse to change keyword)
exports.handler = async (event) => {
  const kw = (event.queryStringParameters && event.queryStringParameters.kw) || "nurse";

  const params = new URLSearchParams();
  params.set("SearchText", kw);
  params.append("facet[]", "ats_portalid:TexasHealth-Taleo-External");
  params.set("boost", "addtnl_categories:0.5,description:0.5,parent_category:0.5,primary_category:0.5,ref:0.5,title:30");
  params.set("Limit", "50");
  params.set("Organization", "2277");
  params.set("offset", "1");
  params.set("useBooleanKeywordSearch", "true");
  // deliberately NO callback param -> expect raw JSON instead of JSONP

  const url = `https://jobsapi-internal.m-cloud.io/api/job?${params.toString()}`;

  const out = { url, ok: false };
  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        // Some CDN-fronted APIs are picky without a UA / referer; include realistic ones.
        "User-Agent": "Mozilla/5.0 (compatible; CoachJeffJobFinder/1.0)",
        "Referer": "https://jobs.texashealth.org/listjobs/"
      }
    });
    out.status = res.status;
    out.contentType = res.headers.get("content-type");
    const text = await res.text();
    out.bodyLength = text.length;

    let json = null;
    try { json = JSON.parse(text); }
    catch {
      const m = text.match(/^[^(]*\((.*)\)\s*;?\s*$/s);
      if (m) { try { json = JSON.parse(m[1]); out.wasJsonp = true; } catch {} }
    }

    if (json) {
      const jobs = json.Jobs || json.jobs || json.results || json.data || [];
      out.ok = Array.isArray(jobs) && jobs.length > 0;
      out.totalHits = json.TotalHits ?? json.totalHits ?? json.Total ?? json.total ?? null;
      out.jobsThisPage = Array.isArray(jobs) ? jobs.length : null;
      out.topLevelKeys = Object.keys(json);
      out.firstJobKeys = jobs[0] ? Object.keys(jobs[0]) : null;
      out.sample = (Array.isArray(jobs) ? jobs.slice(0,3) : []).map(j => ({
        title: j.Title||j.title||j.JobTitle,
        location: j.Location||j.location||j.City,
        url: j.Url||j.url||j.ApplyUrl||j.JobUrl
      }));
    } else {
      out.bodySnippet = text.slice(0, 600);
    }
  } catch (e) {
    out.fetchError = e.message;
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(out, null, 2)
  };
};
