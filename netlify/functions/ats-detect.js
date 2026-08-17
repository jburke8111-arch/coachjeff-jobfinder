// netlify/functions/ats-detect.js
//
// Deep-probe ATS detection. The browser-side URL match in ats-tools.html
// catches ATSs that wear their identity in the hostname (Workday, Greenhouse,
// Lever, Ashby, SmartRecruiters). This function handles the harder case: custom
// careers front ends (jobs.company.com, careers.company.com) that HIDE the
// underlying ATS. We fetch the page server-side and scan its HTML, headers, and
// — crucially — its "Apply" links for fingerprints, because a custom site
// almost always links out to the real ATS on apply (Dell -> oraclecloud.com,
// Schwab -> icims.com). This is the manual DevTools check, automated.
//
// Returns { key, sampleUrl } where key is the detected ATS (matching the
// registry in ats-tools.html) or null. sampleUrl is any matching ATS link found
// (lets the page parse Workday coordinates from it). Never throws — returns
// { key:null } on any failure so the UI degrades gracefully.

// Order matters: check the most specific / most "hidden-behind-custom" tells.
// Each fingerprint is matched against the page text (lowercased).
const FINGERPRINTS = [
  { key:'workday',        tells:['myworkdayjobs.com','/wday/cxs/'] },
  { key:'oracle',         tells:['/hcmui/candidateexperience','oraclecloud.com','hcmrestapi'] },
  { key:'icims',          tells:['.icims.com','icims.com'] },
  { key:'phenom',         tells:['phenompeople.com','phenom.com','/global/en/'] },
  { key:'successfactors', tells:['successfactors.com','sapsf.com','jobs2web.com','rmkcdn'] },
  { key:'taleo',          tells:['taleo.net'] },
  { key:'brassring',      tells:['brassring.com','kenexa'] },
  { key:'greenhouse',     tells:['greenhouse.io','grnhse'] },
  { key:'lever',          tells:['jobs.lever.co','lever.co'] },
  { key:'ashby',          tells:['ashbyhq.com'] },
  { key:'smartrecruiters',tells:['smartrecruiters.com'] },
];

exports.handler = async function(event){
  const qs = event.queryStringParameters || {};
  let url = (qs.url || '').trim();
  if(!url){ return json(400, { key:null, error:'no url' }); }
  if(!/^https?:\/\//i.test(url)) url = 'https://' + url;

  try {
    const resp = await fetch(url, {
      redirect:'follow',
      headers:{
        'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'en-US,en;q=0.9'
      }
    });

    // Fingerprints can live in the final redirected URL, response headers
    // (CSP often lists the ATS domain), or the page body.
    const finalUrl = (resp.url || url).toLowerCase();
    const csp = (resp.headers.get('content-security-policy') || '').toLowerCase();
    let body = '';
    try { body = (await resp.text()).toLowerCase(); } catch(e){}

    const haystack = finalUrl + '\n' + csp + '\n' + body;

    for(const fp of FINGERPRINTS){
      const hit = fp.tells.find(t => haystack.includes(t));
      if(hit){
        // Try to pull a sample matching URL out of the body so the client can
        // parse coordinates (esp. Workday tenant/wd/site).
        const sampleUrl = findSampleUrl(body, hit) || (finalUrl.includes(hit) ? finalUrl : '');
        return json(200, { key:fp.key, matchedOn:hit, sampleUrl });
      }
    }
    return json(200, { key:null });
  } catch(e){
    return json(200, { key:null, error:String(e && e.message) });
  }
};

// Find a full URL in the body that contains the matched tell, so the client can
// parse it (e.g. a myworkdayjobs.com apply link -> tenant/wd/site).
function findSampleUrl(body, tell){
  try {
    const re = new RegExp('https?:\\/\\/[^"\'\\s<>]*' + tell.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '[^"\'\\s<>]*','i');
    const m = body.match(re);
    return m ? m[0] : '';
  } catch(e){ return ''; }
}

function json(statusCode, obj){
  return {
    statusCode,
    headers:{ 'Content-Type':'application/json', 'Cache-Control':'public, max-age=600' },
    body: JSON.stringify(obj)
  };
}
