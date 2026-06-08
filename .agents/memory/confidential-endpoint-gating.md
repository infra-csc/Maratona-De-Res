---
name: Confidential endpoint gating
description: Admin/RH-only data must be gated server-side with requireRole, not just hidden in the UI.
---

UI role-gating (hiding panels/buttons for non-managers) is NOT a security boundary in this app — pages like `/evaluations`, `/events/:id` have no route-level role guard, so any authenticated user (avaliador/visualizador) can reach them and call the same APIs.

**Rule:** any endpoint returning confidential/administrative data (team scores, projected platoon, pending-criteria counts, who-evaluated-what, exports) must enforce `requireRole("admin","rh","diretoria")` on the route itself. Frontend should additionally gate the query with `enabled: isManager` so non-managers don't trigger 403 noise.

**Why:** the "administrative info is confidential to adm/RH" requirement was first implemented as UI-only hiding, which left `/events/:id/result` and `/exports/pending-evaluations` openly fetchable by avaliadores — a real data leak caught in review.

**How to apply:** when adding a manager-only stat to a shared page, gate BOTH the API route (requireRole) and the client query (enabled flag). Manager role set is `["admin","rh","diretoria"]`; criteria-config writes use the narrower `["admin","rh"]`.
