// netlify/functions/checkjobs.js
//
// Description-scan function. The browser sends a small list of "suspicious"
// jobs (ambiguous titles like "Operations Associate"). For each, this function
// fetches the job's full description and scans it for disqualifiers, returning
// a verdict: "drop" (clearly non-degree/hourly), "flag" (borderline experience
// requirement), or "ok" (nothing disqualifying found).
//
// No API key needed — these are public job pages.
//
// Called via POST with JSON body: { jobs: [ { id, url, ats, company } , ... ] }
// Returns: { ok: true, verdicts: { "<id>": "drop"|"flag"|"ok", ... } }

// ---- Scan patterns ----------------------------------------------------------

// DROP: clear non-degree / hourly / physical-labor signals.
const DROP_RX = [
  /\bhigh school diploma\b/i,
  /\bg\.?e\.?d\.?\b/i,
  /\bno (college )?degree (is )?required\b/i,
  /\bno degree needed\b/i,
  /\blift (up to )?\d{1,3}\s*(lbs?|pounds)\b/i,
  /\bmust be able to lift\b/i,
  /\bstand (and walk|for (the )?duration|for (long|extended))\b/i,
  /\bon your feet\b/i,
  /\b(1st|2nd|3rd|first|second|third)\s*shift\b/i,
  /\bovernight shift\b/i,
  /\brotating shifts?\b/i,
  /\bvalid (unrestricted )?driver'?s license\b/i,
];

// FLAG: borderline — an experience gate that a new grad may not clear, but the
// role could still be worth showing with a warning.
const FLAG_RX = [
  /\b([3-9]|1[0-9])\+?\s*years?\b/i,               // "3+ years", "5 years"
  /\bminimum (of )?([3-9]|1[0-9])\s*years?\b/i,     // "minimum of 3 years"
  /\b([3-9]|1[0-9])\s*[-–]\s*\d+\s*years?\b/i,      // "3-5 years"
  /\bproven track record\b/i,
  /\bextensive experience\b/i,
];

function scanDescription(text){
  if(!text) return 'ok';
  const t = String(text);
  for(const rx of DROP_RX){ if(rx.test(t)) return 'drop'; }
  for(const rx of FLAG_RX){ if(rx.test(t)) return 'flag'; }
  return 'ok';
}

// Sponsorship signals. NO_SPONSOR (red) beats AVAILABLE (green) beats unknown,
// because an explicit "we do not sponsor" is the decisive fact for a candidate.
const NO_SPONSOR_RX = [
  /\bno (visa |work )?sponsorship\b/i,
  /\bwithout sponsorship\b/i,
  /\b(are |is )?not (able|willing) to sponsor\b/i,
  /\bdo(es)? not (offer|provide) sponsorship\b/i,
  /\bsponsorship is not (available|offered|provided)\b/i,
  /\bunable to (provide|offer|support)\b[^.]*\bsponsor(ship)?\b/i,
  /\bunable to sponsor\b/i,
  /\bmust be (a )?(us|u\.s\.) (citizen|person)\b/i,
  /\bcitizenship (is )?required\b/i,
  /\bmust be authorized to work[^.]*without\b/i,
  /\bno (current or future )?(visa )?sponsorship\b/i,
];
const AVAILABLE_RX = [
  /\bvisa sponsorship (is )?(available|offered|provided)\b/i,
  /\bsponsorship (is )?(available|offered|provided)\b/i,
  /\bwill(ing to)? sponsor\b/i,
  /\bwe sponsor\b/i,
  /\bh-?1b\b/i,
  /\bopt\b/i,
  /\bcpt\b/i,
  /\be-?verify.*sponsor\b/i,
];

function scanSponsorship(text){
  if(!text) return 'unknown';
  const t = String(text);
  for(const rx of NO_SPONSOR_RX){ if(rx.test(t)) return 'none'; }
  for(const rx of AVAILABLE_RX){ if(rx.test(t)) return 'available'; }
  return 'unknown';
}

// ---- Description fetchers ----------------------------------------------------

// Strip HTML tags so we scan plain text.
function stripHtml(html){
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function withTimeout(promise, ms){
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); });
  try { return await Promise.race([promise, timeout]); }
  finally { clearTimeout(t); }
}

// Fetch one job's description text. Handles Greenhouse and Lever job URLs.
async function fetchDescription(job){
  try {
    const url = job.url || '';
    if(!url) return '';

    // Greenhouse individual job JSON: boards-api.greenhouse.io/v1/boards/{co}/jobs/{id}
    // The job.url is usually the public apply URL; we derive the API URL when possible.
    if(job.ats === 'gh' && job.company && job.id){
      const api = `https://boards-api.greenhouse.io/v1/boards/${job.company}/jobs/${job.id}`;
      const r = await withTimeout(fetch(api), 7000);
      if(r.ok){
        const d = await r.json();
        return stripHtml(d && d.content);
      }
    }

    // Lever individual posting JSON: append no special param, Lever hostedUrl
    // has a JSON twin at api.lever.co/v0/postings/{co}/{id}
    if(job.ats === 'lever' && job.company && job.id){
      const api = `https://api.lever.co/v0/postings/${job.company}/${job.id}`;
      const r = await withTimeout(fetch(api), 7000);
      if(r.ok){
        const d = await r.json();
        const parts = [d.descriptionPlain || d.description || ''];
        if(Array.isArray(d.lists)) d.lists.forEach(l => { parts.push(l.text||''); parts.push(l.content||''); });
        return stripHtml(parts.join(' '));
      }
    }

    // Fallback: fetch the public page and scan its raw text.
    const r = await withTimeout(fetch(url), 7000);
    if(r.ok){
      const html = await r.text();
      return stripHtml(html);
    }
  } catch(e){ /* ignore, treat as unknown */ }
  return '';
}

// ---- Handler ----------------------------------------------------------------

export default async (request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if(request.method === 'OPTIONS'){
    return new Response('', { status: 204, headers: cors });
  }

  try {
    const body = await request.json();
    const jobs = (body && Array.isArray(body.jobs)) ? body.jobs : [];
    // When the user has ticked "Work Authorization Requirements", the browser
    // sends checkSponsorship:true and a larger job list (all results, not just
    // suspicious titles). We raise the cap in that case so coverage is thorough.
    const checkSponsorship = !!(body && body.checkSponsorship);
    const cap = checkSponsorship ? 60 : 30;

    const toCheck = jobs.slice(0, cap);

    const verdicts = {};      // id -> "drop" | "flag" | "ok"
    const sponsorship = {};   // id -> "available" | "none" | "unknown"
    const BATCH = 8;
    for(let i = 0; i < toCheck.length; i += BATCH){
      const slice = toCheck.slice(i, i + BATCH);
      const results = await Promise.all(slice.map(async (job) => {
        const desc = await fetchDescription(job);
        const verdict = desc ? scanDescription(desc) : 'ok';
        const sp = (checkSponsorship && desc) ? scanSponsorship(desc) : 'unknown';
        return { id: job.id, verdict, sp };
      }));
      results.forEach(r => {
        if(r.id != null){
          verdicts[r.id] = r.verdict;
          if(checkSponsorship) sponsorship[r.id] = r.sp;
        }
      });
    }

    return new Response(JSON.stringify({ ok: true, verdicts, sponsorship }), { status: 200, headers: cors });
  } catch(err){
    // On any failure, return empty verdicts so the browser just shows everything
    // (fail-open: never hide jobs because the checker had a problem).
    return new Response(JSON.stringify({ ok: false, verdicts: {}, error: String(err && err.message || err) }), { status: 200, headers: cors });
  }
};
