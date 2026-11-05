---
name: Employee merge FK orphan bug
description: Employee merge transaction must DELETE skipped/conflicting FK rows or the final DELETE employee violates FK constraints
---

## The Rule
After moving non-conflicting FK rows from duplicate to canonical, any rows that couldn't be moved (because canonical already has the same event/cycle) must be **explicitly deleted inside the same transaction** before the final `DELETE FROM employees`.

**Why:** PostgreSQL FKs without `ON DELETE CASCADE` prevent the employee DELETE if any row still references the duplicate employee_id. Rows that were "skipped" (because canonical already has that event/cycle) are left orphaned with the old employee_id → FK violation → 500.

## Tables affected in employee merge

| Table | Action when conflict | Fixed? |
|---|---|---|
| `event_participants` | DELETE remaining for dupId after loop | ✅ fixed |
| `employee_event_results` | conflict-aware loop + DELETE remaining | ✅ fixed |
| `quarterly_results` | DELETE remaining for dupId after loop | ✅ fixed |
| `employee_cycle_eligibility` | has `ON DELETE CASCADE` — safe to skip | ✅ ok |
| `absences` | blind UPDATE (no unique constraint conflict possible) | ✅ ok |
| `event_review_requests` | blind UPDATE | ✅ ok |
| `users` | re-link or deactivate | ✅ ok |

## How to apply
Any future table added with `employee_id FK → employees` that participates in the merge must either:
1. Be handled with conflict-check + delete-remaining, OR
2. Use `ON DELETE CASCADE` on the FK
