# Developer Handoff — Coach Jeff's Job Finder

> **Audience:** a developer taking over this repo with no access to the original author.
> **Basis:** direct inspection of every file at commit `cf051d7` on `main`. Claims below cite `file:line`.
> **Last verified:** 2026-09-28

---

## ⚠️ Read This First: There Is No DOC or DOCX Code In This Repository

If you were handed this repo to perform a **"DOC → DOCX standardization,"** stop and re-scope before writing any code.

I grepped the entire tree for `docx`, `.doc`, `msword`, `officedocument`, `wordprocessing`, `altChunk`, `mammoth`, `docxtemplater`, `jszip`, `pizzip`, `html-docx`, `filesaver`, `jspdf`, `FileReader`, `FormData`, `multipart`, and `<input type="file">`.

**Results: zero matches for anything Word- or document-related.** Specifically:

| Capability | Present? | Evidence |
|---|---|---|
| DOCX generation | **No** | No matches anywhere |
| DOC generation | **No** | No matches anywhere |
| PDF generation | **No** | No matches anywhere |
| File **upload** of any kind | **No** | No `<input type="file">`, no `FormData`, no `FileReader`, no `multipart` |
| File **conversion** | **No** | No matches anywhere |
| Resume parsing | **No** | "resume" appears only in marketing copy and disclaimers |

The **only** two file-producing code paths in the entire codebase are:

1. **CSV export** of saved jobs — [`jobfinder-storage.js:391-414`](jobfinder-storage.js#L391) (`exportSavedJobsCsv`), hand-rolled CSV string + `Blob` + `a.download`. No library.
2. **Markdown export** of the ATS test log — [`ats-tools.html:786-790`](ats-tools.html#L786), `Blob` + `a.download`. No library.

Neither is a Word document, and neither is on a DOC→DOCX migration path.

### Where the document work almost certainly lives

This repo is one of **three sibling Netlify deployments**. The other two are linked from [`coaching.html:169-170`](coaching.html#L169) and are the ones that plausibly generate resumes and cover letters:

```
https://coachjeff-resume-optimizer.netlify.app/     ← "ATS Resume Builder"
https://coachjeff-coverletter.netlify.app/          ← "Cover Letter Builder"
```

**Action:** before any DOCX work, obtain the repositories backing those two URLs. They are not in this tree, not in `.git` (single remote: `github.com/jburke8111-arch/coachjeff-jobfinder`), and not referenced by any build config. A DOCX standardization scoped to *this* repo has no files to change.

The section **"Files Relevant To DOC → DOCX Standardization"** below is filled in honestly with that conclusion rather than a fabricated file list.

---

## 1. Project Summary

### What it does
A **free, no-signup job search tool for new graduates and early-career seekers**. The user types a role and location; the app fans out to ~13 job sources in parallel, merges and de-duplicates results, scores each posting for early-career fit, and renders ranked cards with match %, sponsorship, experience-tier, and clearance badges.

### Main workflows
1. **Search** — [`jobfinder-ui.js:1030`](jobfinder-ui.js#L1030) `search()`. The ~850-line orchestrator: fans out to all sources, merges, filters, scores, renders. This is the heart of the app.
2. **Description enrichment** — after first paint, the UI POSTs up to 30–60 jobs to `/.netlify/functions/checkjobs` ([`jobfinder-ui.js:1499`](jobfinder-ui.js#L1499)) to fetch full descriptions and derive years-of-experience floors, sponsorship status, and drop/flag verdicts. Results repaint in place.
3. **Save / apply tracking** — jobs saved to `localStorage`, toggled applied, exported to CSV, shareable via a URL-encoded link ([`jobfinder-storage.js:209`](jobfinder-storage.js#L209) `buildSavedJobsLink`).
4. **Saved searches + alerts** — named searches with a "new since last run" diff ([`jobfinder-storage.js:764-838`](jobfinder-storage.js#L764)).
5. **ATS discovery** — a separate internal tool at [`ats-tools.html`](ats-tools.html) for fingerprinting an employer's ATS and test-fetching it. Developer/operator tool, not user-facing.

### Major features
- 13 job sources merged in one search (see §7)
- Early-career scoring with regex tiers ([`jobfinder-data.js:256-348`](jobfinder-data.js#L256))
- Sponsorship inference + a curated H-1B history table ([`jobfinder-data.js:375`](jobfinder-data.js#L375), reviewed `2026-07-09`)
- Sub-degree / non-degree / gig-work filtering ([`jobfinder-data.js:282-437`](jobfinder-data.js#L282))
- Post-result faceted filters ([`jobfinder-data.js:610-830`](jobfinder-data.js#L610), `RF`)
- Multi-location and multi-role search (max 3 each — [`jobfinder-ui.js:136,143`](jobfinder-ui.js#L136))
- PWA: offline app shell, install banner ([`sw.js`](sw.js), [`jobfinder-init.js`](jobfinder-init.js))
- Built-in source-health telemetry, local only ([`jobfinder-ui.js:1883-2102`](jobfinder-ui.js#L1883))

### Known limitations (from the code, not speculation)
- **Netlify's 10s function ceiling is the binding constraint.** Several functions hardcode a 9000 ms budget against it. `lever.js` has *no* overall budget — 7 boards × 5 pages × 7 s timeout is a 35 s worst case that will be killed mid-flight.
- **Location is silently ignored by three sources.** `themuse.js` reads `location` and never uses it; `mcloud.js` ships `matchesLocations()` as a hardcoded `return true`; `ashby.js:271-274` delegates to the client deliberately.
- **Multi-location is partial.** Server-param sources (Adzuna, USAJOBS, CareerOneStop) get only the *first* location; the rest get all. Documented at [`jobfinder-ui.js:1105-1130`](jobfinder-ui.js#L1105).
- **`checkjobs` truncates.** Caps at 30 jobs (60 with sponsorship scan) — [`checkjobs.js:312`](netlify/functions/checkjobs.js#L312). Beyond that, badges are title-guesses.
- **Employer rosters are hardcoded**, not configured: 96 Greenhouse boards, 40 SmartRecruiters, 30 Workday, 24 Ashby, 12 Phenom, 7 Lever, 3 Oracle, 1 mCloud. Adding an employer means editing the function.
- **Match % is capped below 100** by design and is a search-relevance heuristic, not an ATS score ([`index.html:985`](index.html#L985)).

---

## 2. Technology Stack

| Layer | What's actually used |
|---|---|
| **Frontend framework** | **None.** Vanilla ES2017+ JS, 4 global scripts, no modules, no bundler |
| **CSS** | Hand-written, inline `<style>` in each HTML file. No preprocessor, no framework |
| **Backend** | Netlify Functions (AWS Lambda), Node.js runtime |
| **Languages** | JavaScript, HTML, CSS |
| **Libraries / npm deps** | **Zero.** No `package.json` exists anywhere in the repo |
| **Build step** | **None.** Static files served as-is |
| **Package manager** | **None** |
| **Runtime (local)** | Any static file server for the UI; `netlify-cli` (Node 18+) if you need the functions |
| **Runtime (prod)** | Netlify CDN + Netlify Functions |
| **Fonts** | Google Fonts (Barlow, Barlow Condensed) — [`index.html:680`](index.html#L680) |
| **Analytics** | GoatCounter, async — [`index.html:677`](index.html#L677) |

**Mixed function API versions.** 6 functions are Netlify **v2** (`export default async (request) => Response`): `adzuna`, `ashby`, `checkjobs`, `greenhouse`, `lever`, `usajobs`. 8 are **v1** (`exports.handler`): `ats-detect`, `careeronestop`, `mcloud`, `oracle`, `phenom`, `smartrecruiters`, `themuse`, `workday`. Both work, but know which you're editing.

---

## 3. Quick Start

### Prerequisite check
```bash
node -v      # need 18+ for netlify-cli
npm -v
```
> On the machine this doc was written on, `node` was **not on PATH** (only `npm 8.19.2`). Install Node 18+ before proceeding if you hit the same.

### Option A — UI only, no live job results (fastest)
No install needed. Functions will 404, every source fails soft and returns `[]`, so you get the full UI with zero results.

```bash
cd /home/woodie/Projects/coachjeff-jobfinder
python3 -m http.server 8080
```
Open <http://localhost:8080>.

> Do **not** open `index.html` via `file://` — the service worker, the `/jobfinder-*.js` absolute script paths ([`index.html:1026-1030`](index.html#L1026)), and the `/.netlify/` fetches all require an HTTP origin.

### Option B — full stack with working job sources (recommended)

```bash
# 1. Install dependencies — there are none to install; just the CLI, globally.
npm install -g netlify-cli

# 2. Configure environment variables (see §4). Create .env in the repo root:
cp .env.example .env   # then fill in real values
# Netlify CLI auto-loads .env in dev. 4 of 13 sources need no keys at all.

# 3. Start the application locally
netlify dev

# 4. Verify successful startup
```

**Verification steps** — all four should pass:

```bash
# a) The page loads and scripts resolve (expect 200 five times)
for f in jobfinder-data jobfinder-core jobfinder-ui jobfinder-storage jobfinder-init; do
  curl -s -o /dev/null -w "$f %{http_code}\n" http://localhost:8888/$f.js
done

# b) A keyless source returns jobs — proves the function runtime works
curl -s 'http://localhost:8888/.netlify/functions/greenhouse?keyword=analyst' | head -c 300

# c) Per-source health, no keys needed
curl -s 'http://localhost:8888/.netlify/functions/greenhouse?diag=1' | head -c 400

# d) A keyed source reports whether your env vars took
curl -s 'http://localhost:8888/.netlify/functions/careeronestop?diag=1'
#    -> {"ok":false,"error":"missing COS_USERID or COS_TOKEN env var","keyed":false}  = not configured
#    -> {"ok":true,...}                                                              = configured
```

> **Critical gotcha:** every keyed function returns **HTTP 200 with `ok:false`** when its credentials are missing — never a 4xx/5xx. Status codes will *not* tell you a key is misconfigured. Always use `?diag=1`. This is deliberate ([`careeronestop.js:62`](netlify/functions/careeronestop.js#L62): *"always 200 so one dead source never breaks the client search"*).

In the browser, `netlify dev` serves on **:8888**. Then run a search for `analyst` and open DevTools console; `coachJeffHealth()` prints a per-source success table.

---

## 4. Environment Variables

**Complete list — 7 variables across 4 functions.** Nine of the thirteen sources need no credentials.

| Name | Purpose | Required | Example | Used at |
|---|---|---|---|---|
| `ADZUNA_APP_ID` | Adzuna app id | Required *for Adzuna only* | `a1b2c3d4` | [`adzuna.js:78`](netlify/functions/adzuna.js#L78) |
| `ADZUNA_APP_KEY` | Adzuna app key | Required *for Adzuna only* | `0123456789abcdef0123456789abcdef` | [`adzuna.js:79`](netlify/functions/adzuna.js#L79) |
| `USAJOBS_API_KEY` | USAJOBS `Authorization-Key` header | Required *for USAJOBS only* | `AbCdEf...==` | [`usajobs.js:29`](netlify/functions/usajobs.js#L29) |
| `USAJOBS_EMAIL` | Sent as `User-Agent`; USAJOBS **mandates** a contact email | Required *for USAJOBS only* | `you@example.com` | [`usajobs.js:30`](netlify/functions/usajobs.js#L30) |
| `COS_USERID` | CareerOneStop user id (URL path segment) | Required *for CareerOneStop only* | `ABC123XYZ` | [`careeronestop.js:58`](netlify/functions/careeronestop.js#L58) |
| `COS_TOKEN` | CareerOneStop bearer token | Required *for CareerOneStop only* | `eyJhbGciOi...` | [`careeronestop.js:59`](netlify/functions/careeronestop.js#L59) |
| `THEMUSE_API_KEY` | **Optional.** Raises upstream rate limit 500 → 3600 req/hr | **Optional** | `1a2b3c4d5e` | [`themuse.js:20`](netlify/functions/themuse.js#L20) |

**Behavior when missing:**
- Adzuna, USAJOBS, CareerOneStop → HTTP 200, `{ok:false, jobs:[]}`. That source contributes nothing; the search still works.
- The Muse → works anonymously at the lower rate limit; key simply omitted from the query ([`themuse.js:150`](netlify/functions/themuse.js#L150)). Response advertises `keyed: !!API_KEY`.

**You can develop productively with zero credentials.** Greenhouse (96 boards) and SmartRecruiters (40) alone return plenty of data.

### `.env.example`

A ready-to-use `.env.example` has been written to the repo root alongside this document.

> **Note:** there is **no `.gitignore` in this repo.** Add one containing `.env` *before* you create a real `.env`, or you will commit your credentials.

---

## 5. Repository Structure

```
coachjeff-jobfinder/
├── index.html                  ★ Main app — markup + all CSS + legal/privacy. 71 KB, ~1090 lines
├── jobfinder-data.js           ★ Constants: rosters, regex taxonomies, result filters (943 ln)
├── jobfinder-core.js           ★ One fetchX() wrapper per source (486 ln)
├── jobfinder-ui.js             ★ search() orchestrator, scoring, rendering, health (2102 ln)
├── jobfinder-storage.js        ★ localStorage: saved jobs/searches, CSV, alerts (969 ln)
├── jobfinder-init.js             Event wiring, SW registration, install banner (~90 ln)
│
├── ats-tools.html                Internal ATS discovery/test tool (41 KB, self-contained)
├── coaching.html                 Marketing page; links the 2 sibling apps
├── thanks.html                   Netlify form post-submit target
│
├── sw.js                         Service worker — network-first, never caches /.netlify/*
├── manifest.webmanifest          PWA manifest
├── robots.txt, sitemap.xml       SEO
├── icon-*.png, preview.png       PWA icons + OG image
├── README.md                     One line: "# coachjeff-jobfinder"
│
├── thr-test.js                 ⚠ MISPLACED — see below
│
├── Docs/                         ATS research notes (Markdown, human-written)
│   ├── workday.md, oracle.md, phenom-successfactors.md, others.md
│   └── ATS                     ⚠ 1-byte empty placeholder file
│
└── netlify/functions/            Serverless functions → /.netlify/functions/<name>
    ├── adzuna.js  ashby.js  careeronestop.js  greenhouse.js  lever.js
    ├── mcloud.js  oracle.js  phenom.js  smartrecruiters.js  themuse.js
    ├── usajobs.js  workday.js          ← 12 real job sources
    ├── checkjobs.js                    ← POST enrichment (descriptions)
    ├── ats-detect.js                   ← ATS fingerprinting for ats-tools.html
    ├── fetchOracle-client.js         ⚠ NOT a function — browser code, no handler export
    └── jobfinder-ui.js               ⚠ STALE 128 KB duplicate of the root UI file
```

### Entry points
- **Users:** `index.html` → loads the 5 scripts in strict order at [`index.html:1026-1030`](index.html#L1026). **Order matters** — no module system, everything is a global. `jobfinder-data.js` must load first (constants), `jobfinder-init.js` last (wires listeners to functions defined earlier).
- **Operators:** `ats-tools.html` — fully self-contained, one inline `<script>`.
- **Server:** each `netlify/functions/*.js` is its own endpoint.

### Build / config files
**There are none.** No `package.json`, no `netlify.toml`, no `.gitignore`, no lockfile, no CI config, no linter or formatter config. Deployment relies entirely on Netlify's zero-config defaults: publish the repo root as static, auto-detect `netlify/functions/`.

This is called out in the source itself — [`checkjobs.js:20-23`](netlify/functions/checkjobs.js#L20): *"they live in both files rather than a shared module because the functions directory is flat and there's no package.json / netlify.toml declaring module resolution."*

### Three misplaced files (all currently deployed)

1. **`netlify/functions/jobfinder-ui.js`** — a 128 KB stale copy of the root `jobfinder-ui.js`. It is **not** identical: it still contains a **bug that was already fixed** in the root copy. The root version has `REMOTE_SIGNAL_RX` ([`jobfinder-ui.js:958`](jobfinder-ui.js#L958)) which deliberately excludes bare country names; the stale copy still matches `/\b(remote|united states)\b/`. The root file's comment documents the impact: *"129 non-TX jobs leaking into a 'texas' search."* Netlify deploys this file as a bogus function endpoint. **Delete it.**
2. **`netlify/functions/fetchOracle-client.js`** — browser code with **no export of any kind**. Its own header says *"CLIENT-SIDE source fetcher … Add this to your DATA-SOURCES file."* Superseded: the real `fetchOracle` lives at [`jobfinder-core.js:285`](jobfinder-core.js#L285). Netlify deploys it as a function that errors on invocation. **Delete it.**
3. **`thr-test.js`** (repo root) — its first line reads `// netlify/functions/thr-test.js`, but it sits at the root. Because of that it is **not** deployed as a function; it is published as a **world-readable static asset** at `https://<site>/thr-test.js`. Harmless (no secrets), but it is a debug scratch file exposing your scraping approach. **Delete or move it.**

---

## 6. Application Architecture

### Frontend
Four global scripts, no modules, no bundler, no framework. State lives in the DOM plus a few `window.*` globals (`window._ghFailed`, `window._ghPartial`, `RF.active`). Rendering is template-literal string concatenation assigned to `innerHTML` (39 sites across the three main JS files).

**Layered by responsibility, not by module boundary:**
```
jobfinder-data.js   constants, regex taxonomies, employer rosters, RF filter state
      ↓
jobfinder-core.js   fetchX(keyword, location) → Promise<Job[]>, one per source
      ↓
jobfinder-ui.js     search() → fan out, merge, dedupe, score, filter, render
      ↓
jobfinder-storage.js  localStorage persistence, CSV, share links, alerts
      ↓
jobfinder-init.js   DOM wiring, SW registration
```

### Backend
15 independent stateless Lambdas. **No database, no shared module, no session, no auth.** Each holds its own employer roster and its own copy of shared helpers. `experienceRequirement()` is explicitly duplicated between `ashby.js` and `checkjobs.js` with a banner comment at [`checkjobs.js:16-30`](netlify/functions/checkjobs.js#L16): *"DUPLICATED CODE — keep in sync … If you edit either copy, edit both."*

### Authentication flow
**There is none.** No login, no accounts, no sessions, no cookies, no tokens, no user identity. All persistence is `localStorage` on the user's own device. Every function endpoint is public and unauthenticated. This is intentional and is part of the product promise ("no signup").

The only credentials in the system are **server-side upstream API keys**, held in `process.env` and never exposed to the browser — the stated purpose of the proxy layer ([`usajobs.js:5`](netlify/functions/usajobs.js#L5)).

### Data flow (one search)

```
User submits
   ↓
search()  [jobfinder-ui.js:1030]
   ↓ locPrimary = first location for server-param sources; full string for client-filter sources
   ├─ apiSource('adzuna',  fetchAdzuna)  ──→ /.netlify/functions/adzuna  ──→ api.adzuna.com
   ├─ apiSource('usajobs', fetchUSAJobs) ──→ .../usajobs                 ──→ data.usajobs.gov
   ├─ … 11 more, all in parallel, each .catch(() => ({key, jobs:[]}))
   └─ direct Lever board sweep (client-side, COMPANIES where ats==='lever')
   ↓ Promise.all — one dead source can never abort the run
merge → dedupe via jobId() [jobfinder-storage.js:120]
   ↓
filter: isUSJob, locationMatches, experience tier, sponsorship, degree, sub-degree, gig
   ↓
scoreJob() [jobfinder-ui.js:182] → matchPercent() → sort
   ↓
FIRST PAINT (progressive; aria-busy suppresses SR spam)
   ↓
POST up to 30–60 jobs → /.netlify/functions/checkjobs [jobfinder-ui.js:1499]
   ↓ fetches real descriptions from GH/Lever/Workday APIs + raw job URLs
   ↓ returns {verdicts, sponsorship, experience}
apply verdicts (drop / flag), recompute badges → REPAINT
   ↓
buildResultFilters() → facet bar; logSourceHealth() → localStorage
```

**A deliberate trust boundary worth preserving:** a years-of-experience *number* is only parsed from structured API responses. [`checkjobs.js:332`](netlify/functions/checkjobs.js#L332) — `const exp = (desc && trusted) ? experienceRequirement(desc) : null;` — only the Greenhouse/Lever/Workday API branches set `trusted:true`. Scraped HTML never yields a number. Don't "fix" this by trusting scraped text.

---

## 7. External Dependencies

| Service | Type | Credentials | Required to run locally? |
|---|---|---|---|
| Greenhouse (`boards-api.greenhouse.io`) | Job API, 96 boards | None | No — **best keyless source** |
| SmartRecruiters (`api.smartrecruiters.com`) | Job API, 40 slugs | None | No |
| Lever (`api.lever.co`) | Job API, 7 boards | None | No |
| Ashby (`api.ashbyhq.com`) | Job API, 24 boards | None | No |
| Workday (`*.myworkdayjobs.com`) | CXS JSON, 30 employers | None | No |
| Oracle Fusion (`*.fa.us2.oraclecloud.com`) | ORC REST, 3 employers | None | No |
| Phenom (12 employer domains) | `POST /widgets` | None | No |
| mCloud / CareerBuilder (`jobsapi-internal.m-cloud.io`) | Job API, 1 employer | None | No |
| The Muse (`themuse.com/api/public/jobs`) | Job API | **Optional** key | No — key only raises rate limit |
| Adzuna (`api.adzuna.com`) | Job aggregator | **Required** | Only if you need Adzuna |
| USAJOBS (`data.usajobs.gov`) | Federal jobs | **Required** | Only if you need federal |
| CareerOneStop (`api.careeronestop.org`) | US DOL / NLx | **Required** | Only if you need it |
| Netlify Functions | Serverless host | Netlify account for deploy | `netlify dev` runs locally |
| Netlify Forms | Feedback form ([`index.html:997`](index.html#L997)) | — | **No** — won't work locally |
| GoatCounter | Analytics | — | No |
| Google Fonts | Webfonts | — | No (needs internet) |
| Cal.com | Coaching bookings (external links) | — | No |

**Databases: none. Object storage: none. Auth providers: none.**

**License obligation — do not drop this.** [`careeronestop.js:20-22`](netlify/functions/careeronestop.js#L20) records that CareerOneStop use requires displaying DOLETA / Minnesota DEED attribution and the CareerOneStop logo. Verify the UI still does this before shipping changes to that source.

---

## 8. Document Generation Analysis

Per §0, **there is no document generation, export, upload, or conversion code in this repository.** For completeness, here is every file-producing path that *does* exist:

| # | File & line | Function | Library | Produces | Role in workflow |
|---|---|---|---|---|---|
| 1 | [`jobfinder-storage.js:391`](jobfinder-storage.js#L391) | `exportSavedJobsCsv()` | **None** — hand-rolled string join, `Blob`, `a.download` | `text/csv` → `coach-jeff-saved-jobs.csv` | User clicks "Export CSV" ([`index.html:954`](index.html#L954)); dumps 9 columns of saved jobs |
| 2 | [`ats-tools.html:786`](ats-tools.html#L786) | inline export-log handler | **None** — `Blob`, `a.download` | `text/markdown` → `ats-test-log.md` | Operator exports the ATS test history from the internal tool |

**Document upload: no code path exists.** There is no `<input type="file">`, no drag-and-drop handler, no `FormData`, no `FileReader`, no `multipart` parsing anywhere in the tree. The only inbound user data is form fields and the Netlify feedback form.

### Files Relevant To DOC → DOCX Standardization

**In this repository: none.**

No file in this repo reads, writes, converts, uploads, or emits `.doc` or `.docx`. A DOCX migration scoped here has zero files to change. To avoid a wasted sprint, do this first:

1. **Locate the real codebases.** Get the repos behind `coachjeff-resume-optimizer.netlify.app` and `coachjeff-coverletter.netlify.app` (linked at [`coaching.html:169-170`](coaching.html#L169)). Those products generate resumes and cover letters and are the only plausible home for DOC/DOCX output.
2. **Confirm with the stakeholder** which product the "DOC → DOCX" requirement refers to. The phrase does not match anything in this repo.
3. **If the requirement is genuinely about this repo**, then it is a *new feature*, not a standardization — most likely "export saved jobs as DOCX in addition to CSV." In that case the files to touch would be:
   - [`jobfinder-storage.js:391-414`](jobfinder-storage.js#L391) — the only existing export function; a DOCX writer would sit beside it
   - [`index.html:954`](index.html#L954) — the Export CSV button; a second button goes here
   - [`sw.js:12-21`](sw.js#L12) — `APP_SHELL` + `CACHE_VERSION`; **bump the version** if you add a script
   - A new dependency would be the project's **first ever** — it would require creating `package.json`, and for a browser-side DOCX writer, either a CDN `<script>` or introducing a bundler. That is a significant architectural change for a repo that currently has zero dependencies and zero build step. Flag it before starting.

---

## 9. Testing Guide

### Existing tests
**There is no test suite.** No test framework, no test files, no CI, no assertions. `thr-test.js` is a manual debug probe for one upstream API, not a test.

All verification in this project is manual, via three built-in diagnostic affordances:

| Tool | How to invoke | What it tells you |
|---|---|---|
| `?diag=1` on a function | `curl '.../greenhouse?diag=1'` | Per-board reachability, `keyed` status, partial-sweep flags |
| `?diag=1` on the page | `http://localhost:8888/?diag=1` | Enables console filter-funnel logging ([`jobfinder-ui.js:1899`](jobfinder-ui.js#L1899)) |
| Source-health log | `coachJeffHealth()` / `coachJeffHealth(20)` in console | Per-source success + zero-return rates over last 100 searches ([`jobfinder-ui.js:1972`](jobfinder-ui.js#L1972)). Clear with `coachJeffHealthClear()` |

### Manual test procedures

**Smoke:**
```bash
netlify dev
# search "analyst" / blank location  → expect results within ~10s
# DevTools console: coachJeffHealth() → most sources non-zero
```

**Per-source health:**
```bash
for f in greenhouse lever ashby smartrecruiters themuse oracle phenom mcloud careeronestop; do
  echo "== $f"; curl -s "http://localhost:8888/.netlify/functions/$f?diag=1" | head -c 200; echo
done
```

**Testing document generation:** not applicable — no such feature. To test the **CSV export**: save 2+ jobs (include one with a comma and one with a `"` in the title), click Export CSV, open in a spreadsheet, confirm quoting is intact ([`jobfinder-storage.js:396-399`](jobfinder-storage.js#L396) doubles `"` and wraps on `[",\n]`).

**Testing uploads:** not applicable — no upload feature exists.

### Recommended regression tests
Highest value first, given zero current coverage:

1. **Location matching** — `locationMatches()` / `locationMatchesOne()` ([`jobfinder-ui.js:960-1028`](jobfinder-ui.js#L960)). This is where the known "129 non-TX jobs in a Texas search" bug lived. Pure function, trivially unit-testable. **Start here.**
2. **Scoring** — `scoreJob()` ([`jobfinder-ui.js:182`](jobfinder-ui.js#L182)) — pin known inputs to expected ranks.
3. **The regex taxonomy** — `isSeniorTitle`, `hasEntrySignal`, `isSubDegreeRole`, `experienceTier` ([`jobfinder-data.js:256-348`](jobfinder-data.js#L256)). Dozens of long regexes with no coverage; a table-driven title→tier test would catch a lot.
4. **`experienceRequirement()` drift** — assert the `ashby.js` and `checkjobs.js` copies produce identical output. This catches the documented duplication hazard automatically.
5. **CSV escaping** — commas, quotes, newlines, `null` fields.
6. **Dedupe** — `jobId()` ([`jobfinder-storage.js:120`](jobfinder-storage.js#L120)) across sources returning the same posting.
7. **Contract test per source** — one recorded upstream response per function, asserting the normalized `{title, company, location, url, posted, ats}` shape.

---

## 10. Build Process

**There is no build process.**

- **Build command:** none. Netlify's build setting should be empty.
- **Publish directory:** repo root (`.`).
- **Functions directory:** `netlify/functions` (Netlify's default; auto-detected since there is no `netlify.toml`).
- **Output location:** none — source files *are* the artifacts.
- **Production artifacts:** the HTML/JS/CSS/PNG files exactly as committed, plus 15 bundled Lambdas (13 real + 2 broken, see §5).
- **Deployment:** git push to `main` on `github.com/jburke8111-arch/coachjeff-jobfinder` → Netlify auto-deploy.

**The one manual build step that exists:** when you change any file in `APP_SHELL`, you **must** bump `CACHE_VERSION` in [`sw.js:15`](sw.js#L15) (currently `'jobfinder-v4'`). The SW is network-first so staleness is mostly self-correcting, but offline users keep the old shell until the version changes.

---

## 11. Developer Onboarding — The 2-Hour Path

### Read in this order (≈70 min)
1. **[`sw.js`](sw.js)** (5 min) — short, and its header comment is the best-written explanation of the project's operating philosophy.
2. **[`jobfinder-data.js:1-600`](jobfinder-data.js#L1) — constants and regexes** (20 min). You cannot read anything else until you know what `INTERN_RX`, `SENIOR_RX`, `SUBDEGREE_TITLE_RX`, and `WORKDAY_EMPLOYERS` are. Skim the regex bodies; learn the names.
3. **[`jobfinder-core.js`](jobfinder-core.js)** (10 min) — 19 near-identical `fetchX()` wrappers. Read two, skim the rest. Note the universal fail-soft `return []`.
4. **[`jobfinder-ui.js:1030-1250`](jobfinder-ui.js#L1030) — the top of `search()`** (25 min). The single most important code in the repo. The comment block at :1105-1130 explaining the multi-location split is essential.
5. **[`netlify/functions/greenhouse.js`](netlify/functions/greenhouse.js)** (10 min) — the best-engineered function (time budget, concurrency pool, honest partial-sweep reporting). It is the template to copy when adding a source.

Skip on day one: `index.html` CSS (~700 lines), `ats-tools.html`, `Docs/`.

### Test in this order (≈30 min)
1. `netlify dev`, search `analyst` with no location — the happy path.
2. Search `nurse` in `Dallas, TX` — exercises location matching, sub-degree filtering, and the healthcare taxonomy simultaneously. Highest-signal single test.
3. Save 3 jobs → export CSV → build a share link → reload and reimport.
4. `curl '.../greenhouse?diag=1'` and read a partial-sweep response.
5. `coachJeffHealth()` after 3–4 searches.

### Most complex areas
1. **`search()`** — [`jobfinder-ui.js:1030-1880`](jobfinder-ui.js#L1030), ~850 lines in one function. Fan-out, merge, dedupe, multi-stage filtering, scoring, progressive paint, enrichment round-trip, repaint, facets, telemetry. **Understand it before touching it.**
2. **The regex taxonomy** — [`jobfinder-data.js:256-500`](jobfinder-data.js#L256). Some single regexes exceed 1,500 characters (`SUBDEGREE_TITLE_RX`). Interactions between them are implicit and undocumented.
3. **Location resolution** — `parseLocationInput` → `splitLocations` → `locationMatches` → `locationMatchesOne`, plus `STATE_ALIASES`, `US_RX`, `NONUS_RX`, and the server/client split.
4. **`checkjobs.js` trust model** — the `trusted` flag and its interaction with title-based badge inference.

### Highest-risk areas
| Risk | Where | Why |
|---|---|---|
| **Unescaped URL → XSS** | [`jobfinder-ui.js:557`](jobfinder-ui.js#L557) | See §12.1 — a live injection vector |
| **SSRF proxy** | [`ats-detect.js:35-47`](netlify/functions/ats-detect.js#L35) | See §12.2 |
| **Stale deployed duplicate** | `netlify/functions/jobfinder-ui.js` | Contains an already-fixed bug; an editor could "fix" the wrong copy |
| **Silent regex regressions** | `jobfinder-data.js` | Zero tests; a bad edit silently hides entire job categories |
| **10s function ceiling** | `lever.js` especially | No budget; adding a board pushes it further past the limit |
| **Duplicated `experienceRequirement`** | `ashby.js` + `checkjobs.js` | Comment-enforced only; drift is invisible |
| **Upstream scraping fragility** | `phenom.js`, `mcloud.js`, `workday.js` | Spoofed UAs, hardcoded `Referer`, undocumented endpoints — breaks without notice |

---

## 12. Codebase Assessment

### 12.1 Security concerns

**① Unescaped job URL rendered into `href` — XSS.** *(highest priority)*
```js
// jobfinder-ui.js:557
<a class="title" href="${j.url}" target="_blank" rel="noopener">${esc(j.title)}</a>
```
`j.url` arrives from third-party job APIs and is interpolated **raw**. Two problems: a `"` in the value breaks out of the attribute and injects arbitrary HTML (e.g. `onerror=`), and a `javascript:` URL executes on click. `esc()` ([`jobfinder-ui.js:1880`](jobfinder-ui.js#L1880)) escapes `&<>"'` but does **not** validate the scheme.

This is demonstrably an oversight, not a decision: the equivalent line in [`jobfinder-storage.js:373`](jobfinder-storage.js#L373) *does* use `esc(j.url)`. Two other sites are also raw — [`jobfinder-ui.js:779`](jobfinder-ui.js#L779) (`c.url`, from a hardcoded roster, lower risk) and [`jobfinder-ui.js:1794`](jobfinder-ui.js#L1794).

**Fix:** add a scheme-validating helper and use it at all four sites:
```js
function safeUrl(u){
  try { const p = new URL(u, location.origin);
        return (p.protocol === 'https:' || p.protocol === 'http:') ? esc(p.href) : '#'; }
  catch { return '#'; }
}
```

**② Unauthenticated SSRF / open proxy.** [`ats-detect.js:35-47`](netlify/functions/ats-detect.js#L35) fetches **any** URL from `?url=`, follows redirects, and returns findings. No allowlist, no private-IP or `localhost` blocking, no cloud-metadata-endpoint blocking, no response size cap (`await resp.text()` on the full body), no auth, no rate limit. Anyone on the internet can use your Netlify account to probe internal addresses. A second, narrower instance is [`checkjobs.js:283`](netlify/functions/checkjobs.js#L283), which fetches job URLs from the POST body.
**Fix:** allowlist schemes and hostnames, block RFC1918/loopback/link-local (incl. `169.254.169.254`), cap the response body, and gate `ats-detect` — it is an internal operator tool that does not need to be public.

**③ No `.gitignore`.** Nothing prevents committing a `.env`. Given the repo's history is 224 commits of "Add files via upload" (GitHub web UI), this is a realistic hazard. **Add one before creating `.env`.**

**④ No security headers.** No `netlify.toml` means no CSP, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy`. A CSP would also mitigate ①.

**⑤ Debug file published.** `thr-test.js` is world-readable at `/thr-test.js` (§5).

### 12.2 Potential bugs

1. **Stale duplicate with a regressed fix** — `netlify/functions/jobfinder-ui.js` still has the `/\b(remote|united states)\b/` bug the root file fixed. Not currently executed, but a trap.
2. **`lever.js` will time out.** Per-page 7 s timeout × up to 5 pages × 7 boards in `Promise.all`, with **no overall budget** vs. Netlify's 10 s limit. Compare `greenhouse.js:332` which does it correctly.
3. **`checkjobs` has no method guard.** CORS advertises `POST, OPTIONS` ([`checkjobs.js:297`](netlify/functions/checkjobs.js#L297)) but a GET isn't rejected — it fails at `request.json()` and falls into the catch, returning `200 {ok:false}`. Misleading to debug.
4. **`workday.js` caches its errors.** `Cache-Control: public, max-age=300` ([`workday.js:233`](netlify/functions/workday.js#L233)) is applied to the 400 and 502 responses too, so a transient upstream failure is cached for 5 minutes.
5. **Uncleared timeout in `careeronestop.js`** — its `withTimeout` ([`careeronestop.js:44-49`](netlify/functions/careeronestop.js#L44)) never calls `clearTimeout`, unlike the correct version at [`checkjobs.js:199-204`](netlify/functions/checkjobs.js#L199). Keeps the Lambda alive to the full 8 s even on a fast response.
6. **`mcloud.js` diag lies.** Reports `keyed: true` ([`mcloud.js:267`](netlify/functions/mcloud.js#L267)) though the function reads no env var at all.
7. **Location silently dropped** by `themuse.js` and `mcloud.js` (`matchesLocations()` is a hardcoded `return true`). Users get non-local results with no indication why.

### 12.3 Technical debt
- **Zero tests, zero CI, zero linting** on ~4,500 lines of intricate filtering logic.
- **`search()` is ~850 lines.** Needs extraction into fan-out / merge / filter / score / render stages — which requires tests first.
- **Knowingly duplicated code** (`experienceRequirement`) with only a comment enforcing sync, because there is no module system.
- **No dependency management.** No `package.json` means no way to pin, audit, or add anything.
- **Two function API versions** mixed in one directory.
- **Inconsistent CORS** — v2 functions all set `Allow-Origin: *`; among v1, only `mcloud` and `phenom` do; `ats-detect`, `careeronestop`, `oracle`, `smartrecruiters`, `themuse`, `workday` send none.
- **Inconsistent caching** — `max-age` of 600/300/120, `no-store`, and absent, with no stated policy.
- **Hardcoded rosters** across 8 files; onboarding an employer means a code change.
- **All CSS inline** in `index.html` (~700 lines), duplicated in `ats-tools.html`.
- **`README.md` is one line.** `Docs/ATS` is an empty 1-byte file.
- **Git history is unusable** — 224 commits, nearly all "Add files via upload" or "Update <file>.js". No branches, no PRs, no rationale. **`git log` will not help you**; the inline comments are the real changelog, and they are unusually good.

### 12.4 Missing documentation
No README content, no setup instructions, no env var documentation (the 7 variables were discoverable only by grepping `process.env`), no architecture overview, no source-onboarding guide, no deployment runbook, no API contract for the `Job` object, no `.env.example`. This document plus the accompanying `.env.example` are the first of these.

### 12.5 Areas that look AI-generated and deserve human review

Signals: uniform multi-paragraph explanatory comment blocks in a house voice; second-person address ("your other fetchers", "your DATA-SOURCES file"); defensive `try/catch { return [] }` on essentially every path; and commit messages that are all "Add files via upload."

| Area | Why it warrants review |
|---|---|
| **[`fetchOracle-client.js`](netlify/functions/fetchOracle-client.js)** | Clearest case. Reads as generated *instructions to the developer* ("Add this to your DATA-SOURCES file", "Mirror however your other fetchers time out") that were committed verbatim into the functions directory instead of being followed. **Delete it.** |
| **The giant regexes** — `SUBDEGREE_TITLE_RX`, `EXPERIENCED_NURSE_RX`, `NONDEGREE_RX` ([`jobfinder-data.js:282-437`](jobfinder-data.js#L282)) | Exhaustive alternation lists with 1,500+ characters and no tests. Plausible-looking but unverified; these decide which jobs a student never sees. **Highest-impact area to validate against real postings.** |
| **`SPONSOR_HISTORY`** ([`jobfinder-data.js:375`](jobfinder-data.js#L375)) | A hand-maintained H-1B tier table stamped `SPONSOR_HISTORY_REVIEWED = '2026-07-09'`. Drives immigration-adjacent badges. Needs a sourced human review and a refresh cadence. |
| **`salaryEstimate()`** ([`jobfinder-ui.js:350`](jobfinder-ui.js#L350)) | Shows money figures to users. Verify the methodology and that it is labeled an estimate. |
| **Comment/code drift** | Comments are confident and detailed — and sometimes wrong (`mcloud.js` `keyed:true`; `thr-test.js` claiming a path it isn't at; `matchesLocations()` documented as a no-op). **Verify claims against behavior rather than trusting comments.** |
| **Fail-soft everywhere** | `return []` / `status: 200` on every error path is a sound product choice, but it means **the app cannot tell you when it is broken** — a misconfigured key and a working source are indistinguishable by status code. Consider structured logging or an alert on sustained zero-return rates. |

---

## Appendix: First-Week Checklist

**Do immediately (low risk, high value):**
- [ ] Add `.gitignore` with `.env`, `.netlify/`, `node_modules/`
- [ ] Delete `netlify/functions/jobfinder-ui.js` (stale duplicate, deployed)
- [ ] Delete `netlify/functions/fetchOracle-client.js` (not a function, deployed broken)
- [ ] Delete or relocate `thr-test.js` (published as a static asset)
- [ ] Fix the unescaped `href` at [`jobfinder-ui.js:557`](jobfinder-ui.js#L557) (§12.1 ①)
- [ ] Replace `README.md` with a pointer to this document

**Do before any feature work:**
- [ ] Add `netlify.toml` (explicit publish/functions dirs, function timeout, security headers/CSP)
- [ ] Add `package.json` + a test runner; write tests for `locationMatches()` first
- [ ] Gate or allowlist `ats-detect.js` (§12.1 ②)
- [ ] Give `lever.js` an overall time budget, modeled on `greenhouse.js:332`

**Do before the DOCX work:**
- [ ] **Confirm which product the requirement targets.** It is not this one (§0).
- [ ] Obtain the `coachjeff-resume-optimizer` and `coachjeff-coverletter` repositories.
