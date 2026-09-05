// netlify/functions/workday.js
//
// Tenant-agnostic proxy for Workday-hosted career sites.
//
// Every public Workday career site is a single-page app backed by the same
// internal JSON endpoint its own search box calls:
//
//     POST https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
//     Content-Type: application/json
//     body: { appliedFacets:{}, limit:20, offset:0, searchText:"..." }
//
// One function serves EVERY Workday employer — the tenant, data-center
// number (wd{N}), and site path are passed in as query params, so adding a
// new employer is a one-line config entry on the client, not new code here.
//
// KNOWN WORKDAY QUIRKS (handled below):
//   * It's a POST, not a GET. The body must include appliedFacets/limit/
//     offset/searchText even when empty.
//   * The list pages at 20. Asking for limit>20 silently returns 0 jobs
//     with HTTP 200 — so we page in 20s, never in one big request.
//   * Data centers differ (wd1, wd3, wd5, wd503...). We take it as a param;
//     never assume a number.
//   * Locations are unstructured free text ("Remote - US", "Plano, TX",
//     sometimes ""). We pass them through and let the client's location
//     filter handle matching.
//   * The list gives a relative externalPath, not a full apply URL. We join
//     it to the site base to build a real, openable link.
//   * Real posted dates require a per-job detail call; the list only gives a
//     relative "postedOn" ("Posted 5 Days Ago"). We DON'T make 2,000 extra
//     calls — posted is left null and the client just won't show a date.
//
// THE OPEN QUESTION THIS FUNCTION EXISTS TO ANSWER (Phase 1 / go-no-go):
// Workday sits behind Cloudflare on some tenants and may 403 a datacenter
// (Netlify) request the same way American Airlines did. We send browser-like
// headers to give it the best shot, and log the upstream status + a body
// snippet on failure so the deploy log tells us plainly: JSON (works) or
// 403 (blocked). Returns [] safe on any failure so it can never break search.

const MAX_PAGES = 3;   // 3 x 20 = up to 60 roles per employer per search
const PAGE_SIZE = 20;  // Workday's hard per-page cap; do not raise

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36';

exports.handler = async function (event) {
  const qs = event.queryStringParameters || {};
  const keyword  = (qs.keyword  || '').trim();
  const tenant   = (qs.tenant   || '').trim();
  const wd       = (qs.wd       || '').trim();   // just the number: "1","5","503"
  const site     = (qs.site     || '').trim();

  // Company/sector are cosmetic labels for the normalized record; optional.
  const company  = (qs.company  || tenant || 'Employer').trim();
  const sector   = (qs.sector   || '').trim();

  if (!tenant || !wd || !site) {
    return json(400, {
      ok: false,
      error: 'missing tenant/wd/site',
      jobs: []
    });
  }

  const base     = `https://${tenant}.wd${wd}.myworkdayjobs.com`;
  const endpoint = `${base}/wday/cxs/${tenant}/${site}/jobs`;

  try {
    let all = [];
    let loggedShape = false;
    let total = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      const body = {
        appliedFacets: {},
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        searchText: keyword
      };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': base,
          'Referer': `${base}/${site}`,
          'User-Agent': BROWSER_UA
        },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        let snippet = '';
        try { snippet = (await resp.text()).slice(0, 200); } catch (e) {}
        // This log line is the Phase-1 answer: 403 = Cloudflare block,
        // anything else = a fixable hiccup.
        console.log(`[workday:${tenant}] upstream ${resp.status} body: ${snippet}`);
        if (page === 0) {
          return json(502, {
            ok: false,
            error: `workday upstream ${resp.status}`,
            tenant, wd, site,
            jobs: []
          });
        }
        break;
      }

      const data = await resp.json();
      const postings = Array.isArray(data.jobPostings) ? data.jobPostings : [];
      if (total == null && typeof data.total === 'number') total = data.total;

      if (!loggedShape && postings.length) {
        console.log(
          `[workday:${tenant}] first posting keys: ` +
          JSON.stringify(Object.keys(postings[0]))
        );
        console.log(
          `[workday:${tenant}] first posting sample: ` +
          JSON.stringify(postings[0]).slice(0, 500)
        );
        loggedShape = true;
      }

      if (!postings.length) break;

      all = all.concat(
        postings.map(p => mapPosting(p, base, site, company, sector)).filter(Boolean)
      );

      // Reached the end of the board?
      if (postings.length < PAGE_SIZE) break;
      if (total != null && (page + 1) * PAGE_SIZE >= total) break;
    }

    // De-dupe by apply URL.
    const seen = new Set();
    const jobs = all.filter(j => {
      if (seen.has(j.url)) return false;
      seen.add(j.url);
      return true;
    });

    return json(200, { ok: true, count: jobs.length, total, jobs });
  } catch (e) {
    console.error(`[workday:${tenant}] error`, e && e.message);
    return json(200, { ok: false, error: String(e && e.message), jobs: [] });
  }
};

// ---- helpers ----------------------------------------------------------

// Sub-degree exclusion (ported from mcloud.js / oracle.js). Jeff's audience is
// degree-seekers, so drop roles whose credential is BELOW a bachelor's —
// LVN/LPN/CNA/medical-assistant/phlebotomy/surg-tech/EMT/patient-care-tech/
// pharmacy-tech, etc. Workday's LIST endpoint gives only the title (no
// description), so this is a title-only gate — which is what SUBDEGREE_TITLE
// keys on anyway. "associate" is deliberately NOT blocked so associate-degree
// nursing (ADN/RN) survives; DEGREE_REQ_RX protects any title that names a
// bachelor's+ credential or RN/registered-nurse/new-grad/residency.
const SUBDEGREE_TITLE_RX = /\b(lvn|licensed vocational nurse|lpn|licensed practical nurse|cna|certified nursing assistant|nurse aide|nursing assistant|nurse tech(nician)?|nurse extern|student nurse|patient care (tech|technician|assistant)|pct\b|pca\b|medical assistant|\bma\b|phlebotom(y|ist)|\bemt\b|paramedic|emergency (department )?tech(nician)?|\bed tech(nician)?\b|surgical tech(nologist|nician)?|surg tech|sterile process(ing)?|monitor tech|telemetry tech|pharmacy tech(nician)?|\bcpht\b|dental assistant|home health aide|\bhha\b|caregiver|orderly|dietary aide|environmental services?|\bevs\b|housekeep|transporter|\bscribe\b|care partner|health unit coordinator|unit secretary|\bcma\b|anesthesia tech(nician)?|endoscop(y|ic) tech(nician)?)\b/i;

// A title that names a bachelor's+ credential or RN/new-grad survives even if a
// sub-degree word appears incidentally (e.g. "Nurse Practitioner supervising CNAs").
const DEGREE_REQ_RX = /\b(bachelor|baccalaureate|\bbsn\b|\bbs\b|\bba\b|master|\bmsn\b|\bmba\b|doctora|\bphd\b|\bmd\b|degree required|\brn\b|registered nurse|new grad|new-grad|residency|resident|fellow)\b/i;

function isSubDegreeTitle(title) {
  const t = String(title || '');
  return SUBDEGREE_TITLE_RX.test(t) && !DEGREE_REQ_RX.test(t);
}

function mapPosting(p, base, site, company, sector) {
  if (!p || typeof p !== 'object') return null;

  // externalPath is relative to the SITE, not the domain root — e.g.
  // "/job/Plano-Texas/Analyst_10309904". A valid apply URL is therefore
  // {base}/{site}{externalPath}:
  //   https://toyota.wd5.myworkdayjobs.com/TMNA/job/Plano-Texas/Analyst_10309904
  // Joining base+path directly (dropping the site segment) produces a URL
  // Workday can't resolve, and it redirects to community.workday.com/invalid-url
  // ("Page not found"). Inserting the site segment is what makes links work.
  const path = p.externalPath || p.externalUrl || '';
  if (!path) return null;
  const url = /^https?:\/\//i.test(path)
    ? path
    : base + '/' + site + (path.startsWith('/') ? '' : '/') + path;

  const title = p.title || p.jobPostingTitle || 'Untitled role';

  // Sub-degree gate: drop below-bachelor's clinical/support roles for the
  // degree-seeking audience (returns null → dropped by the caller's filter).
  if (isSubDegreeTitle(title)) return null;

  // locationsText is Workday's display string; fall back to bulletFields
  // (some tenants stash the location there).
  let location = p.locationsText || '';
  if (!location && Array.isArray(p.bulletFields) && p.bulletFields.length) {
    location = p.bulletFields[p.bulletFields.length - 1] || '';
  }
  if (!location) location = '—';

  // The list only carries a relative "postedOn" ("Posted 5 Days Ago"),
  // not a real date. We leave posted null rather than make a per-job call.
  const posted = null;

  const id = p.bulletFields && p.bulletFields[0]
    ? String(p.bulletFields[0])
    : ('wd-' + url);

  return {
    title: String(title),
    company: company,
    board: company,
    sector: sector || '',
    location: String(location),
    url: url,
    posted: posted,
    salary: '',
    source: 'workday',
    id: id,
    ats: 'workday'
  };
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300'
    },
    body: JSON.stringify(obj)
  };
}
