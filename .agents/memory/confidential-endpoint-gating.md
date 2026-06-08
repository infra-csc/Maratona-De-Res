---
name: Confidential endpoint gating
description: Admin/RH-only data must be gated server-side with requireRole, not just hidden in the UI.
---

UI role-gating (hiding panels/buttons for non-managers) is NOT a security boundary in this app — pages like `/evaluations`, `/events/:id` have no route-level role guard, so any authenticated user (avaliador/visualizador) can reach them and call the same APIs.

**Rule:** any endpoint returning confidential/administrative data (team scores, projected platoon, pending-criteria counts, who-evaluated-what, exports) must enforce `requireRole("admin","rh","diretoria")` on the route itself. Frontend should additionally gate the query with `enabled: isManager` so non-managers don't trigger 403 noise.

**Why:** the "administrative info is confidential to adm/RH" requirement was first implemented as UI-only hiding, which left `/events/:id/result` and `/exports/pending-evaluations` openly fetchable by avaliadores — a real data leak caught in review.

**How to apply:** when adding a manager-only stat to a shared page, gate BOTH the API route (requireRole) and the client query (enabled flag). Manager role set is `["admin","rh","diretoria"]`; criteria-config writes use the narrower `["admin","rh"]`.

**Related trap (conditional filter fall-through):** `GET /evaluations` scopes an avaliador to their area only inside `if (role === "avaliador" && user.areaId)`. When `areaId` was null the guard was skipped and the query fell through UNFILTERED, exposing every team's evaluations. Rule: a role-scoped list endpoint that builds its filter from a per-user value must hard-fail (return `[]`/403) when that value is missing — never let a missing scope value bypass the filter.

**Role-focused menus = three layers that must stay in sync.** A "this role sees ONLY these sections" request touches: (1) sidebar nav visibility, (2) the App.tsx route guard (`ProtectedRoute roles={...}`), and (3) the backend `requireRole`. Pattern for a focused role: add an allowlist branch in the sidebar filter (e.g. `if (user.role === "avaliador") return item.path === "/evaluations";`, same for diretoria with a path array) — this short-circuits BEFORE the generic `item.roles` check, so listed items show even if their own `roles` array excludes the role. But the sidebar only hides; to actually grant/deny access you must also edit the route guard, and to make a page load its data the relevant GET endpoints must permit the role (most list GETs here are `requireAuth`-only = open). When REMOVING a section from a role (e.g. dropped diretoria from Auditoria), update all three (sidebar item roles, route guard, backend requireRole) or the role can still deep-link to it.

## Route/nav role lists must match write-endpoint RBAC
Calibration writes (POST /calibrations) require admin|rh|diretoria. The
/calibrations route guard AND the sidebar nav must use the SAME role set. When
the route admitted "avaliador" (a read-only-capable role), an avaliador (or an
admin impersonating one) could open the page and trigger saves that 403 on every
item. The bulk "Salvar Todas" swallowed errors (catch {}), surfacing only
"0 salva(s), N com erro" with no cause.
**Why:** GETs succeed for any authed user, so the page renders fine; only the
manager-gated POST fails — easy to misread as a backend bug when curl-as-rh works.
**How to apply:** keep page route roles, sidebar nav roles, and the server
requireRole on the primary write endpoint in lockstep. Never let a role onto a
management page whose core action it cannot perform. Surface mutation errors
(include err.message) instead of swallowing them.
