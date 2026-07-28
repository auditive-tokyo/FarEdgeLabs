"use client";

import { HalftoneVideo } from "@/components/common/halftone-video";
import { useIntroRevealed } from "@/components/common/preloader";

export interface HeroFieldProps {
  src: string;
}

/**
 * The halftone field behind the whole page, and the one thing that knows it is
 * waiting for the intro.
 *
 * `<HalftoneVideo>` stays unaware of the preloader — it takes a plain `reveal`
 * flag and grows its dots when told. Joining the two is this view's business,
 * and this leaf is where the join happens, so `home.tsx` stays a Server
 * Component.
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
