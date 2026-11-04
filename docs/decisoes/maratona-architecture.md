---
name: Maratona de Resultados – Architecture
description: Key decisions for the full-stack Portuguese-BR performance management app
---

# Architecture

- Frontend: React+Vite at artifact `artifacts/maratona`, port 23916, previewPath `/`
- Backend: Express+Drizzle at artifact `artifacts/api-server`, port 8080, previewPath `/api`
- Vite proxy forwards `/api/*` → `http://localhost:8080` for dev
- `setBaseUrl("/api")` + `setAuthTokenGetter(() => localStorage.getItem("maratona_token"))` in main.tsx
- Token stored as `maratona_token` in localStorage
- JWT_SECRET is a required env var (no fallback) — set via shared environment secrets

# Export hooks
- `useExportRanking` and `useExportQuarterlyResults` are QUERY hooks (not mutations) — use the direct `exportRanking` / `exportQuarterlyResults` functions instead, called in async handlers

**Why:** orval generates GET exports as query hooks; calling them as mutations causes type errors at runtime.

# DB declarations
- `lib/db` uses TypeScript project references with `composite: true`
- Run `tsc -p tsconfig.json` in `lib/db/` whenever schema changes to regenerate dist declarations
- Without this, api-server typecheck fails with "no exported member" errors

**Why:** The dist/schema/ declarations must be regenerated after schema changes for project references to work.

# Express 5 types
- `req.params.X` in Express 5 is typed as `string | string[]` — always cast: `req.params.id as string`

**Why:** @types/express v5 changed ParamsDictionary to allow string arrays.

# JWT_SECRET type narrowing
- After `if (!JWT_SECRET) throw...`, TypeScript still sees `string | undefined`
- Pattern: declare a second `const _JWT_SECRET: string = JWT_SECRET` and use that in jwt.sign/verify

**Why:** TypeScript control-flow narrowing does not cross module-level declarations in all cases.

# Business rules (TEAM/EVENT-based model)
- Evaluation is per (event, criterion, evaluator) — NO employeeId. One team score per event/criterion applies to ALL participants of that event.
- Calibration is event-level: per (event, criterion) — NO employeeId.
- Score scale is 1–5 (reject <1 or >5); score < 3 requires a mandatory comment.
- Score persistence/display is on a 0–100 scale (score×weight, weights sum to 20, max 5×20=100). Do NOT multiply by 100 when formatting — values like 71 are already 0–100. Display as `N.N/100`.
- Platoon thresholds (`minScore`/`maxScore`) are on the same 0–100 scale (e.g. Verde 70–80), NOT 0–1 decimals.
- Submitted evaluations are locked (cannot be edited without admin/rh reopen).
- Event feedback (GET /events/:id/feedback) is gated on event-level completion AND manual release; release endpoint allows roles admin/rh/diretoria; feedback never exposes evaluator names.
- Bonus eligibility + payment status (Caju Saldo Livre) tracked on quarterly results; payment PATCH at /results/quarterly/:id/payment.
- Valid roles: admin, rh, avaliador, diretoria, visualizador (there is NO "gestor" role).
