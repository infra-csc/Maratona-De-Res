---
name: Merge/dedupe vs unique indexes
description: When merging duplicate rows, copy unique-indexed fields only AFTER deleting the duplicate
---
When a "merge duplicates" flow copies fields from the duplicate row onto the kept row, any
unique-indexed field (`events.external_id`, `employees.external_id` — both have unique
indexes) must be copied only AFTER the duplicate row is deleted, inside the same transaction.

**Why:** Postgres checks unique constraints per statement. Copying the value while the
duplicate still holds it violates the index (prod HTTP 500 on event merge). Dev seed data
had NULL external_id, so the bug only surfaced in production with synced/imported rows.

**How to apply:** transaction order = migrate children (participants) → re-point non-cascade
FKs (absences has no onDelete cascade) → delete duplicate → patch kept row. The patch reads
the pre-transaction in-memory row objects, so deleting first loses nothing. Any future
employee-merge feature must follow the same order.
