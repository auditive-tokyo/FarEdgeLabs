/**
 * Site-wide configuration — the single source of truth for SEO.
 *
 * Consumed by the metadata generator, `robots.ts`, `sitemap.ts`, and the
 * JSON-LD structured-data helper.
 */
import { publicEnv } from "@/env";

export const siteConfig = {
  /** The brand, not the page title — this is `siteName` and the JSON-LD Organization. */
  name: "Stack.Side",
  /**
   * ~155 characters: past that Google truncates it mid-sentence. Drawn from the
   * hero's own lead and body (`src/data/mocks/home.ts`) — the page and its
   * search result should not describe the product differently.
   */
  description:
    "StackSide connects every account, card and tool your team runs, turning scattered transactions into clear next moves — one source of truth for every dollar.",
  /**
   * Public origin, no trailing slash. Drives canonical URLs, OG tags, the
   * sitemap, and JSON-LD. Set `NEXT_PUBLIC_SITE_URL` in production — until it
   * is, every canonical and OG URL points at localhost and no social scraper
   * can fetch the card.
   */
  url: publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Default Open Graph / Twitter share image (path under `public/`). 1200×630. */
  ogImage: "/open-graph.png",
  /**
   * `undefined` on purpose, and it should stay that way until someone confirms
   * the real account. `twitter:site` is a *claim about who owns this site*, so a
   * guessed handle credits whichever stranger happens to hold the name. The
   * metadata generator omits the tags rather than invent them.
   */
  twitterHandle: undefined,
  author: "Stack.Side",
  /**
   * Browser theme-colour (address bar / PWA). Mirrors `--background` /
   * `--halftone-bg` in `globals.css` — the page's real ground. It cannot read
   * the token (Next needs a literal at build time), so the two move together by
   * hand.
   */
  themeColor: "#f0f3f4",
} as const;
