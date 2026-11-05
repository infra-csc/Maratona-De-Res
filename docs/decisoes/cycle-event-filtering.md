---
name: Cycle-scoped event filtering
description: Where cycle-date filtering for events belongs (backend), and why frontend pages must not re-apply their own date filter on top of it
---

# Cycle-scoped event filtering

`GET /events` filters to the current cycle by `cycle.startDate ≤ event.endDate ≤
cycle.endDate`. This is necessary because the external integration sync can
import events outside the current cycle's period; without the backend filter,
stale/out-of-cycle events would leak into cycle-scoped views (dashboard,
Gestão de Eventos, results).

**Why:** the cycle period is the single source of truth for "is this event part
of the current cycle" — not today's date, and not the event's own end date.

**How to apply:** since the backend already scopes `/events` to the cycle,
frontend pages consuming it must show ALL of what comes back, not add their own
extra date filter. `events.tsx` (Gestão de Eventos) used to additionally require
`event.endDate < today` to display a card — this silently hid any open/ongoing
or future-dated event still within the cycle window, even though evaluators
could already be submitting scores for it. Removed; the page now polls
`/events` (short refetchInterval) so cards live-update as evaluations come in,
instead of relying only on manual refresh/cache invalidation.
