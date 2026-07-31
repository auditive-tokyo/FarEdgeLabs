"use client";

import { HalftoneVideo } from "@/components/common/halftone-video";
import { useIntroRevealed } from "@/components/common/intro";

export interface HeroFieldProps {
  src: string;
}

/**
 * The halftone field behind the whole page, and the one thing that knows it is
 * waiting for the intro.
 *
 * `<HalftoneVideo>` stays unaware of the intro — it takes a plain `reveal`
 * flag and grows its dots when told. Joining the two is this view's business,
 * and this leaf is where the join happens, so `home.tsx` stays a Server
 * Component.
 *
 * Scrub and tilt are on for every pointer, touch included: `<HalftoneVideo>`
 * aims from `pointerdown` as well as `pointermove`, so a tap sets the mark a
 * mouse would have hovered over. Untouched, the spring rests at `progress` 0.5
 * — the middle of the clip, where the face looks straight ahead.
 */
export const HeroField = ({ src }: HeroFieldProps) => {
  const isRevealed = useIntroRevealed();

  return (
    <HalftoneVideo
      src={src}
      pointerScrub
      mirror
      tilt={0.24}
      reveal={isRevealed}
    />
  );
};
