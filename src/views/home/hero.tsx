import type { HomeContent } from "@/data/mocks/home";

import { HeroCopy } from "./hero-copy";
import { HeroHeadline } from "./hero-headline";

import { HeroStats } from "./hero-stats";

export interface HeroProps {
  hero: HomeContent["hero"];
  /**
   * Italics on the accent word. Off for Japanese: the CJK fonts a browser falls
   * back to carry no italic cut, so the engine shears the glyphs instead —
   * which reads as a rendering fault, not as emphasis. The accent bar carries
   * the emphasis on its own there.
   */
  italicAccent?: boolean;
}

/**
 * The hero composition — Figma "Get Layers" 681:256, a 1440×800 frame.
 *
 * Laid out in `rem` against that frame so the adaptive grid scales the whole
 * thing as one unit (see obsidian/frontend/design-system.md). The header pins
 * to the top and this section's bottom row pins to the bottom, so a taller
 * viewport grows the middle rather than stranding the pills mid-screen.
 *
 * The halftone field is a separate fixed background — the design bakes it in as
 * flattened images, which are skipped here in favour of the live shader.
 *
 * Every piece holds still until the intro signal fires and then enters on the
 * timings in `./reveal.ts`. This stays a Server Component: the animation is
 * isolated in the leaves below (hard rule #6).
 *
 * **Two layouts, one DOM.** Below `lg` the frame does not exist, so the sections
 * simply stack in source order and the page scrolls; from `lg` up they take the
 * frame's absolute coordinates. Source order is therefore also the mobile
 * reading order — keep them in the order they should be read.
 */
export const Hero = ({ hero, italicAccent = true }: HeroProps) => {
  return (
    <section
      aria-labelledby="hero-title"
      /* Mobile: a column that is as tall as it needs to be. Fitting this much
         copy, four cards, a form and a pill into one phone screen would mean
         cutting most of it, so it scrolls — which is what a phone does anyway.
         `pt-20` clears the fixed header.

         From `lg`: exactly the viewport, never more. The bottom row is pinned to
         this box's bottom edge, so it lands on the screen's. No floor is needed —
         the grid caps its scale by height (globals.css), so 50rem never exceeds
         the viewport and the pieces can't fold into each other. */
      className="relative flex flex-col gap-10 px-5 pb-10 pt-20 lg:block lg:h-lvh lg:gap-0 lg:p-0"
    >
      <HeroHeadline
        headline={hero.headline}
        headlineAccent={hero.headlineAccent}
        italicAccent={italicAccent}
      />
      <HeroCopy lead={hero.lead} body={hero.body} />

      <HeroStats stats={hero.stats} />
    </section>
  );
};
