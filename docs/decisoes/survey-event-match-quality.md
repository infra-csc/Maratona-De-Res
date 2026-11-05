---
name: Survey import event-match suggestion quality
description: Why the survey xlsx importer's automatic event-link suggestions under-match, and the resolution heuristic used
---

`suggestSurveyEventMatches` (integration.ts, survey import endpoint) matches free-text evaluator-typed event labels against production event names using strict substring containment (`normLabel.includes(normName) || normName.includes(normLabel)`). This fails whenever the two names diverge even slightly — which is common because evaluators type event names freely (no fixed dropdown), so the same real event shows up under wildly different spellings/date-suffix conventions (e.g. "NIGHT RUN - ETAPA 1 - MARINGÁ - 21/06" vs. stored "Night Run - Etapa 1 - Maringá -2026"). In one real import, only 2 of 41 spreadsheet groups got an automatic suggestion even though ~38 had a real matching production event.

**Why it matters:** a low suggestion-hit-rate does not mean the target events don't exist — always verify against the full production events table (name/city/date) before concluding a group has "no match," rather than trusting the suggestions list as exhaustive.

**How to apply / resolution heuristic used:**
- Tokenize both label and event name (NFD-strip accents, lowercase, strip date-like tokens such as `dd/mm`, `dd.mm.yyyy`, bare `20xx` years, drop stopwords), then score by token-overlap ratio instead of substring containment. This alone resolves most cases (bug not yet fixed in code as of this writing — still substring-based).
- Remaining gaps need human/date-range judgment: local abbreviations ("SSA"→Salvador, "POA"→Porto Alegre, "BSB"→Brasília, "BB"→Banco do Brasil), city nicknames ("Floripa"→Florianópolis), and literal typos in production data itself (e.g. an event stored as "NIGHT RUM" instead of "NIGHT RUN").
- Many real-world events have BOTH a non-historical (open/closed, live-scored, current cycle) row and a separate historical (closed, `isHistorical=true`, reference-only) row for the same race, often with slightly different names/dates. When a spreadsheet row carries real per-criterion numeric scores, link it to the **non-historical** duplicate — linking to the historical one silently drops all scores into a text note only (per the `isHistorical` skip-evaluations branch), discarding the data. Only fall back to the historical link when no non-historical counterpart exists at all.
- Multiple spreadsheet groups (differently-worded labels for the same real event) legitimately resolving to the *same* target event id is expected and correct, not a conflict.
