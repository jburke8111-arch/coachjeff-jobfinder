// netlify/functions/thr-test.js  (v2 — inspects queryResult nesting)
// Hit /.netlify/functions/thr-test  (?kw=nurse to change keyword)
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

  const url = `https://jobsapi-internal.m-cloud.io/api/job?${params.toString()}`;
  const out = { url };

  // Walk an object and find the first array of objects, reporting its path.
  function findJobArray(obj, path = "") {
    if (Array.isArray(obj)) {
      if (obj.length && typeof obj[0] === "object" && obj[0] !== null) return { path, arr: obj };
      return null;
    }
    if (obj && typeof obj === "object") {
      for (const k of Object.keys(obj)) {
        const hit = findJobArray(obj[k], path ? `${path}.${k}` : k);
        if (hit) return hit;
      }
    }
    return null;
  }

  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; CoachJeffJobFinder/1.0)",
        "Referer": "https://jobs.texashealth.org/listjobs/"
      }
    });
    out.status = res.status;
    const json = await res.json();
    out.totalHits = json.totalHits ?? null;
    out.topLevelKeys = Object.keys(json);

    // Show what's directly inside queryResult
    if (json.queryResult && typeof json.queryResult === "object") {
      out.queryResultKeys = Object.keys(json.queryResult);
    }

    const hit = findJobArray(json);
    if (hit) {
      out.jobArrayPath = hit.path;
      out.jobsThisPage = hit.arr.length;
      out.firstJobKeys = Object.keys(hit.arr[0]);
      out.sample = hit.arr.slice(0, 3).map(j => ({
        title: j.Title||j.title||j.JobTitle||j.name,
        location: j.Location||j.location||j.City||j.city,
        url: j.Url||j.url||j.ApplyUrl||j.JobUrl||j.jobUrl,
        date: j.PostedDate||j.postedDate||j.Date||j.date
      }));
      out.ok = hit.arr.length > 0;
    } else {
      out.note = "No array of objects found anywhere in response.";
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
