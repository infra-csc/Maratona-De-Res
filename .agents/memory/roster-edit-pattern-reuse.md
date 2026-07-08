---
name: Roster edit pattern reuse
description: Canonical add/remove/edit-participant UI pattern to reuse whenever a manager-facing screen needs team roster editing.
---

event-detail.tsx has the canonical "Equipe Alocada" roster UI: a bordered panel listing participants (avatar initials, name, function, Casa/Freela tag, active/inactive toggle, remove button), an "Adicionar" button opening a Dialog with a Popover+Command searchable employee picker plus a function Select, and an AlertDialog confirming removal. It uses the generated `useAddEventParticipant` / `useRemoveEventParticipant` / `useUpdateEventParticipant` hooks (mutate shape `{ id: eventId, participantId, data }` for update/remove, `{ id: eventId, data: { employeeId, functionName } }` for add) plus `useGetEmployees({ active: true })` filtered by employees not already in the participant list.

It also defines a shared helper: `PARTICIPANT_FUNCTIONS` (fixed list: Cenotécnica, Cenotécnica Local, Cenotécnico, Sup Ceno, Sup Ceno Local, Colaborador) and `matchParticipantFunction(fn)` which normalizes accents/case and does exact-then-prefix matching to map a free-text function name onto one of the fixed options.

**Why:** Team roster editing is needed on more than one manager screen (event-detail, now evaluations.tsx's Central de Avaliações), and re-deriving the picker/mutation wiring from scratch is error-prone (easy to get the mutate payload shape wrong, or drift from the fixed function list).

**How to apply:** When a new screen needs roster add/remove/edit, copy the event-detail.tsx block (Dialog+Popover+Command+AlertDialog, PARTICIPANT_FUNCTIONS + matchParticipantFunction) rather than inventing a new picker or a different set of role/function options. Each screen can define its own local copy of the constant/helper (no shared module currently), but keep the list and matching logic identical for consistency.
