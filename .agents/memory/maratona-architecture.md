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

# Users (seed data)
- admin@cenografica.com.br / 123456 (role: admin)
- Same password for all 6 seeded users

# Export hooks
- `useExportRanking` and `useExportQuarterlyResults` are QUERY hooks (not mutations) — use the direct `exportRanking` / `exportQuarterlyResults` functions instead, called in async handlers

**Why:** orval generates GET exports as query hooks; calling them as mutations causes type errors at runtime.
