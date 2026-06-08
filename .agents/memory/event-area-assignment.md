---
name: Per-event per-area evaluator assignment
description: How evaluator scoping works (event-scoped, not profile-scoped)
---
Evaluation authority is per (event, area, avaliador), stored in `event_area_assignments` (unique on eventId+areaId), NOT the user's profile `areaId`.

**Rules:**
- RH/admin set assignments via `PUT /events/:id/assignments`; only role==="avaliador" users are valid assignees.
- Confirm/release gate blocks until EVERY area responsible for an ACTIVE criterion has an evaluator (mirror: `areasNeedingAssignment` = distinct non-null responsibleAreaId of active criteria).
- Assignments become immutable once any evaluation exists (PUT returns 409).
- Backend evaluations scoping uses `isAssignedForCriterion` for GET/POST/PATCH/submit; frontend evaluator-visible criteria filter by areaAssignments where evaluatorUserId===user.id.

**Why:** Same person's profile area should not auto-grant scoring; RH picks who scores which area per event.

**How to apply:** Frontend confirm button must also block on unsaved (dirty) assignments so local state can't bypass the backend gate.

**Unified Critérios+Avaliadores table (event-detail.tsx):** criteria config and evaluator assignment are ONE table (cols Critério|Área|Peso|Avaliador|Ações), one row per criterion. The Avaliador select binds to `assignments[criterion.responsibleAreaId]`, so multiple criteria sharing an area stay in sync (assignment is per-area, not per-criterion). Evaluator selects are locked ONLY by `hasEvaluations` (not by `criteriaConfirmed`), so RH can still reassign after confirming criteria but before any evaluation — the confirmed branch shows a "Salvar Avaliadores" button when `assignmentsDirty`.
