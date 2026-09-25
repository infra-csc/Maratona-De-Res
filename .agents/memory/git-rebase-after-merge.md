---
name: Git rebase after conflict resolution
description: Replit may initiate a follow-on rebase after a user merge, replaying local commits and changing the branch again.
---

After resolving and committing a merge, do not assume the Git state remains settled. A follow-on rebase can start and replay older local commits over the remote branch, reintroducing the same conflicts or omitting fixes made only during the earlier merge.

**Why:** A merge completed cleanly and checks passed, but an automatic follow-on rebase then reintroduced the conflicts and replayed older commits without the final compatibility edits.

**How to apply:** Before reporting Git work complete, inspect the live status for an in-progress merge/rebase, resolve any replayed conflicts without discarding either side's intended behavior, and run final checks against the branch *after* rebase completion. When existing package metadata has changed, synchronize the installed dependencies from the lockfile before interpreting typecheck failures.