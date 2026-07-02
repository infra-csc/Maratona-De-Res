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

**Tab gating (corrected 2026-07-02):** Ranking and Consolidação are visible to ALL authenticated roles.
Only "Bônus & Pagamentos" is gated to isManager = admin|rh|diretoria. canManage = admin|rh gates
close-cycle + payment edits. The ranking detail drawer opens for all roles (canViewDetail always true) —
it shows team scores/penalties/merits, which are not financial data.

**Why:** only bônus/payment VALUES are confidential (financial data), not the scores or the fact that a
consolidation/ranking exists. The financial redaction must happen server-side per request, not via hiding
a tab: `/ranking`, `/ranking-detail`, `/results/quarterly`, and `/exports/ranking` all now check
`isManager = admin|rh|diretoria` per-request and null-out/zero bonusValue + payment fields for non-managers
instead of blocking the whole endpoint with `requireRole`. `/exports/quarterly-results` (full CSV export
with bonus column) and the Bônus tab's write endpoints remain fully manager-only.
See confidential-endpoint-gating.md for the general principle.
