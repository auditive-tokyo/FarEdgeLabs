/**
 * Placeholder content for the home page.
 *
 * Components take content through props — the view imports this and passes it
 * down. See obsidian/frontend/component-conventions.md.
 *
 * Copy and figures are from the Figma frame "Get Layers" 681:256.
 */

export const homeContent = {
  brand: {
    /** The mark is a rendered gradient, so it ships as an asset rather than CSS. */
    markSrc: "/assets/hero/logo-mark.png",
    /** Split because the design italicises only the second half. */
    name: "Stack.",
    nameAccent: "Side",
  },
  nav: [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services" },
    { label: "Works", href: "/works" },
    { label: "About", href: "/about" },
  ],
  cta: "Send Request",
  hero: {
    /**
     * Background clip, rendered as a halftone field by `<HalftoneVideo>`.
     * A single head-turn sweep — the hero scrubs it with the pointer, so the
     * clip's timeline *is* the head's rotation.
     */
    backgroundVideoSrc: "/assets/hero/man.mp4",
    /** The headline breaks across two lines; the design accents the second. */
    headline: "Turn money into",
    headlineAccent: "foresight",
    lead: "Clarity and control to act",
    body: "StackSide connects every account, card, and tool your team already runs and turns scattered transactions into clear next moves — less guessing, faster calls, and one source of truth for every dollar.",
    stats: [
      { value: "$4B+", label: "Processed", accented: true },
      { value: "30k", label: "Active teams", accented: false },
      { value: "99.9%", label: "Uptime", accented: false },
      { value: "4.9", label: "Product Rating", accented: true },
    ],
    trust: {
      label: "Trusted by finance teams",
      avatars: [
        { src: "/assets/hero/avatar-1.png", alt: "" },
        { src: "/assets/hero/avatar-2.png", alt: "" },
        { src: "/assets/hero/avatar-3.png", alt: "" },
      ],
    },
  },
} as const;
