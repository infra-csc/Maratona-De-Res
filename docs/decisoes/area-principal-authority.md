---
name: Area principal criterion authority
description: How "avaliador principal" (main evaluator) visibility and assignment power over an area's criteria is derived and enforced
---

Being a criterion's `defaultEvaluatorId` (in `criterion_routing`) makes that user the "principal" for the criterion's area (`criteria.responsibleAreaId`) — computed on the fly via `getPrincipalAreaIds(userId)`, not a stored role/flag.

**Why:** the org wanted area leads to have full oversight and reassignment power over their area's evaluation criteria without granting them admin/rh role, and without a new schema concept — reusing the existing routing default-evaluator relationship as the source of authority.

**How to apply:**
- Principal areas are queryable via `GET /users/my-principal-areas`.
- `GET /events/:id/criterion-assignments` broadens for principals: includes every assignment whose criterion's area is one they're principal for, not just their own assignments.
- The `"assign"` PATCH action is separate from `"redirect"`: it lets a principal (or admin/rh) set any active same-area user as `assignedToId` regardless of current assignee/status, and intentionally bypasses per-criterion `redirectMode` rules (redirect is peer-to-peer handoff with rules; assign is principal authority).
- No new DB tables/columns — derived entirely from `criterion_routing.defaultEvaluatorId`, `criteria.responsibleAreaId`, and `users.areaId`.
