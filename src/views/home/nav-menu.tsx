"use client";

import { animated, useTransition } from "@react-spring/web";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { GRID_MIN_WIDTH } from "@/components/common/grid/grid.config";
import { homeContent } from "@/data/mocks/home";
import { useScroll } from "@/hooks/smooth-scroll/use-scroll";
import { useWindowWidth } from "@/hooks/use-window-size";

export interface NavMenuProps {
  nav: typeof homeContent.nav;
  cta: string;
}

/**
 * The same spring as the preloader's curtains, for the same reason: this panel
 * is one too. `clamp` matters — a curtain that overshoots swings back and
 * flashes its edge across the page.
 */
const CURTAIN_SPRING = { tension: 110, friction: 24, clamp: true } as const;

/**
 * The phone's navigation — a burger in the header and a full-screen panel.
 *
 * Nothing in Figma describes this: the frame is 1440 wide and its four links sit
 * in a centre pill that will not survive 375px. The panel borrows the page's own
 * vocabulary rather than inventing one — it drops from the top like the
 * preloader's curtain, and it is black with white type like the request form.
 *
 * Above `GRID_MIN_WIDTH` this component renders nothing visible: the header's
 * pill takes over.
 */
export const NavMenu = ({ nav, cta }: NavMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const stopScroll = useScroll((state) => state.stop);
  const startScroll = useScroll((state) => state.start);
  const width = useWindowWidth();

  const close = () => setIsOpen(false);

  // A panel left open across the breakpoint would be `display: none` — invisible
  // but still holding the scroll lock and still a modal dialog to a screen
  // reader. Crossing into the desktop range closes it.
  useEffect(() => {
    if (width >= GRID_MIN_WIDTH) setIsOpen(false);
  }, [width]);

  // Escape closes, Lenis is stopped while open (which also pins native touch
  // scrolling — see scroll-layout), and focus returns to the burger.
  useEffect(() => {
    if (!isOpen) return;
    stopScroll();

    // Snapshot the node, so focus returns to the button this panel was opened
    // from rather than to whatever the ref happens to hold on the way out.
    const trigger = triggerRef.current;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      startScroll();
      trigger?.focus();
    };
  }, [isOpen, stopScroll, startScroll]);

  const transitions = useTransition(isOpen, {
    from: { y: "-100%" },
    enter: { y: "0%" },
    leave: { y: "-100%" },
    config: CURTAIN_SPRING,
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label="Open menu"
        className="grid size-[3.125rem] place-items-center rounded-full border border-hairline bg-accent lg:hidden"
      >
        <span aria-hidden="true" className="flex w-5 flex-col gap-1.5">
          <span className="h-px w-full bg-foreground" />
          <span className="h-px w-full bg-foreground" />
        </span>
      </button>

      {transitions(
        (style, open) =>
          open && (
            <animated.div
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              style={{ y: style.y }}
              className="fixed inset-0 z-30 flex flex-col justify-between overflow-hidden bg-foreground px-5 pb-10 pt-24 lg:hidden"
            >
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                /* Lands exactly on the burger it replaces, so the control does
                   not appear to jump as the panel arrives. */
                className="absolute right-2.5 top-2.5 grid size-[3.125rem] place-items-center rounded-full border border-hairline bg-accent"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="w-5 fill-none stroke-current"
                  strokeWidth="1"
                >
                  <path d="M4 4l12 12M16 4L4 16" />
                </svg>
              </button>

              <nav aria-label="Primary">
                <ul className="flex flex-col gap-6">
                  {nav.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        className="text-menu leading-none text-surface"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* The header's CTA does not fit beside a logo and a burger, so it
                  lives here — the one place on a phone where there is room for
                  it to be the size it is in the design. */}
              <Link
                href="#request"
                onClick={close}
                className="flex h-[3.125rem] items-center justify-center rounded-full border border-hairline bg-accent text-body leading-[1.2]"
              >
                {cta}
              </Link>
            </animated.div>
          ),
      )}
    </>
  );
};
