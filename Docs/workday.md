# Workday

**Status:** 🟢 Reachable — fully supported by a live connector.
**One line:** Public, keyless JSON endpoint. The only large ATS we can call for free without auth. This is why it was worth building; its peers mostly aren't.

## Endpoint
- Base: `https://{tenant}.wd{N}.myworkdayjobs.com`
- Jobs (list): `POST {base}/wday/cxs/{tenant}/{site}/jobs`
- Body (required, even when fields are empty):
  ```json
  { "appliedFacets": {}, "limit": 20, "offset": 0, "searchText": "analyst" }
  ```
- Auth: **none.**

## Coordinates needed per employer
Three, read once off the employer's careers URL:
- **tenant** — e.g. `toyota`, `salesforce`, `ccf`
- **wd number** — the data center: `wd1`, `wd5`, `wd12`, `wd503`… varies per tenant, do NOT assume
- **site** — the site path: `TMNA`, `External_Career_Site`, `cignacareers`…

Config row shape (in `WORKDAY_EMPLOYERS`):
`{ name:'Toyota', tenant:'toyota', wd:'503', site:'TMNA', sector:'industrial' }`

## Gotchas (hard-won)- **Apply URL needs the `/{site}/` segment.** The list returns a relative
  `externalPath` like `/job/Plano-Texas/Analyst_10332696`. The real apply URL is
  `{base}/{site}{externalPath}`. Joining `{base}{externalPath}` (dropping the
  site) 404s to `community.workday.com/invalid-url`. *(This was a real bug we
  shipped and fixed.)*
- **Pages at 20.** `limit` > 20 silently returns 0 jobs with HTTP 200. Page in
  20s using `offset`.
- **wd number varies and can be wrong in your notes.** Toyota is `wd503`, not
  `wd5` — `wd5` returned 422. Always verify against a live job URL.
- **422 = wrong coordinates OR tenant in maintenance.** Toyota 422'd during a
  Workday maintenance window once, and separately for the wrong wd. A 422 is not
  a block; it's "this tenant/site/dc combo didn't resolve."
- **Description fetch (for experience scan):** the CXS detail endpoint is
  `GET {base}/wday/cxs/{tenant}/{site}{externalPath}` with
  `Accept: application/json` — returns `jobPostingInfo.jobDescription`. Without
  the Accept header the same URL serves the HTML shell. (Wired into `checkjobs.js`.)
- **Locations are unstructured free text** ("Remote - US", "Plano, TX", "").
  Don't send location to Workday; pull by keyword and filter client-side.
- **No real posted date in the list** — only a relative "Posted 5 Days Ago".
  We leave `posted` null rather than make a per-job call for it.
- **One board, many front-end pages.** Employers with fancy category or audience
  URLs almost always run a SINGLE underlying Workday board — the branded pages
  are just filtered views. Don't add one entry per page. Examples:
  - `careers.adobe.com/us/en/c/research-jobs`, `/engineering-and-product-jobs`,
    `/university` all funnel into ONE board: `adobe.wd5.../external_experienced`.
    A `q=graduate` keyword filter surfaces new-grad roles from the same board —
    so the single Adobe config entry already covers experienced AND new-grad AND
    every category. The "experienced" in the site name is a catch-all, not a
    filter. (Verified Aug 2026.)
  - Rule of thumb: when a company has many separate-looking careers pages, ask
    "what's the one Workday tenant underneath?" — your single config entry plus
    a keyword search reaches all of it. Only add a SECOND entry if new-grad roles
    genuinely live on a DIFFERENT site path (rare — Unilever's
    `Unilever_Experienced_Professionals` is one to re-check if new-grad coverage
    matters there).

## Employers confirmed working (as of Aug 2026) — 15
UT Austin, Cigna, CVS Health, Toyota, Salesforce, NVIDIA, Target, Adobe,
Mastercard, Thermo Fisher, Capital One, Prudential, Unilever, Booz Allen, PwC.

Cleveland Clinic (`ccf`/wd1/`ClevelandClinicCareers`) also works — swapped out
for CVS Health for a more nationwide footprint, still valid if wanted back.

## Performance note
Each employer is a separate parallel call per search. ~15 is fine. Past ~15–18,
add a subset-sweep strategy (rotate/ prioritize) before growing further.
