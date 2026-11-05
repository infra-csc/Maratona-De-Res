---
name: Production bundle TDZ from hook dependency array
description: A const declared after a useEffect that references it in the dependency array causes TDZ in the minified production bundle — the error message shows the minified variable name (e.g., "Ie"), not the original source name.
---

## Rule
Never reference a `const` or `let` variable in a `useEffect` dependency array (or any other synchronously-evaluated position during render) if that variable is declared LATER in the same component function.

## Why
The dependency array `[dep1, dep2]` is evaluated synchronously when React calls the component function. If `dep2` is a `const` declared after the `useEffect(...)` call in the function body, JavaScript's TDZ applies — the `const` is in the "temporal dead zone" from the start of the function to its declaration. At runtime this throws `ReferenceError: Cannot access 'X' before initialization` where `X` is the minified variable name.

TypeScript catches this with: "Block-scoped variable 'X' used before its declaration."

## How to apply
- If TypeScript reports "Block-scoped variable used before its declaration" inside a hook call, treat it as a production TDZ risk.
- Fix: move the data-fetching hook (`useQuery`, `useGetX`) and any derived `const` to BEFORE the `useEffect` that includes them in its dependency array.
- Changing hook call order is safe for a deployment (the browser loads the new bundle fresh).
- Also applies to any synchronously-evaluated closure argument (not just deps arrays).

## Discovery path
The error "Cannot access 'Ie' before initialization" in production ErrorBoundary was traced via source-map analysis to employees.tsx where `const employees = employeesRaw` was declared after a `useEffect([resetTypeOpen, employees])` call. Moving `useGetEmployees` above the `useEffect` fixed both the TypeScript error and the production crash.
