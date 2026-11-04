---
name: Nullable email/User schema ripple
description: Making users.email optional (e.g. for CPF-login) breaks TS callers across the codebase that assumed non-null email.
---

When a core identity field (like `users.email`) that was previously required becomes optional/nullable to support an alternate login method (e.g. CPF-based login for colaboradores), every consumer of that field across both frontend and backend must be re-checked, not just the schema and the primary auth path.

**Why:** In the CPF-login feature, `email` went from `string` to `string | null` on the `User`/`users` table. This silently broke: React Hook Form default values expecting `string` (email ?? ""), a `Set` built from `u.email.toLowerCase()` in an unrelated integration sync route, and JSX that unconditionally rendered `{u.email}`. None of these were near the auth code being changed — they only surfaced via a full `tsc --noEmit` across both the frontend and api-server packages.

**How to apply:** After relaxing a shared field's type, run typecheck on every package that consumes the generated types (frontend app, api-server, shared libs) before considering the change done — don't rely on typechecking just the files you touched. Grep for the field name across routes/pages to catch non-null assumptions (`.toLowerCase()`, direct rendering, form defaultValues) that the compiler will flag once the type changes propagate through generated API types.
