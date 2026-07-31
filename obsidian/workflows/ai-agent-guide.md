---
tags: [workflow, ai, superseded]
updated: 2026-07-30
---

# AI Agent Guide

> [!warning] Superseded by `AGENTS.md` — read that first
> This note was the template's rules of engagement, written when the vault was
> the contract. **`AGENTS.md` at the repo root is now the contract**, and it is
> the only document loaded into an agent's context automatically. Where the two
> disagree, `AGENTS.md` wins.
>
> What has changed since this was written, and is *not* reflected below: the site
> is a static export with no server (no Route Handlers, no middleware, no
> server-only env); it serves two locales from two root layouts in route groups;
> the colour scheme follows the OS with a different accent per scheme; the cookie
> banner and the preloader are gone. See `AGENTS.md`, [[decisions-log]] ADR-0018
> through ADR-0020.
>
> Kept because the sections on the animation engine and the vault's own map are
> still accurate and still useful.

Rules of engagement for AI agents working in this repo.

## Read this first

> [!warning] This is NOT the Next.js you know
> `AGENTS.md` warns that this version of Next.js has breaking changes — APIs,
> conventions, and file structure may differ from training data. **Read the
> relevant spec before writing code. Heed deprecation notices.**

> [!tip] Where to start
> The home view (`src/views/home.tsx`, route `/`) is **built**: a hero ported
> from Figma over a live halftone shader. Read it and its sections in
> `src/views/home/` before changing anything there — and see
> [[components/common|`<HalftoneVideo>`]] before touching the field, which has
> more constraints than it looks. New pages follow [[new-page]].

## Source-of-truth hierarchy

| Layer | Files | Purpose |
|-------|-------|---------|
| **The contract** (repo root) | `AGENTS.md` | Auto-loaded into every agent's context. Carries the hard rules and the constraints that shape the project. **Canonical.** |
| **This vault** (`obsidian/`) | all of `obsidian/**` | Reference. Longer-form notes on the animation engine, the design tokens, and why past decisions were made. Read on demand, not law. |

This inverts what the template asserted. The vault called itself the single source
of truth, which was workable when one person kept all 28 notes current; it stopped
being true the moment the project diverged from the template. An agent reads
`AGENTS.md` whether or not anyone asks it to, so that is where a rule has to live
to be reliable — a rule in a note nobody opened is not a rule.

The vault's lasting value is the part `AGENTS.md` cannot hold: the vendored
animation engine's specs, and [[decisions-log]]'s record of *why*.

## Hard rules (never violate)

1. **No CSS transitions/keyframes, no `framer-motion`.** All motion uses
   `@react-spring/web` via the [[animation-system]]. Text uses [[text-engine]].
2. **Do not modify** `src/components/animation/springs/` or `src/hooks/animation/`
   without explicit sign-off. They are the vendored animation engine —
   `#do-not-modify`. One authorized performance refactor has been made; see
   [[decisions-log]] ADR-0009. They stay protected by default.
3. **Never `mode="manual"`** on `TextEngine` — use `always`/`once`/`forward`/`progress`.
4. **No hardcoded values** — design tokens for styles (see [[design-system]]),
   props/hooks for content (see [[component-conventions]]).
5. **Routes delegate to views.** `app/**/page.tsx` imports only from `views/`.
6. **No `any`.** Type everything. Run `npm run lint` **and** `npx tsc --noEmit`
   before finishing — `no-unused-vars` is off in the ESLint config, so ESLint
   alone misses dead imports.
7. **Server Components by default**; `"use client"` only at leaves.

## Where to look

| Question | Note |
|----------|------|
| How is the project structured? | [[system-overview]], [[folder-structure]] |
| What's in the stack? | [[tech-stack]] |
| How do I add a page? | [[new-page]] |
| How does animation work? | [[animation-system]], [[text-engine]] |
| How do I style something? | [[design-system]] |
| What components/hooks/utils exist? | [[components/animation-springs]], [[components/common]], [[hooks]], [[utils]] |
| Why was X decided? | [[decisions-log]] |

## After making changes

- New dependency → update [[tech-stack]] + [[changelog]].
- Architectural choice → add an ADR to [[decisions-log]].
- New component/hook/util → document it in the relevant catalog note.

## Automated enforcement (hooks)

This workflow is **enforced automatically** by Claude Code hooks in
`.claude/settings.json` — nobody has to remember to ask for it:

| Hook | Fires | Effect |
|------|-------|--------|
| `SessionStart` | new chat / resume | Injects a pointer to read this vault first |
| `UserPromptSubmit` | every request | Reminds the agent to consult the relevant guide, and to update docs for any change |
| `Stop` | end of every turn | Blocks once to confirm the vault was updated to match the turn's changes |

The `Stop` hook blocks **at most once per turn** — a `${TMPDIR}` marker keyed by
session id guarantees termination, so there is no infinite loop. To review, edit,
or disable the hooks run `/hooks`. ADR: [[decisions-log]] ADR-0007.
