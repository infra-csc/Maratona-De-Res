---
name: Dialog trigger nested inside a custom clickable header
description: How to nest a Radix Dialog trigger button inside a non-<button> accordion/card header without the header's own click toggling firing, including the portal-bubbling gotcha.
---

When an accordion/card header itself is clickable (e.g. `<div role="button" onClick={toggle}>`) and you need to nest a real interactive trigger (button, `DialogTrigger asChild`) inside it:

- The outer header cannot be a native `<button>` — a `<button>` inside a `<button>` is invalid HTML and browsers will auto-close/misrender it. Convert the header to a `<div role="button" tabIndex={0} onClick={...} onKeyDown={...}>` instead.
- Add `e.stopPropagation()` on the inner trigger's own `onClick` so activating it doesn't also fire the header's toggle handler.
- **Portal gotcha:** `DialogContent` renders through a React portal, but React's synthetic event system bubbles through the *React component tree*, not the DOM tree. So clicks inside the modal content still bubble up to the header's `onClick` unless you also add `stopPropagation` on `DialogContent`'s own `onClick`. Without this, clicking anything inside the modal (e.g. a textarea) can silently toggle the header accordion behind it.

**Why:** hit this building a "flag for review" modal trigger placed next to an event name inside an existing clickable event-header row (Maratona `my-performance.tsx`); omitting either stopPropagation caused the accordion to collapse/expand unexpectedly when interacting with the modal.

**How to apply:** any time a Dialog/Popover/Menu trigger must live inside another already-clickable container, stop propagation at both the trigger element and the portal content element.
