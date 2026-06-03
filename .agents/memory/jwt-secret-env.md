---
name: JWT_SECRET handling
description: How JWT_SECRET must be stored for the Maratona api-server and why
---

# Rule
Store `JWT_SECRET` in the encrypted Secrets store (request it from the user via `requestEnvVar({requestType:"secret"})`). Never put it in plaintext `.replit` env (it gets committed).

**Why:** `auth.ts` reads `process.env.JWT_SECRET` and throws at startup with no fallback. A running process keeps its in-memory value even after the var is deleted from `.replit`, so login appears to keep working — but the next full workflow restart (the dev script is `build && start`, not watch) crashes the server. A plaintext copy in `.replit` is also a committed-secret vulnerability.

**How to apply:** If you must restart api-server to deploy backend changes, ensure `JWT_SECRET` exists in Secrets first. Deleting it from `.replit` without adding it to Secrets leaves the app one restart away from being down.
