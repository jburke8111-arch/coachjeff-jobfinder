# Other ATS platforms — quick reference

Short entries for the remaining platforms. Full detail only where we have
hard-won findings.

---

## iCIMS — 🟡 Auth-gated
- **Tell:** `*.icims.com` (in URL or apply link)
- Has an API, but it's **partner-oriented**, not open/keyless. ~7% Fortune 500
  share.
- **Evidence:** Charles Schwab sits here (`career-schwab.icims.com/jobs/...`)
  behind a Radancy/TalentBrew custom front end (`schwabjobs.com`). Also its
  analyst roles skew senior/licensed — poor new-grad fit regardless.
- **Verdict:** the least-bad of the unreachable platforms if you ever pursue
  one, but still a credentialed project. Skip for now.

## Taleo — 🔴 Blocked / legacy
- **Tell:** `*.taleo.net`
- Oracle's legacy ATS, being sunset; inconsistent per-tenant, usually blocked.
- **Evidence:** Texas Health (`texashealth.taleo.net`).
- **Verdict:** skip.

## BrassRing / IBM Kenexa — 🔴 Custom
- **Tell:** `*.brassring.com`, `kenexa`
- IBM's own ATS (they own Kenexa). No clean public feed.
- **Evidence:** IBM's own careers run on this.
- **Verdict:** skip.

---

# Supported connectors (already live) — 🟢

These already work in Job Finder via their Netlify functions. Listed for
completeness so the knowledge base is the single source of truth.

| ATS | Tell | Function | Notes |
|---|---|---|---|
| Greenhouse | `boards.greenhouse.io` | `greenhouse` | Public boards API. Description fetch supported (trusted text) → feeds experience scan. |
| Lever | `jobs.lever.co` | `lever` | Public postings API. Description via `api.lever.co/v0/postings/{co}/{id}`. |
| Ashby | `jobs.ashbyhq.com` | `ashby` | Public API; `descriptionPlain` is trusted text. |
| SmartRecruiters | `smartrecruiters.com` | `smartrecruiters` | Public postings API. |
| Workday | `myworkdayjobs.com` | `workday` | See workday.md — the big one. |

Aggregators also live (not ATSs): USAJOBS (federal — usually citizen-only,
now gated when sponsorship filter is on), Adzuna, The Muse, CareerOneStop
(DOL — currently down / token issue).

---

# The strategic bottom line

Fortune 500 ATS share (approx): Workday 22.6%, Taleo 22.4%, SuccessFactors
14.4%, iCIMS 7.4%, BrassRing 9.4%, Oracle/homegrown the rest.

Of these, **only Workday is keyless-public** — the rest are auth-gated, blocked,
or custom. There is no "second Workday" waiting. The value of the Discovery/
Tester tools is therefore in *fast vetting* (label the walls instantly), not in
unlocking many new connectors.
