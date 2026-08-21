/* Coach Jeff's Job Finder — service worker
 *
 * Deliberately minimal and safe:
 *  - Network-FIRST for everything. The live site is always preferred; the cache
 *    is only a fallback for when the user is offline. This guarantees the SW can
 *    never serve a stale app to someone who is online — a common PWA foot-gun.
 *  - The job APIs (/.netlify/functions/*) are NEVER cached and NEVER served from
 *    cache. Job results must always be fresh; an offline user gets a normal
 *    network error, exactly as before the SW existed.
 *  - Only same-origin GET navigations/assets are cached, so third-party calls
 *    (fonts, APIs) are untouched.
 *  - Bumping CACHE_VERSION on deploy retires the old cache automatically.
 */

const CACHE_VERSION = 'jobfinder-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  // Pre-cache the shell so a returning offline user still gets the UI. Failure
  // to cache any single item must not abort activation.
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Drop caches from older versions, then take control of open pages.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET; never interfere with POSTs (e.g. checkjobs enrichment).
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Only same-origin. Fonts, job APIs on other origins, etc. pass straight
  // through to the network with no SW involvement.
  if (url.origin !== self.location.origin) return;

  // NEVER cache the serverless job endpoints — results must always be live.
  if (url.pathname.startsWith('/.netlify/')) return;

  // Network-first: try the live network, fall back to cache only on failure
  // (i.e. offline). Successful responses refresh the cached copy.
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache a copy of good, basic (same-origin) responses for offline use.
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match('/index.html'))
      )
  );
});
