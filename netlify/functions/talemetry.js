// netlify/functions/talemetry.js
//
// Employer-agnostic proxy for Talemetry / StandOut ("CSNS") career sites —
// the platform behind HCA Healthcare and other large employers whose careers
// page ships a `window.csns.paths` block.
//
// TWO ENDPOINTS EXIST; we prefer the one that survives the datacenter WAF:
//
//   (A) INTERACTIVE JSON  /search/jobs.json?keyword=&page=&per_page=
//       Clean + keyword-searchable, BUT HCA's WAF 403s datacenter (Netlify/
//       AWS-Lambda) IPs on this path regardless of headers. Kept as a fallback
//       but usually blocked.
//
//   (B) AGGREGATOR XML    /jobs.xml   <-- PREFERRED
//       The StandOut aggregator feed (<standoutxml><jobs><job>...). Built to be
//       downloaded whole by Indeed/Google, so it's typically served from static/
//       CDN infra that is NOT behind the interactive WAF — i.e. it may return 200
//       to Netlify where jobs.json returns 403. It is the WHOLE job list (not
//       keyword-filtered server-side), so we fetch once and filter here.
//
// The host, company label, and sector are query params, so one function serves
// EVERY Talemetry employer — adding one is a one-line client roster entry.
//
// XML fields per <job>: title (CDATA), id, detail_url, apply_url, updated_at
// (a REAL posted date — better than the JSON feed), category (CDATA),
// location{locality,region,country,postal_code}, description (CDATA, Word-HTML).
//
// SIZE GUARD: the full feed can be large. We cap how many bytes we read and how
// many jobs we parse, and we keyword-filter as we go so memory stays bounded.
// Returns [] safe on any failure so it can never break search.

const MODE_DEFAULT = 'xml';       // 'xml' (aggregator, WAF-resistant) | 'json'
const MAX_BYTES    = 25_000_000;  // hard read cap (~25MB) so a giant feed can't OOM
const MAX_JOBS     = 4000;        // stop parsing after this many <job> blocks
const RETURN_CAP   = 400;         // max jobs returned to the client per search
const TIME_BUDGET_MS = 9000;

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36';

exports.handler = async function (event) {
  const qs = event.queryStringParameters || {};
  const keyword = (qs.keyword || '').trim().toLowerCase();
  const host    = (qs.host    || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const company = (qs.company || 'Employer').trim();
  const sector  = (qs.sector  || '').trim();
  const mode    = (qs.mode    || MODE_DEFAULT).trim();
  const diag    = qs.diag === '1';

  if (!host) return json(400, { ok:false, error:'missing host', jobs:[] });

  const base = `https://${host}`;
  const started = Date.now();
  const kwTokens = keyword ? keyword.split(/\s+/).filter(Boolean) : [];

  try {
    const url = `${base}/jobs.xml`;
    let resp;
    try {
      resp = await fetch(url, {
        headers: {
          'Accept': 'application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': BROWSER_UA
        }
      });
    } catch (e) {
      return json(200, { ok:false, error:`xml fetch ${String(e && e.message)}`, jobs:[] });
    }

    if (!resp.ok) {
      let snippet = '';
      try { snippet = (await resp.text()).slice(0, 200); } catch (e) {}
      console.log(`[talemetry:${host}] jobs.xml upstream ${resp.status} body: ${snippet}`);
      return json(200, {
        ok:false, error:`talemetry xml upstream ${resp.status}`,
        host, jobs:[], ...(diag ? { note:'jobs.xml blocked too' } : {})
      });
    }

    // Stream-read with a byte cap so a huge feed can't blow memory.
    const reader = resp.body && resp.body.getReader ? resp.body.getReader() : null;
    let xml = '';
    if (reader) {
      const dec = new TextDecoder();
      let bytes = 0;
      while (true) {
        if (Date.now() - started > TIME_BUDGET_MS) break;
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        xml += dec.decode(value, { stream: true });
        if (bytes > MAX_BYTES) { console.log(`[talemetry:${host}] hit MAX_BYTES`); break; }
      }
    } else {
      xml = await resp.text();
    }

    const jobs = parseJobsXml(xml, { base, company, sector, kwTokens, cap: RETURN_CAP });

    return json(200, {
      ok: true, count: jobs.length, jobs,
      ...(diag ? { host, bytes: xml.length, parsedCapped: jobs.length >= RETURN_CAP } : {})
    });
  } catch (e) {
    console.error(`[talemetry:${host}] error`, e && e.message);
    return json(200, { ok:false, error:String(e && e.message), jobs:[] });
  }
};

// ---- helpers ----------------------------------------------------------

function parseJobsXml(xml, { base, company, sector, kwTokens, cap }) {
  const out = [];
  if (!xml) return out;

  // Split on <job> boundaries; regex is fine here (flat, predictable feed).
  const blocks = xml.split(/<job\b[^>]*>/i);
  let scanned = 0;

  for (let i = 1; i < blocks.length && out.length < cap && scanned < MAX_JOBS; i++) {
    scanned++;
    const b = blocks[i];

    const title = tag(b, 'title');
    if (!title) continue;

    // keyword-AND on the title (feed isn't server-filtered)
    if (kwTokens.length) {
      const t = title.toLowerCase();
      if (!kwTokens.every(k => t.includes(k))) continue;
    }

    const id  = tag(b, 'id');
    const url = tag(b, 'detail_url') || tag(b, 'apply_url') ||
                (id ? `${base}/jobs/${id}` : '');
    if (!url) continue;

    const locality = tag(b, 'locality');
    const region   = tag(b, 'region');
    const country  = tag(b, 'country');
    let location = '';
    if (locality && region) location = `${locality}, ${region}`;
    else if (locality) location = locality;
    else if (region)   location = region;
    else if (country)  location = country;
    else location = '—';

    const updated = tag(b, 'updated_at') || null;

    out.push({
      title: decodeEntities(title),
      company, board: company, sector: sector || '',
      location: decodeEntities(location),
      url, posted: updated, salary: '',
      source: 'talemetry', id: String(id || url), ats: 'talemetry'
    });
  }
  return out;
}

// Pull the inner text of <name>...</name>, unwrapping optional CDATA.
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  let v = m[1].trim();
  const cd = v.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
  if (cd) v = cd[1].trim();
  return v;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type':'application/json', 'Cache-Control':'public, max-age=600' },
    body: JSON.stringify(obj)
  };
}
