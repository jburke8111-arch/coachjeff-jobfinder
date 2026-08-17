# Oracle HCM Cloud (Oracle Recruiting)

**Status:** 🟡 Auth-gated — detected, but not reachable by a keyless tool.
**One line:** Has a real REST API, but it requires OAuth2 credentials per tenant and the useful endpoints are partner-only. Not addable for free.

## Tell
- URL: `/hcmUI/CandidateExperience/...` or `*.oraclecloud.com`
- REST base: `.../hcmRestApi/resources/...`

## Why it's not reachable
- API auth is **OAuth 2.0** — you register an app, get a client ID + secret,
  fetch a bearer token, then call. That's per-tenant credentials we don't have
  and can't self-issue.
- Oracle's docs note several recruiting endpoints are "only for approved Oracle
  Cloud Marketplace partners" or "Oracle internal use."
- There is no public, keyless job-list endpoint equivalent to Workday's.

## Evidence
- **Dell** migrated here (careers link is `enterpriseplatform.dell.com/hcmUI/
  CandidateExperience/...`). Dell's old `dell.wd1.myworkdayjobs.com/External`
  Workday tenant still *responds* but returns **0 jobs** — it's a stale, emptied
  tenant from before the Oracle migration. Chasing it was a dead end.

## Verdict
Skip unless a specific must-have employer forces it, and even then it's a
credentialed-integration project, not a Workday-style afternoon.
