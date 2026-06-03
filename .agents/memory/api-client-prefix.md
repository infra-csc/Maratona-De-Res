---
name: API client /api prefix ownership
description: Where the /api prefix comes from in the Maratona client→server path, and why it must be set in exactly one place
---

# Rule
The generated API client (orval, in `lib/api-client-react`) must emit BARE operation paths (e.g. `/auth/login`). The single `/api` prefix is added at runtime by `setBaseUrl(VITE_API_BASE_URL ?? "/api")` in the frontend `main.tsx`.

Do NOT add a second source of the prefix:
- Do not set `output.baseUrl: "/api"` in `lib/api-spec/orval.config.ts`.
- Do not add a `servers: - url: /api` block in `lib/api-spec/openapi.yaml` (orval will fall back to it as baseUrl if `output.baseUrl` is absent).

**Why:** The api-server mounts its router at `/api`, and the vite dev proxy forwards `/api` to the backend WITHOUT a rewrite. So the request path needs `/api` exactly once. If the generated paths already include `/api` AND `setBaseUrl("/api")` runs, the browser sends `/api/api/auth/login`; the proxy forwards it as-is, the `/api` mount strips one, leaving `/api/auth/login` which matches no route → HTTP 401. Direct curl to `/api/auth/login` masks the bug because it bypasses the doubled client path.

**How to apply:** After any openapi/orval change, regenerate and grep the generated client for the login path — it must be `/auth/login`, not `/api/auth/login`. For external API origins in prod, `VITE_API_BASE_URL` must include the `/api` segment (e.g. `https://host/api`).
