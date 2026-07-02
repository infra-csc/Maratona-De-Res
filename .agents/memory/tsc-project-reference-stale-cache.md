---
name: Stale composite project-reference typecheck cache
description: Why `tsc --noEmit` in a dependent package can report a schema/column as missing right after it was added to a referenced package
---

# Rule
`lib/db` (and other shared `lib/*` packages) use `composite: true` + `emitDeclarationOnly` project references. When you add a new field/column to a shared package's source and then run `tsc --noEmit` in a dependent package (e.g. `api-server`), TypeScript can resolve the import against the referenced project's stale compiled `dist/*.d.ts` output instead of the live source, reporting "property does not exist" even though the source is correct.

**Why:** non-`--build` invocations of `tsc` on a project with references consult the referenced project's emitted declaration files on disk, not its source, once that project has been built once (dist/tsbuildinfo exist).

**How to apply:** after changing a shared `lib/*` package's exported types (e.g. adding a Drizzle schema column), rebuild it first with `pnpm --filter @workspace/<pkg> exec tsc -b --force` before typechecking any dependent package. Don't chase the "phantom" type error in the dependent package's own code — check whether the referenced package's dist output is stale first.
