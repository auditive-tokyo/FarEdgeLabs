"use client";

import Image from "next/image";
import Link from "next/link";

import { Hover } from "@/components/animation/springs/hover";
import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/preloader";
import { homeContent } from "@/data/mocks/home";

import { NavMenu } from "./nav-menu";
import {
  HOVER_SPRING,
  LIFT_IN,
  LIFT_OUT,
  REVEAL_DELAY,
  REVEAL_SPRING,
} from "./reveal";

export interface SiteHeaderProps {
  brand: typeof homeContent.brand;
  nav: typeof homeContent.nav;
  cta: string;
}

/** Drops from above — the header enters from the edge it is pinned to. */
const DROP_OUT = { opacity: 0, y: "-0.75rem" } as const;

/**
 * Logo, centre nav pill, and the request CTA — Figma 681:375 / 681:341 / 681:376.
 *
 * The nav pill is centred against the *viewport*, not between its neighbours,
 * so it is positioned rather than laid out in the flex row.
 *
 * > [!warning] The `<nav>` centres, the `<ul>` animates
 * > Springs write `transform`, and so does `-translate-x-1/2` — one would erase
 * > the other. The `<nav>` is left as a bare positioning shell holding the
 * > centring transform, and the pill's own styling moved onto the `<ul>`, which
 * > is the element the spring drives. The rendered geometry is unchanged: the
 * > shell shrink-wraps the pill.
 *
 * On a phone the pill and the CTA both step aside for a burger ([[NavMenu]]) —
 * four links and a 9.1875rem button will not share 375px with a logo. `fixed`
 * rather than `absolute`: the desktop frame never scrolls, so the two are
 * identical there, but the phone page does, and a burger that scrolls out of
 * reach is a burger you cannot press.
 */
export const SiteHeader = ({ brand, nav, cta }: SiteHeaderProps) => {
  const isRevealed = useIntroRevealed();

  return (
    <header className="fixed inset-x-2.5 top-2.5 z-20 flex items-center justify-between">
      <Inview
        tag="div"
        from={DROP_OUT}
        to={LIFT_IN}
        config={REVEAL_SPRING}
        delayIn={REVEAL_DELAY.brand}
        mode="once"
        enabled={isRevealed}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative grid size-[3.125rem] place-items-center rounded-full border border-hairline bg-surface">
            <Image
              src={brand.markSrc}
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-full"
              priority
            />
          </span>
          <span className="text-body leading-[1.2]">
            {brand.name}
            <i>{brand.nameAccent}</i>
          </span>
        </Link>
      </Inview>

      <nav
        aria-label="Primary"
        className="absolute left-1/2 hidden -translate-x-1/2 lg:block"
      >
        <Inview
          tag="ul"
          className="flex h-[3.125rem] items-center justify-center gap-8 rounded-full border border-hairline bg-surface px-12"
          from={DROP_OUT}
          to={LIFT_IN}
          config={REVEAL_SPRING}
          delayIn={REVEAL_DELAY.nav}
          mode="once"
          enabled={isRevealed}
        >
          {nav.map((item, index) => (
            <li key={item.href} className="flex items-center gap-8">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="size-1 rounded-full bg-hairline-strong"
                />
              )}
              <Link href={item.href} className="text-body leading-[1.2]">
                {item.label}
              </Link>
            </li>
          ))}
        </Inview>
      </nav>

      <NavMenu nav={nav} cta={cta} />

      {/* The pill and its arrow twin read as one control, so they hover as one:
          scaling them separately would pull the seam between them open. */}
      <Inview
        tag="div"
        className="hidden lg:block"
        from={DROP_OUT}
        to={LIFT_IN}
        config={REVEAL_SPRING}
        delayIn={REVEAL_DELAY.cta}
        mode="once"
        enabled={isRevealed}
      >
        <Hover
          tag="div"
          className="flex items-center"
          from={{ scale: 1, y: "0rem" }}
          to={{ scale: 1.02, y: "-0.125rem" }}
          config={HOVER_SPRING}
        >
          <Link
            href="#request"
            className="flex h-[3.125rem] w-[9.1875rem] items-center justify-center rounded-full border border-hairline bg-accent text-body leading-[1.2]"
          >
            {cta}
          </Link>
          {/* Decorative twin of the CTA: same link, arrow only. */}
          <span
            aria-hidden="true"
            className="grid size-[3.125rem] place-items-center rounded-full border border-hairline bg-accent"
          >
            <span className="grid size-[1.875rem] place-items-center rounded-full bg-surface">
              <svg
                viewBox="0 0 9 7.364"
                className="w-2 fill-none stroke-current"
                strokeWidth="1"
              >
                <path d="M0.5 3.682h7.5M5.318 0.5l3.182 3.182-3.182 3.182" />
              </svg>
            </span>
          </span>
        </Hover>
      </Inview>
    </header>
  );
};
