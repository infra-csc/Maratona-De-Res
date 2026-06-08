---
name: Quarterly results recompute triggers
description: dashboard/results/ranking are derived from quarterlyResultsTable; any event lifecycle change must recompute it
---

Dashboard (summary, quarterly-evolution, top-employees, platoon-distribution), GET /results/quarterly,
and /ranking ALL read ONLY from `quarterlyResultsTable` (+ `employeeEventResultsTable` per-event cache).
These tables are NOT live views — they are snapshots written by `recomputeQuarterResults(year, quarter, userId)` in results.ts.

**Rule:** every event lifecycle transition that changes scores must call `recomputeQuarterResults`:
event close, event reopen, and feedback release. The manual POST /results/quarterly/close also delegates to it.

**Why:** originally only the manual quarter-close populated the table, so closing/finalizing an individual
event left dashboard MÉDIA GERAL empty and the evolution chart flat at 0 even with closed events.

**How to apply:**
- recompute is idempotent: it deletes ALL rows for (year,quarter) and rebuilds from currently `status="closed"` events.
- reopen must recompute too, so stale quarter rows AND per-event `employeeEventResultsTable` rows (cleared for ALL quarter events, not just closed) disappear.
- preserve manual payment fields across rebuild (bonusStatus in approved/scheduled/paid/blocked, or any row with paidAt → keep paymentMethod/paymentDueDate/paidAt/paymentNotes), keyed by employeeId via a snapshot taken before delete.
- writes are wrapped in a db.transaction so a mid-rebuild failure never leaves the quarter empty; do all reads/calcs first, then write.
