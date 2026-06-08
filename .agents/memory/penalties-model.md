---
name: Penalties (Penalidades) data model
description: How the renamed absences/penalties feature stores points and feeds quarter-close calc
---

The "Faltas" tab was renamed to "Penalidades" but the route/table stay `/absences` / `absences` on purpose (renaming would break the diretoria sidebar allowlist and deep links).

Penalty types are an authoritative server catalog (`PENALTY_CATALOG` in `absences.ts`): `falta` (points from the configurable rule `absence_penalty_per_absence`, default 50), `atraso_30` (50), `atraso_60` (100).

**Rule:** each penalty row stores its own `points` (snapshot computed server-side at registration; client-sent points are ignored). Quarter-close penalty = `sum(points * quantity)`, NOT `rule × count`. `totalAbsences` is intentionally kept as `sum(quantity)` (a count, used by dashboard/exports) and is decoupled from the points deduction.

**Why:** snapshotting points per row means editing the rule later does not retroactively change past penalties, and different penalty types can deduct different amounts. The `points` column default is `0` (neutral no-op) — there is no single correct default across types, so every insert path (incl. seed) must set `points` explicitly or it under-penalizes.

**How to apply:** when adding a penalty type, update `PENALTY_CATALOG` (+ the openapi `AbsenceInput.penaltyType` enum + the frontend `PENALTY_OPTIONS` mirror). `eventId` is required at the app layer (POST validation) but stays nullable in the DB to avoid breaking legacy rows. RBAC for create/delete is admin/rh/diretoria (avaliador dropped — they only see Avaliações).
