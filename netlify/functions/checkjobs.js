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

// ===========================================================================
// DUPLICATED CODE — keep in sync with netlify/functions/ashby.js
// ===========================================================================
// experienceRequirement() and its two helpers are logically identical to the
// copy in ashby.js (comments differ; behavior is verified equivalent). They
// live in both files rather than a shared module because the functions
// directory is flat and there's no package.json / netlify.toml declaring module
// resolution — adding one is a separate change, not a rider on this feature.
// If you edit either copy, edit both. The test cases live with the ashby.js
// copy.
//
// Ashby can call this on its board response directly (descriptionPlain ships in
// the same payload). Greenhouse/Lever need a per-job fetch, which is why this
// copy runs here instead.
// ===========================================================================

const SOFT_RX = /\b(preferred|preferable|a plus|nice[- ]to[- ]have|desired|ideally|bonus|would be great|not required)\b/;

// Sentences describing company age / tenure / durations that are NOT a
// candidate experience requirement. A "N years" inside one of these must never
// set minYears. This is the single biggest source of false "senior" mis-tiers:
// "serving customers for 20 years" on an entry-level role would otherwise
// report a 20-year requirement and bury the job in the caution tier.
const NON_REQ_CONTEXT_RX = /\b(in business|founded|established|since \d{4}|for (over |more than )?\d+ years,|years in (business|operation|the (industry|market))|year history|years of combined|years running|anniversary|our (\d+|history)|track record spanning|serving (customers|clients)|over the (past|last)|in the past|ago\b|warranty|lease|term of|per year|years old|age of|years of age)\b/;

// Spelled-out small numbers, so "at least three years" is caught, not read as 0.
const WORD_NUM = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };

// Isolate the sentence/clause a match sits in (not a blind char window), so a
// softener attached to a DIFFERENT requirement in the same paragraph ("3 years
// required. Master's preferred.") doesn't wrongly soften this one.
function matchSentence(haystack, index, matchLen){
  const before = haystack.slice(0, index);
  const after  = haystack.slice(index + matchLen);
  const sentStart = Math.max(before.lastIndexOf('. '), before.lastIndexOf('\n'),
                             before.lastIndexOf('; '), before.lastIndexOf('\u2022'));
  const relEnd = after.search(/[.\n;\u2022]/);
  const sentEnd = relEnd === -1 ? haystack.length : index + matchLen + relEnd;
  return haystack.slice(Math.max(0, sentStart + 1), sentEnd);
}

function isSoftened(haystack, index, matchLen){
  return SOFT_RX.test(matchSentence(haystack, index, matchLen));
}

function inNonReqContext(haystack, index, matchLen){
  return NON_REQ_CONTEXT_RX.test(matchSentence(haystack, index, matchLen));
}

// Fold one candidate "N years" figure into the running max, unless it's noise
// (out of range, or sitting in company-age boilerplate). Tracks whether the
// figure that SET the max was softened — that binding-requirement softness is
// what the tier label reads, per the Early-Career Experience Equivalency Guide.
function considerYears(original, n, index, matchLen, state){
  if(n <= 0 || n > 15) return;                       // 0 = none; >15 = "20 years in business" noise
  if(inNonReqContext(original, index, matchLen)) return;
  if(n > state.max){ state.max = n; state.soft = isSoftened(original, index, matchLen); }
}

// Returns { minYears, preferred }. See the guide note above for why `preferred`
// is tracked per-binding-match rather than "does the word appear anywhere".
function experienceRequirement(text){
  if(!text) return { minYears: 0, preferred: false };
  const original = String(text).toLowerCase();
  let t = original;
  const state = { max: 0, soft: false };

  // Spelled-out numbers: scan the ORIGINAL so offsets line up for context checks.
  const spelled = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*\+?\s*years?\b/g;
  let sm;
  while((sm = spelled.exec(original)) !== null){
    considerYears(original, WORD_NUM[sm[1]], sm.index, sm[0].length, state);
  }

  // Ranges FIRST: "2-4 years", "2 to 4 years", "2\u20134 years" -> the low end (2).
  // Each match is blanked so the single-value pass below can't re-match the
  // range's tail ("4 years") and overstate the requirement.
  const range = /\b(\d{1,2})\s*(?:-|\u2013|\u2014|to)\s*\d{1,2}\s*\+?\s*years?\b/g;
  t = t.replace(range, (full, low, offset) => {
    considerYears(original, parseInt(low, 10), offset, full.length, state);
    return " ".repeat(full.length);   // keep offsets aligned for the pass below
  });

  // Single values: "3+ years", "minimum 3 years", "at least 5 years".
  const single = /\b(?:minimum(?: of)?\s*|at least\s*)?(\d{1,2})\s*\+?\s*years?\b/g;
  let m;
  while((m = single.exec(t)) !== null){
    considerYears(original, parseInt(m[1], 10), m.index, m[0].length, state);
  }

  return { minYears: state.max, preferred: state.max > 0 && state.soft };
}

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
//
// NOTE: this is now a BACKSTOP, not the primary signal. experienceRequirement()
// above extracts an actual number, which the client turns into a tier label.
// These patterns still run because they catch the wordy gates that carry no
// number ("proven track record"), and because they apply to untrusted scraped
// text where a number can't be trusted. The numeric patterns start at 2 rather
// than 3 to match the parser — the old floor of 3 meant a "2-4 years" posting
// (the Scrunch AI Search Analyst case) came back 'ok' with no warning at all.
const FLAG_RX = [
  /\b([2-9]|1[0-9])\+?\s*years?\b/i,               // "2+ years", "5 years"
  /\bminimum (of )?([2-9]|1[0-9])\s*years?\b/i,     // "minimum of 3 years"
  /\b([2-9]|1[0-9])\s*[-–]\s*\d+\s*years?\b/i,      // "2-4 years", "3-5 years"
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
//
// Returns { text, trusted }. `trusted` is true only when the text came from a
// structured API field that contains the job description and nothing else.
//
// WHY THIS MATTERS FOR YEARS-PARSING: the fallback path below scrapes a public
// HTML page and strips every tag, so the text includes nav, footer, cookie
// banners, "About us — 20 years in business", and often other job listings.
// A boolean scan tolerates that noise (a false 'flag' is cheap). But
// experienceRequirement() returns a NUMBER and takes the max, so one stray
// "8 years" in a footer would report an 8-year requirement on an entry-level
// role. Untrusted text therefore yields minYears: null (= not scanned) rather
// than a number we'd be guessing at.
async function fetchDescription(job){
  try {
    const url = job.url || '';
    if(!url) return { text: '', trusted: false };

    // Greenhouse individual job JSON: boards-api.greenhouse.io/v1/boards/{co}/jobs/{id}
    // The job.url is usually the public apply URL; we derive the API URL when possible.
    if(job.ats === 'gh' && (job.board || job.company) && job.id){
      const slug = job.board || job.company;
      const api = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${job.id}`;
      const r = await withTimeout(fetch(api), 7000);
      if(r.ok){
        const d = await r.json();
        return { text: stripHtml(d && d.content), trusted: true };
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
        return { text: stripHtml(parts.join(' ')), trusted: true };
      }
    }

    // Fallback: fetch the public page and scan its raw text. Good enough for
    // the boolean drop/flag scans, NOT good enough to extract a number from.
    const r = await withTimeout(fetch(url), 7000);
    if(r.ok){
      const html = await r.text();
      return { text: stripHtml(html), trusted: false };
    }
  } catch(e){ /* ignore, treat as unknown */ }
  return { text: '', trusted: false };
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
    // How many the browser asked us to check but we didn't get to. The client
    // surfaces this: a student must be able to tell an unverified role from a
    // verified one, and silently truncating makes those two look identical.
    const skipped = Math.max(0, jobs.length - toCheck.length);

    const verdicts = {};      // id -> "drop" | "flag" | "ok"
    const sponsorship = {};   // id -> "available" | "none" | "unknown"
    const experience = {};    // id -> { minYears, preferred } | omitted if unscannable
    const BATCH = 8;
    for(let i = 0; i < toCheck.length; i += BATCH){
      const slice = toCheck.slice(i, i + BATCH);
      const results = await Promise.all(slice.map(async (job) => {
        const { text: desc, trusted } = await fetchDescription(job);
        const verdict = desc ? scanDescription(desc) : 'ok';
        const sp = (checkSponsorship && desc) ? scanSponsorship(desc) : 'unknown';
        // Only parse a years-figure out of structured API text. See the note on
        // fetchDescription() for why scraped page text is excluded.
        const exp = (desc && trusted) ? experienceRequirement(desc) : null;
        return { id: job.id, verdict, sp, exp };
      }));
      results.forEach(r => {
        if(r.id != null){
          verdicts[r.id] = r.verdict;
          if(checkSponsorship) sponsorship[r.id] = r.sp;
          if(r.exp) experience[r.id] = r.exp;
        }
      });
    }

    return new Response(JSON.stringify({
      ok: true, verdicts, sponsorship, experience,
      scanned: toCheck.length, skipped
    }), { status: 200, headers: cors });
  } catch(err){
    // On any failure, return empty verdicts so the browser just shows everything
    // (fail-open: never hide jobs because the checker had a problem).
    return new Response(JSON.stringify({ ok: false, verdicts: {}, error: String(err && err.message || err) }), { status: 200, headers: cors });
  }
};
