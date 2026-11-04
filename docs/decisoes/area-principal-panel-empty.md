---
name: Area-principal panel silently empty for unrouted events
description: Why the "Quesitos da Minha Área" management panel can be blank even for a real area principal
---

`event_criterion_assignments` only gets a row once an admin/RH runs "Gerar Sugestões" for an event, or on the first PATCH action on that criterion. `GET /events/:id/criterion-assignments` used to only return existing rows, so for any event nobody had routed yet, the area-principal list was empty and the frontend panel (which renders `null` on zero rows) vanished entirely — even for a genuine area principal with a valid `default_evaluator_id`.

**Why:** the panel's visibility and the underlying "has this event been routed yet" state were conflated; a principal's authority over their area's criteria should not depend on whether someone else already ran an unrelated admin action first.

**How to apply:** for avaliador-principal requests, the endpoint now backfills virtual `status: "pending"` rows (no real id) for the event's active criteria in the principal's area(s) lacking a real assignment row, seeded from `criterion_routing.defaultEvaluatorId`. Any future "list assignments for X" endpoint feeding a self-service management UI should synthesize defaults the same way rather than assuming setup already happened.
