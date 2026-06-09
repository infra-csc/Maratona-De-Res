---
name: Mandatory audio on evaluations
description: Every evaluation submit requires a real uploaded audio object path; how upload/playback flows work
---

# Mandatory audio on evaluations

Business rule: an avaliador cannot submit an evaluation without an audio
justification ("áudio OBRIGATÓRIO em cada avaliação").

**Storage of the reference:** `evaluations.audioUrl` holds an object path of the
form `/objects/uploads/<uuid>`. Enforce that shape (regex `^/objects/uploads/[^/\s]+$`)
at ALL write/enforcement points — POST create, PATCH update, AND the submit gate —
not just submit. Otherwise a client can save an arbitrary non-empty string and the
"non-empty" check passes, bypassing the rule.

**Upload flow:** client POSTs metadata to `/api/storage/uploads/request-url`
(requireAuth) → gets `{uploadURL, objectPath}` → raw `PUT` of the audio blob to the
presigned `uploadURL` → saves `objectPath` as `audioUrl`.

**Playback:** `<audio src="/api/storage{objectPath}">`. `GET /storage/objects/*` is
UNAUTHENTICATED on purpose so `<audio>` (which can't send Bearer headers) works.

**Why:** see router-mount-shadowing.md — storage must be mounted before the blanket
requireRole routers or these endpoints 403 for avaliadores.

**Known hardening gaps (follow-ups, not done):** submit does not verify the object
actually EXISTS in storage; and the public GET serves any object under
PRIVATE_OBJECT_DIR (unguessable UUID, internal tool — acceptable for now but a
candidate for ACL/signed URLs).
