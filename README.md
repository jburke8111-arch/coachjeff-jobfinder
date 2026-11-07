# coachjeff-jobfinder

## Fixtures and secrets

All API credentials live in Netlify environment variables and are read via
`process.env` inside `netlify/functions/`. Nothing secret is shipped to the
browser, which is what makes this repo safe to keep public. Never add a
hardcoded key or a fallback value, in any file.

Saved API responses used as test fixtures are the one thing that can break
this. Adzuna and CareerOneStop carry credentials in the request URL, and
responses from those services can echo that URL back inside the JSON.

Before committing any fixture:

- Read it. Do not commit a response that has not been looked at.
- Remove any `app_id`, `app_key`, token, user ID or email it contains,
  including inside self-links, context blocks and error messages.
- Trim it to the records the conditions actually exercise.

A credential that reaches a public commit is compromised: rotate it. Deleting
the file does not remove it from history.
