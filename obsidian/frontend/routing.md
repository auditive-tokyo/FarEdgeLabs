---
tags: [frontend, stable]
updated: 2026-07-15
---

# Routing

Next.js 16 App Router. The defining convention: **routes delegate to views**.

> [!warning]
> Per `AGENTS.md`, this version of Next.js may differ from older knowledge. Heed
> deprecation notices before writing routing code.

## Route → View delegation

`app/**/page.tsx` files contain **no UI logic**. They import a component from
`src/views/` and render it. ADR: [[decisions-log]] ADR-0003.

```tsx
// src/app/page.tsx
import { HomeView } from "@/views/home";

export default function Home() {
  return <HomeView />;
}
```

All layout and UI logic lives in `src/views/home.tsx` (`HomeView`), with that
page's own sections beside it in `src/views/home/` — feature components sit next
to their feature, not in `components/` (see [[folder-structure]]). The view is a
**Server Component**; isolate any client-only animation in a leaf component —
see [[component-conventions]] hard rule #6. `HomeView` models this: every section
it composes is a client leaf, and it stays a Server Component itself.

That is also why `HeroField` exists. `<HalftoneVideo>` needs a `reveal` flag read
from a hook, and `HomeView` cannot call hooks — so the leaf does it, rather than
the view turning client to fetch one boolean. **A hook a Server Component needs
is a leaf waiting to be extracted**, not a reason to move the boundary up.

## Current routes

| Route | File | View |
|-------|------|------|
| `/` | `src/app/page.tsx` | `views/home.tsx` → `HomeView` |

## Special files

`src/app/` carries the App Router special files:

| File | Role |
|------|------|
| `layout.tsx` | Root layout — provider tree, font, `metadata` + `viewport`, JSON-LD |
| `loading.tsx` | Suspense fallback — its presence enables streaming |
| `error.tsx` | Route-segment error boundary (Client Component) |
| `not-found.tsx` | 404 page — served with a 404 status |
| `robots.ts` / `sitemap.ts` | Generate `/robots.txt` and `/sitemap.xml` — see [[seo-metadata]] |
| — | No Route Handlers: static export has no server runtime. API calls go straight to AWS, see [[data-flow]] |

## Adding a route

1. Create `src/app/<route>/page.tsx` — keep it ~3 lines, delegate to a view.
2. Create `src/views/<route>.tsx` — the actual page component.
3. Use route groups `app/(feature)/` to scope feature pages without affecting the URL.
4. Follow the [[new-page]] playbook.

## Layouts

- `src/app/layout.tsx` — the **root layout**. Holds the provider tree
  (`ScrollLayout` → `ReducedMotion` / `Preloader` / `Cookie` → children —
  `AdaptiveGrid` is deliberately absent, see [[decisions-log]] ADR-0015),
  loads the fonts (General Sans + Mulish — see [[design-system]]) and
  `globals.css`, exports `metadata` + `viewport`, and renders the JSON-LD
  script. See [[data-flow]].
- Reusable layout *wrappers* (not route layouts) live in `src/layouts/` —
  e.g. [[smooth-scroll|ScrollLayout]].

## Navigation

Use **standard Next.js navigation** — `<Link>` from `next/link` and `useRouter`
from `next/navigation`. ADR: [[decisions-log]] ADR-0005.

```tsx
import Link from 'next/link';
import { useRouter } from 'next/navigation';
```

> [!note]
> Earlier drafts of `generic-layout-prompt.md` referenced `<AnimLink>` /
> `useAnimRouter()`. Those were never built and the convention is dropped — use
> `next/link` directly.

## SEO per route

Each route exports `metadata` via the shared generator — see [[seo-metadata]].

## Related

[[system-overview]] · [[component-conventions]] · [[new-page]]
