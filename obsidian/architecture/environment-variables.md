---
tags: [architecture, config, stable]
updated: 2026-07-24
---

# Environment Variables

Rules for handling configuration and secrets.

> [!warning] This site has no server runtime
> The frontend is a **static export deployed to GitHub Pages**. There is no
> server to read env vars at request time, so **every variable here is baked
> into the client bundle at build time**. Never put a secret in this project.
> Server-side config lives in the AWS backend (Lambda env vars / Secrets
> Manager), not here.

## Rules

- Only `NEXT_PUBLIC_*` variables make sense in this project — anything
  unprefixed would still be inlined at build time, so it buys no protection.
- Document every required variable in **`.env.example`** (committed, no real values).
- Read env through `src/env.ts` (zod-validated), never `process.env` directly.
- Build-time variables must be available to the GitHub Actions deploy workflow,
  not just to `.env` locally.

## Current variables

| Name | Scope | Purpose |
|------|-------|---------|
| `NEXT_PUBLIC_SITE_URL` | public | Site origin (no trailing slash). Drives canonical URLs, OG/Twitter tags, `robots.txt`, `sitemap.xml`, JSON-LD. Falls back to `http://localhost:3000` when unset — **set it in production**. See [[seo-metadata]]. |

Validated by `src/env.ts` (zod) via `publicEnv`.

When the next variable is introduced:
1. Add it to `.env.example` with a comment describing it.
2. Add a row to the table above (name, scope, purpose).
3. Make sure the deploy workflow provides it at build time.
4. Add a [[changelog]] entry.

## Related

[[tech-stack]] · [[seo-metadata]]
