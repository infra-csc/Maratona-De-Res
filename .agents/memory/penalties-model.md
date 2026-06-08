---
name: Penalties & Merits (Penalidades e Méritos) data model
description: How the absences table stores both penalties and merits, points/sign rules, and quarter-close calc
---

The "Faltas" tab was renamed to "Penalidades e Méritos" but the route/table stay `/absences` / `absences` on purpose (renaming would break the diretoria sidebar allowlist and deep links).

Both penalties AND merits live in the same `absences` table, distinguished by a `kind` column (`'penalty'` default | `'merit'`). **Points are always stored positive; the sign comes from `kind`** — penalties subtract, merits add.

Authoritative server catalogs in `absences.ts`: `PENALTY_CATALOG` (`falta` → points from configurable rule `absence_penalty_per_absence` default 50; `atraso_30` → 50; `atraso_60` → 100) and `MERIT_CATALOG` (`merito_galpao` → 50, cycle-level; `merito_evento` → 25, per event). `catalogKind(type)` resolves which catalog a type belongs to.

**Rule:** each row stores its own `points` snapshot (server-side at registration; client-sent points ignored). Quarter-close: `penaltyPoints = sum(points*quantity)` over kind!='merit'; `meritPoints = sum(points*quantity)` over kind='merit'. `finalResult = clamp(grossAverage - penaltyPoints + meritPoints, 0, 100)` via `calculateQuarterFinalResult(gross, penaltyPoints - meritPoints)`. `totalAbsences` counts penalty rows only.

**Why:** snapshotting points per row means editing the rule later does not retroactively change past rows. `points` column default is `0` (neutral) — every insert path (incl. seed) must set `points` explicitly. Quantity sign matters: a negative `quantity` would invert penalty↔merit effect, so `POST /absences` validates `quantity` is an integer ≥ 1 (mirrored as `minimum: 1` on `AbsenceInput.quantity` in openapi).

**How to apply:** when adding a type, update the right catalog + `catalogKind` + the openapi `AbsenceInput.penaltyType` enum + the frontend `ENTRY_OPTIONS` mirror (which carries the `kind`). `eventId` is now OPTIONAL (cycle-level merito_galpao / falta have no event); nullable in DB and accepted as null by POST. RBAC for create/delete is admin/rh/diretoria.
