# Phenom People / SuccessFactors / Jobs2Web

**Status:** 🔴 Blocked — detected, but blocks server (datacenter) requests.
**One line:** These often sit behind Akamai bot protection that 403s requests from cloud IPs (Netlify/AWS). No header/cookie trick beats an IP block; only a paid residential proxy would, which isn't worth it for a free tool.

## Tells
- Phenom: `phenompeople.com`, `/global/en/` path pattern
- SuccessFactors: `*.successfactors.com`, `*.sapsf.com`, `jobs2web.com`,
  `rmkcdn` — often visible in the careers page's Content-Security-Policy header
- Frequently wrapped in a **custom careers front end** (jobs.company.com) that
  hides all of the above until you deep-probe the page source / apply link.

## Why it's not reachable
- The underlying data call exists (e.g. American Airlines'
  `jobs.aa.com/services/recruiting/v1/jobs`, a clean JSON POST) — but Akamai
  blocks it when the request comes from a datacenter IP.
- Confirmed: AA returned **403** from Netlify even with a full browser header
  set (`sec-fetch-*`, `sec-ch-ua`) AND a two-step session-cookie grab. The block
  is on *where the request originates*, not how it looks.

## Evidence
- **American Airlines** — SuccessFactors/Jobs2Web + Phenom front end. Tested
  thoroughly; hard 403. Reverted to a Google-link fallback.
- **Baylor Scott & White** (`jobs.bswhealth.com/us/en`) — Phenom.
- **Comerica** (`careers.comerica.com/us/en`) — Phenom.

## Verdict
Do not pursue without a paid scraping/residential-proxy service. The whole
platform family is effectively off-limits for a free tool. Knowing this saves
time: if deep-probe flags Phenom/SuccessFactors, stop.
