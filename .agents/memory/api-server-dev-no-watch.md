---
name: api-server dev script builds once, does not watch
description: Explains why backend route/schema code changes don't take effect until the workflow is restarted
---

The `artifacts/api-server` dev script runs `pnpm run build && pnpm run start`: it bundles once with esbuild (`build.mjs`) into `dist/index.mjs`, then runs the built output with plain `node`. There is no watch/reload step.

**Why:** unlike the `artifacts/maratona` Vite frontend (which hot-reloads on save), editing a backend route handler, schema file, or any server-side TS source has zero effect on the running process until it is rebuilt and restarted.

**How to apply:** after changing anything under `artifacts/api-server/src/**` (or a `lib/*` package it depends on), restart the `artifacts/api-server: API Server` workflow before testing the change via curl or the UI — otherwise you'll see stale behavior (e.g. old validation error messages, old field lists) and waste time debugging code that looks correct.
