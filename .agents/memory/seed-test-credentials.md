---
name: Seed test credentials & employee linkage
description: How to log in as a test user and test employee-scoped endpoints against the dev seed DB
---

All seeded users (seed.ts) share the password `123456`; emails follow the pattern `<role>@cenografica.com.br` (admin, rh, diretoria, visualizador, avaliador, avaliador2, avaliador.<area>).

**Why:** seed.ts hashes a single hardcoded password for every user, so there's no per-user credential to look up — this one password unlocks any seeded account for manual/API testing.

**How to apply:** `POST /api/auth/login` with `{ email, password: "123456" }` to get a JWT for manual endpoint testing.

Separately: in this dev DB, `users.employee_id` is NULL for every seeded user — no user account is linked to an employee row. Any employee-scoped endpoint (e.g. `/my-performance`) that reads `req.user.employeeId` will 404/"no employee linked" for all seed users out of the box.

**Why:** the seed script creates users and employees independently without wiring the FK; production data presumably links them via the external sync, but dev seed data does not.

**How to apply:** to test an employee-scoped feature, temporarily `UPDATE users SET employee_id = <id> WHERE id = <test user id> RETURNING ...`, log in again to get a fresh token (employeeId is baked into the JWT at login), test, then revert the `employee_id` back to NULL afterward so seed state stays clean.
