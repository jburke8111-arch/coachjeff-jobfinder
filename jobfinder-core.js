
async function withTimeout(promise, ms){
  let t;
  const timeout = new Promise((_,rej)=>{ t=setTimeout(()=>rej(new Error('timeout')), ms); });
  try { return await Promise.race([promise, timeout]); }
  finally { clearTimeout(t); }
}

// Legacy direct Greenhouse board fetch disabled.
// Greenhouse results now come through /.netlify/functions/greenhouse.
// NOTE: Greenhouse is NOT fetched per-company here. All Greenhouse roles
// come from the serverless /greenhouse function via fetchGreenhouseAPI(),
// which is faster (one server call vs. ~50 browser requests) and returns
// clean records with id/url/ats. The board loop in search() only processes
// ats:'lever' companies, so this function is never reached in normal use.
// It is kept only so fetchBoardResilient's branch stays valid. If a future
// change ever routes a gh company here, we warn loudly instead of silently
// returning nothing (which would look like a healthy empty board).
async function fetchGreenhouse(c){
  console.warn('[jobfinder] fetchGreenhouse(c) called for "'+(c&&c.slug)+'" — Greenhouse should go through fetchGreenhouseAPI(), not the per-company board loop. Returning [].');
  return [];
}
async function fetchLever(c){
  const url = `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
  const r = await fetch(url);
  if(!r.ok) throw new Error('lever '+c.slug);
  const d = await r.json();
  return (d||[]).map(j=>({
    title:j.text, company:c.slug, sector:c.sector,
    location:(j.categories&&j.categories.location)||'—',
    url:j.hostedUrl, posted:j.createdAt||null,
    id:j.id, ats:'lever'
  }));
}

// Fetch one board with a longer timeout and a single retry, so slow/flaky
// boards aren't silently dropped from results. Resolves to [] on failure
// rather than throwing, so one bad board never aborts the run.
// Fetch federal jobs from our own Netlify serverless function (USAJobs).
// The function holds the API key server-side. Returns [] on any failure
// so it never breaks the rest of the search.
async function fetchUSAJobs(keyword, location){
  try {
    const params = new URLSearchParams();
    if(keyword) params.set('keyword', keyword);
    if(location) params.set('location', location);
    const resp = await fetch('/.netlify/functions/usajobs?' + params.toString());
    if(!resp.ok) return [];
    const data = await resp.json();
    return (data && data.ok && Array.isArray(data.jobs)) ? data.jobs : [];
  } catch(e){
    return [];
  }
}


// Fetch broader public job postings from Adzuna through our Netlify function.
// The function keeps ADZUNA_APP_ID and ADZUNA_APP_KEY server-side.
// Returns [] on any failure so Adzuna never breaks the rest of the search.
async function fetchAdzuna(keyword, location){
  try {
    const params = new URLSearchParams();
    if(keyword) params.set('keyword', keyword);
    if(location) params.set('location', location);
    const resp = await fetch('/.netlify/functions/adzuna?' + params.toString());
    if(!resp.ok) return [];
    const data = await resp.json();
    return (data && data.ok && Array.isArray(data.jobs)) ? data.jobs : [];
  } catch(e){
    return [];
  }
}

// IBM Phase 2 — live discovery through the Job Finder's existing licensed/public
// job-data sources. IBM's own Avature SearchJobs endpoint is bot-protected, so we
// do not scrape it. Instead, when IBM is explicitly selected, run an IBM-biased
// Adzuna query and retain only jobs whose returned employer is actually IBM.
// The official IBM Entry-Level search remains visible as the authoritative fallback.
function isIBMEmployerName(name){
  const n = normalizeForSearch(name || '');
  return n === 'ibm'
    || n.startsWith('ibm ')
    || n.includes('international business machines');
}

async function fetchIBMViaAdzuna(keyword, location){
  try {
    const queries = [];
    if(keyword) queries.push(keyword);
    queries.push(keyword ? `IBM ${keyword}` : 'IBM');
    const lists = await Promise.all(queries.map(q => fetchAdzuna(q, location)));
    const merged = lists.flat().filter(j => isIBMEmployerName(j && j.company));
    const seen = new Set();
    return merged.filter(j => {
      const key = ((j.url || '') + '|' + (j.title || '') + '|' + (j.location || '')).toLowerCase();
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch(e){
    return [];
  }
}

// Fetch Ashby-hosted job boards through our Netlify function.
// No API key is needed; the function queries public Ashby job-board endpoints.
// Returns [] on any failure so Ashby never breaks the rest of the search.
async function fetchAshby(keyword, location){
  try {
    const params = new URLSearchParams();
    if(keyword) params.set('keyword', keyword);
    if(location) params.set('location', location);
    const resp = await fetch('/.netlify/functions/ashby?' + params.toString());
    if(!resp.ok) return [];
    const data = await resp.json();
    return (data && data.ok && Array.isArray(data.jobs)) ? data.jobs : [];
  } catch(e){
    return [];
  }
}

// Fetch SmartRecruiters-hosted roles through our Netlify function.
// No API key is needed; the function queries public SmartRecruiters endpoints.
// Returns [] on any failure so SmartRecruiters never breaks the rest of the search.
async function fetchSmartRecruiters(keyword, location){
  try {
    const params = new URLSearchParams();
    if(keyword) params.set('keyword', keyword);
    if(location) params.set('location', location);
    const resp = await fetch('/.netlify/functions/smartrecruiters?' + params.toString());
    if(!resp.ok) return [];
    const data = await resp.json();
    return (data && data.ok && Array.isArray(data.jobs)) ? data.jobs : [];
  } catch(e){
    return [];
  }
}

// Fetch early-career roles from The Muse through our Netlify function.
// The Muse is a broad source (like Adzuna): one API returns roles from hundreds
// of employers, no per-company slug discovery. The function maps the keyword to
// Muse categories, sweeps Entry Level + Internship levels, and keyword-filters
// server-side. No API key is required; a registered THEMUSE_API_KEY just raises
// the rate limit. Returns [] on any failure so The Muse never breaks the search.
async function fetchTheMuse(keyword, location){
  try {
    const params = new URLSearchParams();
    if(keyword) params.set('keyword', keyword);
    if(location) params.set('location', location);
    const resp = await fetch('/.netlify/functions/themuse?' + params.toString());
    if(!resp.ok) return [];
    const data = await resp.json();
    if(!(data && data.ok && Array.isArray(data.jobs))) return [];
    return data.jobs
      .filter(j => j && j.url)
      .map(j => ({
        title: j.title || 'Untitled role',
        company: j.company || j.board || 'Employer',
        board: j.board || '',
        sector: j.sector || '',
        location: j.location || '—',
        url: j.url,
        posted: j.posted || null,
        salary: j.salary || '',
        source: 'themuse',
        id: (j.id != null ? j.id : ('muse-' + (j.url||''))),
        ats: 'muse'
      }));
  } catch(e){
    return [];
  }
}

// Fetch National Labor Exchange roles via CareerOneStop (U.S. DOL) through our
// Netlify function. The function keeps COS_USERID and COS_TOKEN server-side and
// calls the v1 "List Jobs" API (api.careeronestop.org/v1/jobsearch). COS data
// carries a mandatory attribution requirement (DOLETA + Minnesota DEED) — the
// footer/note text on the page satisfies it. Returns [] on any failure so
// CareerOneStop never breaks the rest of the search.
async function fetchCareerOneStop(keyword, location){
  try {
    const params = new URLSearchParams();
    if(keyword) params.set('keyword', keyword);
    if(location) params.set('location', location);
    const resp = await fetch('/.netlify/functions/careeronestop?' + params.toString());
    if(!resp.ok) return [];
    const data = await resp.json();
    if(!(data && data.ok && Array.isArray(data.jobs))) return [];
    return data.jobs
      .filter(j => j && j.url)
      .map(j => ({
        title: j.title || 'Untitled role',
        company: j.company || 'Employer',
        board: j.board || '',
        sector: j.sector || '',
        location: j.location || '—',
        url: j.url,
        posted: j.posted || null,
        salary: j.salary || '',
        source: 'careeronestop',
        id: (j.id != null ? j.id : ('cos-' + (j.url||''))),
        ats: 'cos'
      }));
  } catch(e){
    return [];
  }
}

// Fetch CareerBuilder-CWS employers (e.g. Texas Health Resources) via our
// /mcloud function. That endpoint (jobsapi-internal.m-cloud.io) is CareerBuilder's
// shared, key-free JSON API, keyed by Organization + ats_portalid facet — one
// function serves every CareerBuilder-CWS employer in the server-side roster.
// Descriptions arrive inline (excluded from checkjobs enrichment, like Muse/Adzuna).
// Returns [] on any failure so it never breaks the rest of the search.
async function fetchMCloud(keyword, location){
  try {
    const params = new URLSearchParams();
    if(keyword) params.set('q', keyword);
    if(location) params.set('location', location);
    const resp = await fetch('/.netlify/functions/mcloud?' + params.toString());
    if(!resp.ok) return [];
    const data = await resp.json();
    if(!(data && Array.isArray(data.jobs))) return [];
    return data.jobs
      .filter(j => j && j.url)
      .map(j => ({
        title: j.title || 'Untitled role',
        company: j.company || 'Employer',
        board: j._employer || j.company || '',
        sector: j.category || '',
        location: j.location || '—',
        url: j.url,
        posted: j.postedDate || null,
        salary: j.salary || '',
        source: 'mcloud',
        id: (j.id != null ? j.id : ('mcloud-' + (j.url||''))),
        ats: 'cbcws'
      }));
  } catch(e){
    return [];
  }
}

// Fetch Phenom People employers (e.g. Memorial Hermann, Baylor Scott & White)
// via our /phenom function. Phenom powers a large share of hospital systems and
// national employers; one function serves every employer in the server-side
// roster. Selection is location-aware (regional employers query when the user's
// location matches; nationals always). descriptionTeaser is inline (no enrich).
// Returns [] on any failure so it never breaks the rest of the search.
async function fetchPhenom(keyword, location){
  try {
    const params = new URLSearchParams();
    if(keyword) params.set('q', keyword);
    if(location) params.set('location', location);
    const resp = await fetch('/.netlify/functions/phenom?' + params.toString());
    if(!resp.ok) return [];
    const data = await resp.json();
    if(!(data && Array.isArray(data.jobs))) return [];
    return data.jobs
      .filter(j => j && j.url)
      .map(j => ({
        title: j.title || 'Untitled role',
        company: j.company || 'Employer',
        board: j.board || j.company || '',
        sector: j.sector || '',
        location: j.location || '—',
        url: j.url,
        posted: j.posted || null,
        salary: j.salary || '',
        source: 'phenom',
        id: (j.id != null ? j.id : ('phenom-' + (j.url||''))),
        ats: 'phenom'
      }));
  } catch(e){
    return [];
  }
}

// ---- Workday-hosted employers -------------------------------------------
// Workday powers the careers site of a huge share of large employers. Every
// Workday tenant is backed by the same JSON endpoint, so ONE Netlify function
// (/workday) serves them all — each employer is just a config row here with
// its tenant, data-center number (wd), and site path. Coordinates are read
// once off the employer's {tenant}.wd{N}.myworkdayjobs.com/{site} URL.
//
// To add an employer: confirm it's really Workday (many big employers use
// Phenom/iCIMS/Taleo instead), grab the three coordinates from its careers
// URL, test via /.netlify/functions/workday?tenant=..&wd=..&site=.. , then
// add a row below. Location is NOT sent to Workday (its location facets are
// opaque per-tenant); we pull by keyword and let the page's own location
// filter narrow the merged results — same as the other API sources.

// Fetch one Workday employer through our /workday function. Returns [] on any
// failure so a single dead/slow tenant never breaks the sweep.
async function fetchWorkdayEmployer(emp, keyword){
  try {
    const params = new URLSearchParams();
    if(keyword) params.set('keyword', keyword);
    params.set('tenant',  emp.tenant);
    params.set('wd',      emp.wd);
    params.set('site',    emp.site);
    params.set('company', emp.name);
    if(emp.sector) params.set('sector', emp.sector);
    const resp = await fetch('/.netlify/functions/workday?' + params.toString());
    if(!resp.ok) return [];
    const data = await resp.json();
    if(!(data && data.ok && Array.isArray(data.jobs))) return [];
    return data.jobs
      .filter(j => j && j.url)
      .map(j => ({
        title:    j.title    || 'Untitled role',
        company:  j.company  || emp.name,
        board:    j.board    || emp.name,
        sector:   j.sector   || emp.sector || '',
        location: j.location || '—',
        url:      j.url,
        posted:   j.posted   || null,
        salary:   j.salary   || '',
        source:   'workday',
        id:       (j.id != null ? j.id : ('wd-' + (j.url||''))),
        ats:      'workday'
      }));
  } catch(e){
    return [];
  }
}

// Sweep all configured Workday employers in parallel and merge. Matches the
// (keyword, location) signature of the other API sources so it slots into the
// apiSource() array unchanged; location is applied later by the shared filter.
async function fetchWorkday(keyword, location){
  try {
    // If the user picked a specific Workday employer from the Company dropdown,
    // sweep only that one; otherwise sweep them all. The dropdown value is the
    // employer's "wd-"-prefixed slug (see WORKDAY_EMPLOYERS), which never
    // collides with the Lever/manual company slugs.
    const sel = (document.getElementById('company') || {}).value || 'any';
    const list = (sel !== 'any')
      ? WORKDAY_EMPLOYERS.filter(emp => emp.slug === sel)
      : WORKDAY_EMPLOYERS;
    const batches = await Promise.all(
      list.map(emp => fetchWorkdayEmployer(emp, keyword))
    );
    return batches.flat();
  } catch(e){
    return [];
  }
}

// Fetch Greenhouse-hosted roles through our Netlify function.
// Keeps Greenhouse calls server-side and avoids dozens of browser requests.
// The serverless function returns clean records today; the mapping below is
// defensive so that if any future record arrives missing a field, it can't
// render a broken/dead-link card. Records with no usable apply URL are dropped.
// Fetch Lever jobs from our own serverless /lever function, which sweeps a
// curated board list server-side (mirrors fetchGreenhouseAPI / fetchAshby).
// This is SEPARATE from the older fetchLever(c) above, which was the per-company
// client-side sweep over ats:'lever' entries in COMPANIES — that list is now
// empty, so this function is where Lever coverage actually comes from.
// Returns [] on any failure so it never breaks the rest of the search.
async function fetchLeverAPI(keyword, location){
  try {
    const params = new URLSearchParams();
    if(keyword) params.set('keyword', keyword);
    if(location) params.set('location', location);
    const resp = await fetch('/.netlify/functions/lever?' + params.toString());
    if(!resp.ok) return [];
    const data = await resp.json();
    if(!(data && data.ok && Array.isArray(data.jobs))) return [];
    return data.jobs
      .filter(j => j && j.url)
      .map(j => ({
        title: j.title || 'Untitled role',
        company: j.company || j.board || 'Employer',
        board: j.board || '',
        sector: j.sector || '',
        location: j.location || '—',
        url: j.url,
        posted: j.posted || null,
        salary: j.salary || '',
        source: 'lever',
        id: (j.id != null ? j.id : ('lv-' + (j.board||'') + '-' + (j.url||''))),
        ats: 'lv',
        minYears: j.minYears,
        yearsPreferred: j.yearsPreferred,
        expFlag: j.expFlag
      }));
  } catch(e){
    return [];
  }
}

async function fetchGreenhouseAPI(keyword, location){
  try {
    const params = new URLSearchParams();
    if(keyword) params.set('keyword', keyword);
    if(location) params.set('location', location);
    const resp = await fetch('/.netlify/functions/greenhouse?' + params.toString());
    // A failed request is NOT the same as "no matches". Record it so the status
    // line can distinguish a Greenhouse outage from a genuine zero — the old
    // silent `return []` is exactly what hid the broad-query timeout bug for
    // as long as it was happening.
    if(!resp.ok){ window._ghFailed = true; return []; }
    const data = await resp.json();
    if(!(data && data.ok && Array.isArray(data.jobs))){ window._ghFailed = true; return []; }
    // When the server's board sweep was cut short by its time budget, these are
    // partial results. Remember it so the UI can note the source was incomplete
    // rather than implying it found everything.
    if(data.complete === false){
      window._ghPartial = { covered: data.boardsCovered, total: data.boardsTotal };
    }
    return data.jobs
      .filter(j => j && j.url)                       // no apply link => unusable, skip
      .map(j => ({
        title: j.title || 'Untitled role',
        company: j.company || j.board || 'Employer',
        board: j.board || '',
        sector: j.sector || '',
        location: j.location || '—',
        url: j.url,
        posted: j.posted || null,
        salary: j.salary || '',
        source: 'greenhouse',
        id: (j.id != null ? j.id : ('gh-' + (j.board||'') + '-' + (j.url||''))),
        ats: 'gh'
      }));
  } catch(e){
    return [];
  }
}


async function fetchBoardResilient(c){
  const doFetch = ()=> withTimeout(c.ats==='gh' ? fetchGreenhouse(c) : fetchLever(c), 15000);
  try {
    return {ok:true, jobs: await doFetch()};
  } catch(e){
    try {
      await new Promise(r=>setTimeout(r, 300));   // brief pause, then one retry
      return {ok:true, jobs: await doFetch()};
    } catch(e2){
      return {ok:false, jobs: []};
    }
  }
}

// Relevance score for the "Most relevant" sort and the "high-priority lead" badge.
// Higher = more relevant to an early-career / new-grad job seeker.
// Tuned so a strong, clearly-entry-level, keyword-and-location matching role
// lands at >= 6 (the badge threshold).

