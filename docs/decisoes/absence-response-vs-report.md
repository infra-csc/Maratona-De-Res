---
name: Absences pending vs answered
description: Why a free-text "faltas/atrasos" field can't distinguish "answered no" from "never answered", and the fix pattern
---

`eventConformitiesTable.absencesReport` was a bare free-text field with no dedicated boolean. Truthiness of the text was used to render SIM/NÃO, so "field left blank because the evaluator never opened the section" and "field blank because the evaluator explicitly confirmed no absences" were indistinguishable — both silently rendered as "NÃO" instead of "PENDENTE".

**Why:** any conformity/questionnaire answer that has a free-text detail field needs its OWN nullable boolean "answered" flag (mirroring how `standoutResponse` already worked) — the text field alone is not a reliable signal of whether the question was actually answered.

**How to apply:** added `absencesResponse: boolean | null` alongside `absencesReport: text`. UI must render 3 states explicitly (`null` → "PENDENTE"/"—", `true` → "SIM", `false` → "NÃO"), never derive the answered-state from whether accompanying free text is non-empty. Applies to any future Sim/Não+justification question in the conformity matrix or similar forms (evaluations.tsx, calibrations.tsx, eval-public.tsx, public-eval.ts, events.ts conformity routes all needed updating in lockstep).
