---
name: Platoon tier decimal boundaries
description: Why platoon_rules tiers must use closed intervals with a real 0.01 gap, not touching integers + invisible inclusive/exclusive flags.
---

## The 3-layer bug this fixed
Editing/saving almost any existing platoon tier through Regras do Sistema → Pagamento & Bônus
(`artifacts/maratona/src/pages/rules.tsx`) used to risk a false "Faixa sobreposta" (overlapping
band) error, because three layers disagreed about how touching tiers are represented:

1. The single-row edit UI only exposes plain `minScore`/`maxScore` number inputs — there is
   (and still is) no control to view or set `minInclusive`/`maxInclusive` at all.
2. The client-side conflict guard (`findOverlappingBand`) is a naive `min <= otherMax && max >=
   otherMin` check with **no** inclusive/exclusive awareness — any re-save of a tier that
   legitimately touches its neighbor at a shared integer (e.g. old `[75,80)` next to `[80,85)`)
   flagged a false conflict, even with no actual edit.
3. The server-side check (`validatePlatoonRanges` in `artifacts/api-server/src/routes/rules.ts`,
   the authoritative one) *was* flag-aware, but originally only accepted an exact touch
   (`currMax === nextMin`, disambiguated by exactly one side being inclusive) as valid coverage —
   a deliberate small decimal gap was rejected as `"Lacuna entre intervalos detectada"`.

## The fix / convention going forward
Tiers now use **closed intervals on both ends** (`minInclusive: true, maxInclusive: true`) with a
genuine **0.01 gap** between adjacent tiers (e.g. `74.99` / `75`), matching the business's own
reference tables (e.g. "90–94,99" / "95–100"). This makes boundaries self-evidently
non-conflicting even to a human reading the raw numbers, and makes the naive client-side overlap
check correct without needing to touch it — a real numeric gap means `max >= otherMin` is false at
the shared point instead of ambiguously true.

**How to apply:** `validatePlatoonRanges` treats a gap of exactly `SCORE_STEP` (0.01) between
`curr.maxScore` and `next.minScore` as complete coverage (no error); only `gap < 0` (overlap) or
`gap > SCORE_STEP` (real gap) are rejected. `getPlatoonByScore`
(`artifacts/api-server/src/lib/calculations.ts`) rounds the input score to 2 decimals before
comparing, as a defensive backstop against float residue (e.g. `94.995` from a live sum/divide)
landing in the 0.01 gap between two closed intervals. Any new/edited band should keep this
"closed + 0.01 gap" shape rather than reintroducing touching integers — the admin UI still can't
show which side owns a shared boundary point, so ambiguity there is a trap.

## Snapshot naming needs a recompute after a rename
`quarterly_results.platoon` / `.platoonColor` are snapshot **strings** written by
`recomputeCycleResults` (via `getPlatoonByScore(...).name/.color`), not derived live from
`platoon_rules` on read. Renaming tiers (e.g. "Pelotão Branco" → "Sem Bônus") does not retroactively
relabel already-computed cycle rows — they keep showing the old name (harmless but inconsistent
with the freshly-renamed catalog) until "Recalcular Ciclo" runs again. The "Substituir Faixas 2026"
confirm dialog already tells the admin this in its copy ("o reprocessamento do ciclo não é
executado automaticamente — faça-o após confirmar"); it is not automatic on purpose (see
quarterly-recompute-triggers.md for why recompute is always a deliberate, separate action).

`NEW_TIERS_2026` in rules.tsx is the hardcoded source of truth the "Substituir Faixas 2026" button
POSTs to `/platoon-rules/replace-all`; keep `seed.ts`'s platoon rows mirroring it so a fresh dev DB
starts from the current correct tier scheme instead of a stale one.
