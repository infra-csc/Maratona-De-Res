---
name: Recurring automatic Git rebase conflicts
description: Safely recover when automated pulls replay the project's merge-heavy local history.
---

When an automatic pull rebases `main` and conflicts on old commits, inspect `.git/rebase-merge/orig-head`, compare its ancestry with `origin/main`, and check for independent uncommitted edits before deciding how to recover. If the origin target is already an ancestor of the original branch, aborting the redundant rebase restores the complete original. If branches genuinely diverged, abort the replay and merge `origin/main` into the original branch; resolve any actual merge conflicts.

**Why:** This project's local history contains merge commits, and automatic `pull --rebase` has repeatedly tried to replay many old commits, hitting conflicts in code that the complete local branch already reconciled. Resolving one old replay conflict at a time risks discarding newer integrated work.

**How to apply:** Verify staged files introduced by the rebase are present in orig-head, ensure no unrelated edits will be lost, then use `git rebase --abort`. Confirm ancestry and choose a normal merge only when remote commits are not already in the original branch. Validate clean Git status and the app after integration.

Setting `pull.rebase=false` does not prevent this project's observed automatic command, which explicitly passes `--rebase`. Do not promise that repository configuration will stop these automatic replays.

**Why:** The reflog has shown automatic `pull --quiet --no-edit --rebase origin main` even while the local configuration is `pull.rebase=false`; command-line options take precedence.

**How to apply:** After recovery, distinguish a clean working tree from a synchronized remote: local commits may still be ahead. Offer a normal, non-force push with user authorization to align the current histories. If the remote advances first, integrate that work before retrying; never force-push merely to clear this warning.