---
name: Auth/impersonation localStorage cleanup
description: Every auth-teardown path must clear ALL session keys, including the preserved real-admin keys used by dev-mode impersonation.
---

The Maratona web app keeps the active session in `maratona_token`/`maratona_user`. Admin "dev mode" impersonation preserves the real admin session under `maratona_real_token`/`maratona_real_user` so it can be restored on exit.

**Rule:** any code path that tears down auth — the global 401 handler (QueryClient onError in App.tsx), `logout()`, and `stopImpersonating()` — must clear ALL four keys, not just the active two. If real-session keys are missing/inconsistent, `stopImpersonating()` must force a full logout rather than silently leaving the user on the impersonated session.

**Why:** the first cut of impersonation cleared only the active two keys on 401, leaving a privileged admin token sitting in localStorage after redirect to login — a real token-leak window caught in review.

**How to apply:** when adding any new auth-related localStorage key, audit every teardown path and clear it there too. Impersonation is admin-only and intentional; the risk is residual privileged tokens, not the feature itself.
