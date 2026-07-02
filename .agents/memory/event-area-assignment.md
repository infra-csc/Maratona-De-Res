---
name: Per-event per-area evaluator assignment
description: How evaluator scoping works (event-scoped, multi-evaluator per area, not profile-scoped)
---
Evaluation authority is per (event, area, avaliador), stored in `event_area_assignments` (unique on eventId+areaId+evaluatorUserId — one row PER evaluator, so an area can have 0..N evaluators), NOT the user's profile `areaId`.

**Rules:**
- RH/admin set assignments via `PUT /events/:id/assignments` with body `{assignments: [{areaId, evaluatorUserIds: number[]}]}`; only role==="avaliador" users are valid assignees.
- The PUT is a full-replace PER AREA LISTED, not a full-replace for the whole event: any areaId omitted from the request keeps its existing assignments untouched. To clear an area, you must explicitly send it with `evaluatorUserIds: []`.
- Confirm/release gate blocks until EVERY area responsible for an ACTIVE criterion has ≥1 evaluator (mirror: `areasNeedingAssignment` = distinct non-null responsibleAreaId of active criteria).
- Assignments become immutable once any evaluation exists for the event (PUT returns 409).
- Backend evaluations scoping uses `isAssignedForCriterion` for GET/POST/PATCH/submit; frontend evaluator-visible criteria filter by areaAssignments where evaluatorUserId===user.id.

**Why:** Same person's profile area should not auto-grant scoring; RH picks who scores which area per event, and may assign more than one evaluator to the same area for cross-checking.

**How to apply:** Frontend confirm button must also block on unsaved (dirty) assignments so local state can't bypass the backend gate.

**Multi-evaluator completeness + averaging** (`calculations.ts`: `buildAssignedEvaluatorsByArea` / `getCriterionEvaluationStatus`): a criterion is "avaliado" only when the count of distinct submitted evaluators equals the count of assigned evaluators for its `responsibleAreaId` (verified via E2E: 2 assigned, 1 submitted → still pending/excluded from progress; both submitted → averaged, e.g. (8+6)/2=7). Legacy fallback: if an area has zero assignments configured, falls back to "any one submission counts as done" (`distinctSubmitted.size > 0`) for backward compatibility with unconfigured events. `results.ts`, `feedback.ts`, `my-performance.ts`, and the events-list `evaluationProgress` metric all consume these same shared helpers — keep them in lockstep, don't reimplement completeness checks locally.

**Unified Critérios+Avaliadores table (event-detail.tsx):** criteria config and evaluator assignment are ONE table (cols Critério|Área|Peso|Avaliadores|Ações), one row per criterion. Each area now renders a multi-checkbox list (not a single `<select>`) bound to `assignments[criterion.responsibleAreaId]: number[]`, so multiple criteria sharing an area stay in sync. Evaluator checkboxes are locked ONLY by `hasEvaluations` (not by `criteriaConfirmed`), so RH can still reassign after confirming criteria but before any evaluation — the confirmed branch shows a "Salvar Avaliadores" button when `assignmentsDirty`.
