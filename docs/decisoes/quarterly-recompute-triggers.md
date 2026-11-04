---
name: Cycle results recompute triggers
description: dashboard/results/ranking are derived from quarterlyResultsTable; any event lifecycle change must recompute it
---

Dashboard (summary, evolution, top-employees, platoon-distribution), GET /results/quarterly,
and /ranking ALL read ONLY from `quarterlyResultsTable` (+ `employeeEventResultsTable` per-event cache).
These tables are NOT live views — they are snapshots written by the cycle recompute in results.ts,
keyed by the current cycle (getCurrentCycle()), NOT by year/quarter (those were removed in the cycle migration).

**Rule:** every event lifecycle transition that changes scores must call the recompute:
event close, event reopen, and feedback release. The manual POST /results/quarterly/close also delegates to it.

**Why:** originally only the manual close populated the table, so closing/finalizing an individual
event left dashboard MÉDIA GERAL empty and the evolution chart flat at 0 even with closed events.

**How to apply:**
- recompute is idempotent: it deletes ALL rows for the current cycleId and rebuilds from currently `status="closed"` events.
- reopen must recompute too, so stale cycle rows AND per-event `employeeEventResultsTable` rows disappear.
- preserve manual payment fields across rebuild (bonusStatus in approved/scheduled/paid/blocked, or any row with paidAt → keep paymentMethod/paymentDueDate/paidAt/paymentNotes), keyed by employeeId via a snapshot taken before delete.
- writes are wrapped in a db.transaction so a mid-rebuild failure never leaves the cycle empty; do all reads/calcs first, then write.
- **Gap:** editing `platoon_rules` (bonus tiers) or other calc inputs is NOT itself a trigger — it only changes what a FUTURE recompute would produce. Existing `quarterlyResultsTable` rows keep stale bonus/platoon values until the next event close/reopen/release, or until `recomputeCycleResults(cycleId, userId)` is invoked manually (it's exported from `routes/results.ts` and safe to call directly/one-off — idempotent, transactional, preserves payment state). Always recompute immediately after any one-off catalog/tier migration on a live DB, or the UI will keep showing pre-migration numbers.
- **Averaging gotcha:** every `quarterlyResultsTable` row for the cycle has `finalResult=0` placeholder until the employee has ≥1 scored event (`eventsCount>0`). Any UI stat that averages `finalResult` across all rows (dashboard Média do Ciclo, ranking Nota Média, and any future one) MUST filter to `eventsCount > 0` first, or the average gets dragged way down early in a cycle when most people haven't been scored yet. Check for this filter whenever adding a new "average score" stat anywhere in the app.
