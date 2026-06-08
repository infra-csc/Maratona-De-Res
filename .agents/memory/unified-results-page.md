---
name: Unified Resultados page
description: former Resultados + Ranking pages merged into one tabbed /results page
---

The separate "Resultados" (/results, managers) and "Ranking" (/ranking, all) pages were merged into ONE
tabbed page at `/results` (artifacts/maratona/src/pages/results.tsx). `pages/ranking.tsx` was deleted.

**Routing/nav:**
- `/results` is now accessible to ALL authenticated users (no ProtectedRoute roles); the page gates tabs internally.
- `/ranking` redirects to `/results`.
- Sidebar has a single "Resultados & Ranking" → /results item, visible to all; diretoria visibility list keeps /results (dropped /ranking).

**Tab gating:** isManager = admin|rh|diretoria sees 3 tabs (Ranking · Consolidação · Bônus & Pagamentos);
non-managers see only the Ranking tab. canManage = admin|rh gates close-cycle + payment edits.
Ranking detail drawer (penalties/merits/bonus) opens only for managers (canViewDetail).

**Why:** Ranking is public-ish; Consolidação and Bônus expose team scores/financials → must be manager-only,
backed by server-side requireRole on the underlying endpoints (see confidential-endpoint-gating.md), not just the hidden tabs.
