---
name: Route-test concurrency
description: Avoid mistaking resource-heavy parallel route-test startup for application failures.
---

Prefer bounded concurrency when running many database-backed route-test suites in this workspace.

**Why:** An unrestricted full-suite run spent roughly three minutes initializing individual database-backed suites and exceeded a five-minute budget without reporting assertion failures. The selected affected routes plus frontend tests completed in about twenty seconds with serial execution.

**How to apply:** Use Node's `--test-concurrency=1` for focused route validation when resource contention is likely. Report a timed-out full suite as incomplete, not passing or failing, and report separately which focused tests completed. Do not assume this observation proves all full-suite tests pass.
