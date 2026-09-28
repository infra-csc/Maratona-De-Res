---
name: Recurring automatic Git rebase conflicts
description: Safely recover when automated pulls replay the project's merge-heavy local history.
---

When an automatic pull rebases `main` and conflicts on old commits, inspect `.git/rebase-merge/orig-head`, compare its ancestry with `origin/main`, and check for independent uncommitted edits before deciding how to recover. If the origin target is already an ancestor of the original branch, aborting the redundant rebase restores the complete original. If branches genuinely diverged, abort the replay and merge `origin/main` into the original branch; resolve any actual merge conflicts.

**Why:** This project's local history contains merge commits, and automatic `pull --rebase` has repeatedly tried to replay many old commits, hitting conflicts in code that the complete local branch already reconciled. Resolving one old replay conflict at a time risks discarding newer integrated work.

**How to apply:** Verify staged files introduced by the rebase are present in orig-head, ensure no unrelated edits will be lost, then use `git rebase --abort`. Confirm ancestry and choose a normal merge only when remote commits are not already in the original branch. Validate clean Git status and the app after integration.