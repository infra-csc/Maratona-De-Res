---
name: Survey Forms raw import
description: How the MS Forms xlsx survey import (evaluator responses) parses raw exports and avoids duplicate/double-counted evaluations.
---

The survey import feature accepts the raw MS Forms export directly (any sheet, any column order/extra columns like Hora início/conclusão/Email), not a pre-trimmed file.

**Header-based column mapping, not fixed positions.** The frontend scans every sheet in the workbook for one whose header row contains a cell matching `/evento que esta avaliando/` (accent/case/whitespace-normalized, including non-breaking spaces from Forms). It then matches ~17 other header patterns to locate each question column (handles duplicated question titles distinguished only by "(2)" suffix) and remaps into the canonical 29-column layout the API expects. If no sheet matches, the upload is rejected with a toast instead of silently misparsing.

**Why:** Forms exports vary in column order/count between cycles and admins shouldn't have to manually trim/reorder the file before uploading.

**How to apply:** If the canonical layout or a question's wording changes, update the header-match patterns in `extractSurveyRows` (frontend) in lockstep with `SURVEY_COL`/`SURVEY_TARGET_CRITERIA` (backend) — both must agree on column semantics.

---

**Ignore sentinel.** `linkOverrides[groupKey] === -1` means "don't import this group's rows at all" (evaluators from ignored groups aren't even created). Used for spreadsheet rows describing events the business explicitly does not want re-imported (e.g. events already covered by a separate historical CSV import).

**Duplicate/double-count guards (both dry-run preview and commit use the same logic):**
1. Rows are grouped by their *linked* event id (after resolving overrides), and within each event, deduplicated by evaluator name — if the same evaluator has multiple rows for the same event (resubmission, or two differently-worded event labels both linked to the same event), only the last row by original sheet order is kept.
2. Before inserting, existing `(criterionId, evaluatorUserId)` pairs already in the `evaluations` table for that event are loaded once and any planned insert matching one is skipped (counted, not silently dropped) — in-app evaluations always prevail over spreadsheet rows.
3. That existing-pairs set is intentionally **not** mutated mid-loop, because a single Forms row can legitimately produce two evaluations for the same target criterion (two Forms questions — e.g. "Qualidade da Entrega" and its "(2)" variant for a different área — both map to one catalog criterion "Qualidade e Acabamento da Montagem"). Mutating the set during insertion would wrongly skip the second one on a first-ever import.

**Why:** the import can be re-run (corrections, re-uploads) without creating duplicate evaluations or double-counting a criterion, while still preserving the intentional two-questions-one-criterion case on a clean import.

---

**Admin dedupe cleanup.** An admin-only "dedupe evaluations" action (dry-run preview → confirm) removes exact-copy evaluation rows keeping the lowest id, then recomputes affected cycles. The group key must include ALL content columns — score/comments AND status/audioUrl — otherwise a draft+submitted identical pair could keep the draft and delete the submitted row (silently un-evaluating a criterion, since only submitted rows count). Deleting one of N identical copies is numerically neutral for the two-questions-one-criterion case (mean and evaluator-completeness unchanged).
