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

**Playback (authenticated):** `GET /storage/objects/*` requires auth (`requireAuth`)
because it serves sensitive HR audio. `<audio src>` can't carry a Bearer header, so
the web app fetches the bytes itself with the token and plays a blob URL —
`fetchAudioObjectUrl(objectPath)` in `audio-upload.ts` + a loading/failed state in
`AudioPlayer`. Do NOT revert to a plain `<audio src="/api/storage…">`: that needs the
route to be public and re-opens the exposure. `/storage/public-objects/*` stays public.

**Why:** see router-mount-shadowing.md — storage must be mounted before the blanket
requireRole routers or these endpoints 403 for avaliadores.

**Remaining hardening gap (follow-up):** submit validates audioUrl SHAPE but does not
verify the object actually EXISTS in storage; and access is any-authenticated-user,
not per-object ACL (managers/RH only). Finer ACL is a known follow-up.
