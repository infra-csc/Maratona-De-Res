---
name: Admin operational data reset
description: Scope and FK delete order for the in-app "Reset de Dados" admin action that wipes operational data while preserving config
---

The agent's production DB access is read-only, so any prod data wipe must be an in-app admin-triggered action (button + typed confirm phrase), never something the agent runs directly against prod.

Narrowed scope (confirmed explicitly by the user in Portuguese): wipe ONLY events, evaluations/notas, employees (colaboradores), and users (all except the calling admin). Config/reference data — areas, criteria, cycles, rules, platoon_rules — must be PRESERVED. Do not assume a "reset" means a full wipe; always confirm exact scope before touching config tables, since config is expensive to rebuild and often not obviously restorable.

**Why:** an earlier version of this feature was scoped as a full wipe; the user later narrowed it because rebuilding areas/criteria/cycles/rules by hand is heavy operational cost, while employees/users/events are expected to churn every cycle from ERP sync.

**How to apply:** when deleting in this domain, the FK-safe order is:
1. Null the calling admin's own `employeeId` (if set) so employees can be deleted without violating the admin's own FK.
2. Delete `absences` (penalties/merits).
3. Delete `quarterlyResults`.
4. Delete `employeeCycleEligibility` explicitly, BEFORE deleting users — it has a `createdByUserId` FK.
5. Delete `events` — cascades event_participants/event_criteria/event_area_assignments/evaluations/calibrations/event_conformities/employee_event_results via `onDelete: cascade`.
6. Null `auditLogs.userId` where `!= callerId` to preserve the audit trail while decoupling the FK (do not delete audit logs).
7. Delete `users != callerId`.
8. Delete `employees`.

Verified end-to-end via direct API calls (login → POST reset with confirm phrase → assert table counts) since the agent cannot click through UI with a live session: after reset, operational tables go to 0, `users` has exactly 1 row (the caller), and areas/criteria/cycles/rules/platoon_rules counts are unchanged. Admin can immediately create a new event afterward because the current cycle survives.
