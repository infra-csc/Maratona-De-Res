---
name: Cycle migration (year+quarter → single current cycle)
description: app uses ONE current "ciclo"; year/quarter fully removed; scored vs participated event counts
---

The app migrated off the year+quarter period model to a SINGLE current "cycle" (ciclo). There is NO history
or period selector anywhere. `cyclesTable` (id, name, startDate, endDate, status open/closed, isCurrent);
events/absences/quarterly_results/eligibility carry `cycleId`. Backend resolves via `getCurrentCycle()`;
all routes default to the current cycle (no year/quarter params). UI labels say "Ciclo", never "Trimestre".

**Two distinct event counts on quarterly_results — do not conflate:**
- `eventsCount` = scored events (event score > 0); base of Soma das Notas / Média.
- `participatedEventsCount` = events the employee participated in this cycle; base of ELIGIBILITY.

**Eligibility rule:** requires `participatedEventsCount >= min_events_eligibility` (rule key, default 8).
Falling short sets eligible=false with reason like "Participou de 4 de 8 eventos exigidos no ciclo".

**Why:** participation (showing up) and scoring (getting graded) are different gates; bonus needs enough participation.
