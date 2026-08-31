// ============================================================================
// fetchOracle — CLIENT-SIDE source fetcher
// Add this to your DATA-SOURCES file, alongside fetchPhenom / fetchWorkday /
// fetchMCloud (NOT jobfinder-ui.js — that file only registers the call).
//
// Signature matches your apiSource contract exactly: fn(kw, loc) -> Promise<array>.
// Oracle is NOT in SERVER_PARAM_SOURCES, so it receives the full `loc` string
// (same as phenom/workday/mcloud). The serverless function does the location
// filtering; we pass keyword + location through and return data.jobs.
// ============================================================================

async function fetchOracle(kw, loc) {
  const params = new URLSearchParams();
  if (kw)  params.set('keyword', kw);
  if (loc) params.set('location', loc);
  // level is applied server-side; the function defaults to early-career, which
  // matches the tool's default. If your other fetchers forward the Level value,
  // add it here the same way they do (e.g. params.set('level', currentLevel)).

  const url = `/.netlify/functions/oracle?${params.toString()}`;

  try {
    // Mirror however your other fetchers time out. If you have a shared helper
    // (e.g. withTimeout / fetchWithTimeout), swap the bare fetch for it to match.
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.jobs) ? data.jobs : [];
  } catch (_) {
    return []; // fail soft — one dead source never blocks a search
  }
}
