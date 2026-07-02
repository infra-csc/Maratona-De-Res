---
name: Tiered bonus model + Matriz de Performance criteria migration
description: Shape of the 7-tier platoon bonus model and the 5-item performance criteria catalog, and how they were rolled onto a live DB with real data
---

# Rule
Two related catalog changes came from the "Mudanças para o Próximo Período" business-rules doc:

1. **Platoon bonus tiers**: `platoon_rules` gained a `bonusPerExtraEvent` column (extra $ per event beyond the eligibility minimum). The 4 original tiers were replaced with 7: Quênia (95-100, 90-95), Azul (85-90, 80-85), Verde (75-80, 70-75), Branco (0-70, no bonus) — same 4 display names/colors, finer sub-bands so each has its own base bonus + per-extra-event rate.
2. **Matriz de Performance criteria**: the original 7 criteria (weight sum 20) were deactivated (`active=false`, kept for history) and replaced with 5 new active criteria (weight sum 11): Qualidade e Acabamento da Montagem, Logística Reversa/Carga da Desmontagem, Prazo de Entrega/Arena Pronta no Horário, Carga na Saída do Galpão, Retorno de Material/Perdas ou Avarias.

**Why:** since this DB already had real employee/event/evaluation history, `seed.ts` (which wipes tables) could not be rerun — the catalog swap had to be applied as a one-off `UPDATE`/`INSERT`/`DELETE` migration against the live tables, mirroring what `seed.ts` defines for fresh installs.

**How to apply:** any future catalog/tier change on a DB with real data must go through the same one-off SQL pattern (never `seed.ts`), and must be paired with the dynamic-weight-sum fix in criteria-weight-validation.md so the event-detail confirm gate doesn't keep assuming a fixed weight total. Bravus/Montagem Integral/Exclusividade Semanal participation rules from the same doc remain unimplemented — no data model exists yet and the scope was never confirmed with the user.
