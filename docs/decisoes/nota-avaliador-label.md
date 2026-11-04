---
name: "Label rename: Nota Avaliador"
description: UI label change from "Média Original" to "Nota Avaliador" for evaluator score clarity
---

The label "Média Original" was renamed to "Nota Avaliador" everywhere it appears on the event-detail and calibrations tables/tooltips.

**Why:** "Média Original" was ambiguous to end users — it wasn't clear whether it meant the raw pre-calibration average or something else. "Nota Avaliador" makes explicit that the value is the evaluator's own submitted score, before any calibration adjustment.

**How to apply:** when adding new UI that surfaces the pre-calibration evaluator score, use "Nota Avaliador" as the label, not "Média Original" — keep terminology consistent across event-detail and calibration views.
