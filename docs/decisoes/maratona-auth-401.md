---
name: Maratona auth 401 / empty-data symptom
description: Why pages render empty instead of redirecting on expired JWT, and where 401 handling must live
---

# Empty-data symptom = expired token, not missing data

**Rule:** The route guard admits users based only on a cached `user` object in
localStorage; it does NOT validate JWT expiry (token TTL is 24h). When the token
expires but the cached user remains, the guard renders the page shell, but every
API call returns 401, so lists/tables render empty. This looks like "data
disappeared" but the DB/API are intact.

**Why:** Reported as a bug ("os dados sumiram de regras e etc"). Investigation
showed the API returned full data with a fresh token (curl 200), bindings were
correct, and the browser was getting 401 across endpoints — i.e. an auth-state
problem surfacing as empty UI.

**How to apply:** Global 401 handling lives in the maratona QueryClient
(`App.tsx`) via `QueryCache`/`MutationCache` `onError`: on `error.status === 401`
(and a token was present), clear `maratona_token`/`maratona_user` and redirect to
`${BASE_URL}/login`. Gate on token-present so a bad-credentials login (no token)
doesn't loop.

# Which fetch layer is actually used

**Rule:** Generated hooks (`@workspace/api-client-react`) use the PACKAGE fetch at
`lib/api-client-react/src/custom-fetch.ts` (throws `ApiError` with `.status`;
bearer token attached via `setAuthTokenGetter`, base URL via `setBaseUrl`, both
wired in maratona `src/main.tsx`). The artifact-local
`artifacts/maratona/src/lib/custom-fetch.ts` is DEAD CODE — nothing imports it.

**Why:** A 401 handler was first added to the artifact-local file and had zero
effect because no hook uses it.

**How to apply:** Put cross-cutting request/error behavior in the package fetch
(shared across artifacts — keep app-specific logic out) or, for app-specific
auth/redirect, in the app's QueryClient error handlers. Do not edit the local
dead file expecting runtime effect.
