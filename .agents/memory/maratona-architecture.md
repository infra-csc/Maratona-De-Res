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

# Business rules
- Evaluation scores: 0–5 scale; score < 3 requires mandatory comments
- Submitted evaluations are locked (cannot be edited without admin/rh reopen)
- Platoon rules use 0–1 decimal range for score thresholds (e.g. 0.8 = top tier)
- calibrationsTable requires: eventId, employeeId, criterionId, calibratedScore, calibrationReason, calibratedByUserId
