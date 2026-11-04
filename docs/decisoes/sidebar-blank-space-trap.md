---
name: Sidebar column blank-space trap
description: Why long per-item lists shouldn't be confined to a narrow sidebar column, and the fix pattern used on event-detail's Equipe Alocada.
---

## The problem
A page layout with a "main" wide column (e.g. 2/3) next to a narrower "sidebar" column (1/3) works fine when both columns hold short, similarly-sized content. It breaks down when the sidebar holds a variable-length per-item list (e.g. a team roster, a comment feed) — as the list grows, the sidebar column runs much taller than the main column next to it, leaving a large blank area in the wide column once its content ends. On top of that, each list item is rendered in a single narrow column, so horizontal space is wasted too (item cards wrap onto many lines that would fit on one row at full width).

**Why:** Reported by a user as "muito espaço em branco" on the Maratona event-detail page — Equipe Alocada (team roster) was stacked in the 1/3 sidebar next to Matriz de Conformidade, and for events with several participants the roster ran far past the Performance Individual table in the 2/3 column.

**How to apply:** When a sidebar-confined section can grow to an arbitrary number of items (rosters, comment lists, participant cards, etc.), pull it out of the narrow column and give it its own full-width section below/after the main grid, rendering items in a responsive card grid (e.g. `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`) instead of a single stacked column. Keep genuinely short/fixed-size content (like a compliance checklist) in the sidebar. If the sidebar would otherwise be the only remaining item in a two-column grid, don't force it into a full grid — let it render alone, capped with a reasonable max-width (e.g. `lg:max-w-xl`) so it doesn't stretch awkwardly.
