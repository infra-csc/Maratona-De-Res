---
name: Orphaned eventScoped criteria in events list
description: eventScoped criteria with source_criterion_id=NULL must use their own weight in the events-list enrichment loop, not weight=0
---

## Rule
In the events-list bulk-enrichment loop (`GET /events`), eventScoped criteria split into two sub-cases:

- **Has parent** (`criterionSourceCriterionId != null`): push with `weight: 0`; `mergeEventScopedCriteria` will fold the child score into the parent. Evaluation counts via parent ID.
- **Orphan** (`criterionSourceCriterionId == null`): push with its **actual** `weight_override ?? defaultWeight`; it passes through the merge untouched. Evaluation counts independently (like a non-eventScoped criterion).

Always use actual weight for orphans in: `criteriaRaw.push`, `evaluatedCriteria` counting, `finalCalibratedCriteria`, `partialPublishedCount`, and `areaIdsWithActiveCriteria`.

**Why:** Criterion 33 ("Qualidade da Entrega (2)", area Ativação) was eventScoped with `source_criterion_id=NULL`. The events list always pushed it with weight=0, making `scorableCount=4` while `totalEvaluatorSlots=5` (area slot was still counted). This caused the "0/5 vs 4 critérios" display inconsistency — Avaliações bar denominator ≠ Calibrações bar denominator. `computeEventTeamResult` correctly uses `weight_override=3` all along, so the actual score was unaffected.

**How to apply:** After every eventScoped criteria loop iteration in events.ts enrichment, detect `isOrphan = ch.criterionSourceCriterionId == null` and branch accordingly. The `orphanScoped` variable (filtered after the loop) carries this to `finalCalibratedCriteria`, `partialPublishedCount`, and `areaIdsWithActiveCriteria`.
