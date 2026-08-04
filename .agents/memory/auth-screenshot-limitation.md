---
name: Auth limitation for appPreview screenshots
description: Why Screenshot tool can't render protected Maratona pages, and how to verify them instead
---

The Screenshot tool (`appPreview`) navigates a fresh browser context with no cookies/localStorage. Maratona's auth is a JWT stored in `localStorage` (not a cookie), and `ProtectedRoute` redirects unauthenticated visits to `/login`. Result: any protected route (which is nearly the whole app) screenshots as the CPF login card, never the real page content.

The login page UI only exposes a CPF field (`identifier: cpf, password: cpf`), but the backend `POST /api/auth/login` also still accepts staff `email`+password (e.g. `admin@cenografica.com.br` / the seed password) — the UI just doesn't expose that path. That only gets you a JWT for `curl`, not a way to authenticate the Screenshot tool itself.

**Why:** no tool parameter injects localStorage/cookies before navigation, so there is no way to pre-authenticate an `appPreview` screenshot for this app today.

**How to apply:** when asked to visually verify a change on a protected page, don't burn turns retrying the screenshot. Instead verify via (1) `tsc -b`/`tsc --noEmit` for type correctness, (2) `curl` the relevant API endpoints with a staff JWT (from the email+password login above) to confirm response shapes match what the component expects, and (3) careful manual reasoning about the CSS/contrast actually applied. Mention to the user that a live authenticated screenshot wasn't possible and what you did instead.
