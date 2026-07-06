---
name: Conformity matrix calculation
description: eventScore (raw) vs conformityScore (penalized) distinction in computeEventTeamResult
---

`computeEventTeamResult` returns both a raw `eventScore` and a penalized `conformityScore`. Quarterly/cycle recomputation must aggregate using `conformityScore`, not the raw `eventScore`. `employee_event_results.finalEventScore` stores the penalized value.

**Why:** the raw event score reflects only the evaluation criteria, while the conformity score also factors in compliance/conformity penalties tied to the event; using the unpenalized raw score in cycle aggregation would let conformity violations go unpunished in the final ranking/bonus numbers.

**How to apply:** anywhere cycle-level results are computed or displayed (dashboard, results, ranking, exports), read `conformityScore` (or the persisted `finalEventScore`) — never the raw `eventScore` — as the per-event contribution to the cycle total.
