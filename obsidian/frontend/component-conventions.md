---
tags: [frontend, stable]
updated: 2026-07-15
---

# Component Conventions

Rules for writing and placing components. This note is canonical.

## Placement

| Folder | What goes here |
|--------|----------------|
| `components/ui/` | Design-system primitives — stateless, no provider deps (Button, Input, Card) |
| `components/common/` | Shared infrastructure — may depend on providers (Cookie, Skeletons) |
| `components/animation/springs/` | Animation engine — `#do-not-modify` |
| `views/` | Page-level components — one file per route |
| next to the feature | Feature-specific components — **not** in `components/` |

See [[folder-structure]] for the full tree.

## Where a component is documented

Which catalog a component belongs to follows from where it lives — and two of
the rows above have no catalog at all, on purpose:

| Lives in | Documented in |
|----------|---------------|
| `components/common/` | [[components/common]] — and the file carries a `// 📖 Docs:` pointer to it |
| `components/animation/springs/` | [[components/animation-springs]] — `#do-not-modify`, consume only |
| `views/` and next to the feature | **Its own docblock.** The vault records that it exists ([[folder-structure]]) and why it was built the way it was ([[changelog]] / an ADR) — it does not re-describe it |

A section belongs to one page and is read with that page's other files open, so
its docblock is where the reader already is. A shared component is read by people
who have never opened it, which is what a catalog is for. If a feature component
ever grows a second consumer, it moves to `components/` — and *then* it needs a
catalog entry.

> [!warning] A dev-only client component: gating the JSX is not enough
> `{process.env.NODE_ENV === "development" && <Panel />}` over a **static
> import** still ships `Panel`. The import registers it in the page's client
> manifest and the bundler packs it into the *same chunk as the page* — which
> every visitor downloads — so the dead JSX saves nothing. A `dynamic()` call
> outside the check fares no better, and a barrel re-export drags it into the
> graph of every importer.
>
> The `import()` has to sit **inside** the branch that folds away:
> ```tsx
> const Panel =
>   process.env.NODE_ENV === "development"
>     ? dynamic(() => import("./panel").then((m) => m.Panel))
>     : null;
> ...
> {Panel && <Panel />}
> ```
> Learned from the halftone colour panel (since removed) — verified by grepping
> `.next/static/chunks` for a string only it contained.

## Structure rules

- **Named exports only** — no default exports from component files.
- One component per file (unless tightly-coupled sub-components warrant an index).
- Always define and export a typed `interface ComponentNameProps`. **No `any`.**
- Use `forwardRef` when a component must expose a DOM ref.
- **Server Components by default.** Add `"use client"` only when required:
  event handlers, browser APIs, React hooks, or animation components.
- Never mark a layout/page `"use client"` to dodge a boundary — split a leaf
  client wrapper instead.
- Keep components focused and under ~150 lines; split when they grow.
- A repeated visual pattern becomes a **React component**, not a global CSS
  class — `@layer components` in `globals.css` is reserved for pseudo-elements
  and third-party overrides. See [[design-system]] *Where a style goes*
  (ADR-0012).

## Data rules

- **No hardcoded content** inside components — text, numbers, media come from
  props or hooks.
- Placeholder data → `src/data/mocks/<page>.ts`, passed via props. Never import
  mock data into a component file directly.
- **Site content assets** (images, videos, …) → `public/assets/<section>/`, one
  folder per section, referenced by absolute path (`/assets/<section>/file.webp`).
  See [[folder-structure]]. Favicons / icons / OG / manifest stay at `public/` root.
- Every async-data component handles `loading` / `error` / `empty` with skeleton
  loaders mirroring the final layout — see [[components/common]].
- Data-fetching logic lives in custom hooks (`src/hooks/`), never in presentational
  components.

## Accessibility & semantic markup

Markup must be **semantic, accessible, and SEO-correct** — the full rulebook is
[[html-semantics]] (AGENTS.md hard rule #10). In short:

- Native elements over `div`s — real `button` / `a` / `nav` / `main` / `section`.
- One `<h1>`; never skip heading levels; the tag carries meaning, the class
  carries looks.
- Name landmarks and icon-only controls; visible focus; keyboard-operable.
- Images: meaningful `alt`; decorative images `alt=""`.
- Pass the correct semantic `tag` to animation components.

## Animation in components

Use the [[animation-system]] primitives. Pass the semantic element via `tag`.
Tailwind classes go on `className` / `innerClassName`, never into spring `from`/`to`.

## Code quality

- Run `yarn lint` before committing.
- Prefer early returns over nested conditionals.
- Comments explain *why*, never narrate *what*. No `console.log` in committed code.
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`.

## Related

[[design-system]] · [[animation-system]] · [[new-page]] · [[templates/component-note]]
