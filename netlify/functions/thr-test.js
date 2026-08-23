// netlify/functions/thr-test.js  (v3 — offset adjustable via URL)
// Hit /.netlify/functions/thr-test?kw=nurse&offset=1   (change offset to test pagination)
exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const kw = q.kw || "nurse";
  const offset = q.offset || "1";
  const limit = q.limit || "50";

  const params = new URLSearchParams();
  params.set("SearchText", kw);
  params.append("facet[]", "ats_portalid:TexasHealth-Taleo-External");
  params.set("boost", "addtnl_categories:0.5,description:0.5,parent_category:0.5,primary_category:0.5,ref:0.5,title:30");
  params.set("Limit", limit);
  params.set("Organization", "2277");
  params.set("offset", offset);
  params.set("useBooleanKeywordSearch", "true");

  const url = `https://jobsapi-internal.m-cloud.io/api/job?${params.toString()}`;
  const out = { sentOffset: offset, sentLimit: limit };

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
    const jobs = Array.isArray(json.queryResult) ? json.queryResult : [];
    out.jobsThisPage = jobs.length;
    out.sample = jobs.slice(0, 3).map(j => ({
      id: j.id,
      title: j.title,
      city: j.primary_city,
      url: j.url
    }));
    out.ok = jobs.length > 0;
  } catch (e) {
    out.fetchError = e.message;
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(out, null, 2)
  };
};
