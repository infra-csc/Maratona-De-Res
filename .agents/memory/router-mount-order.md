---
name: Router mount order RBAC trap
description: Why some routers must be mounted early in api-server routes/index.ts
---
In `artifacts/api-server/src/routes/index.ts`, sub-routers are mounted pathless
(`router.use(subRouter)`). `auditRouter` and `integrationRouter` apply a blanket
`router.use(requireRole("admin","rh"))`. With pathless mounting, ANY fall-through
request passes through those guards in order, so a request whose path lives in a
LATER-mounted router gets 403'd by audit/integration before reaching it.

**Rule:** any endpoint that authenticated NON-admin/rh roles must reach
(avaliador, colaborador, etc.) has to be mounted BEFORE auditRouter/integrationRouter.

**Why:** `storageRouter` was already moved early for exactly this reason (audio
upload/playback for avaliadores). `/cycles/current` hit the same trap — it is read
by my-performance (avaliador/colaborador view), so a late mount silently 403'd it
and the cycle badge vanished for those roles.

**How to apply:** when adding a router used by non-manager roles, mount it near
storageRouter (early), not at the end. Verify by logging in as `avaliador`
(seed pw `123456`) and curling the endpoint — expect 200, not 403.
