"use client";

// 📖 Docs: obsidian/frontend/components/common.md

import { useSpring } from "@react-spring/web";
import { useEffect, useRef, useState } from "react";

import { useLoop } from "@/hooks/animation/use-render-loop";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useWindowSize } from "@/hooks/use-window-size";
import { readCssColor, type Rgb } from "@/utils/color";
import { transformRange } from "@/utils/math";

import { captureFrames } from "./capture-frames";
import {
  createHalftoneRenderer,
  type HalftoneRenderer,
} from "./halftone-renderer";

/** Beyond 2x the extra pixels cost far more than they show. */
const MAX_DPR = 2;

/** Trails the pointer — loose enough to glide, tight enough to feel connected. */
const POINTER_SPRING = { tension: 120, friction: 26 } as const;

/**
 * Don't chase a seek closer than half a frame — the decoder would never settle
 * and the picture would sit permanently one seek behind.
 */
const SEEK_EPSILON = 1 / 60;

/**
 * Heavily overdamped (ζ ≈ 2.1) — the wave takes some 2.5s to climb the screen.
 * The field is the largest thing on screen, and the largest thing should be the
 * slowest, or it arrives before the eye has anywhere to go. Overdamped also
 * means the wave eases as it reaches the top rather than slamming into it.
 */
const REVEAL_SPRING = { tension: 40, friction: 26 } as const;

/** Fallbacks if a token is missing, so the shader still renders something sane. */
const FALLBACK_COLORS: Record<"bg" | "inkLight" | "inkMid" | "inkDeep", Rgb> = {
  bg: [1, 1, 1],
  inkLight: [0.62, 0.8, 0.91],
  inkMid: [0.25, 0.39, 0.82],
  inkDeep: [0.23, 0.11, 0.43],
};

export interface HalftoneVideoProps {
  /** Absolute path to the source video, e.g. `/assets/hero/clip.mp4`. */
  src: string;
  /** Dot cell size, CSS px — smaller means a finer, denser field. */
  cellSize?: number;
  /**
   * Dot size at full brightness, 0–1 of the largest that still fits inside its
   * cell with its feather. Clamped: past that the cell clips the dot into a
   * square, and round dots are the whole point.
   */
  dotScale?: number;
  /**
   * Extra edge blur, in cells, *on top of* antialiasing — `0` leaves the dots
   * as crisp as the pixel grid allows. Blur also caps how large a dot can grow
   * (see `dotScale`), so a softer field is a lighter one; recheck `gain` after
   * raising it.
   */
  softness?: number;
  /** Exposure applied to the sampled luminance — raise it for dark footage. */
  gain?: number;
  /** Below 1 lifts midtones into larger dots. */
  gamma?: number;
  /** Flip the image horizontally — reverses which way the subject faces. */
  mirror?: boolean;
  /**
   * How far the picture leans away from the pointer, as a perspective plane.
   * `0` is flat on; past ~`0.4` it stops reading as depth and starts to smear.
   * The dot grid never leans — only what each cell reads from.
   */
  tilt?: number;
  /**
   * How tightly the three ink stops pack around the centre of the frame. `1`
   * spreads them over the whole viewport, which leaves a centred subject
   * showing only the ramp's middle; raise it until the subject spans the range.
   */
  inkSpread?: number;
  /**
   * Map the pointer's horizontal position onto the clip's timeline instead of
   * playing it: the left edge of the window is the first frame, the right edge
   * the last. For footage that is a single camera or subject move, this reads
   * as the subject tracking the cursor.
   *
   * The clip's motion *is* the interaction, so it has to be one continuous
   * sweep — a clip that loops or changes shot will jump around under the
   * pointer.
   */
  pointerScrub?: boolean;
  /**
   * Stills to decode across the clip for `pointerScrub`. More means finer
   * motion but a longer decode and more memory (each frame is ~300 kB).
   */
  scrubFrames?: number;
  /**
   * Whether the field is developed in. `false` holds the canvas as a blank sheet
   * of `--halftone-bg`; flipping it to `true` sends a wave up the screen and the
   * picture develops out of the paper behind it, bottom to top.
   *
   * The subject is made of dots, so it has no fade or slide of its own to enter
   * on — this is the medium's own way in. Defaults to `true`: a field with
   * nothing to wait for should not be sitting invisible.
   */
  reveal?: boolean;
  /**
   * How thick the developing wave is, in screen heights. Small values read as a
   * hard scan line; past ~`0.5` the wave is taller than the screen and the whole
   * field just fades up together.
   */
  revealBand?: number;
  className?: string;
}

/**
 * Full-bleed video background rendered as a soft halftone dot field.
 *
 * The video never paints directly: each frame is sampled once per cell, and the
 * cell's brightness sets both the size of its dot and how deep a shade it takes
 * between the two ink tokens. The radius is continuous rather than quantised
 * into a ramp, so dots grow and shrink smoothly.
 *
 * Sizes itself from the window, so mount it as a fixed background (its default
 * `className`) rather than inside a scrolling container. Without WebGL2 it
 * degrades to the plain `object-cover` video.
 *
 * Pass `reveal` to hold the field blank and develop it in on cue — a wave that
 * climbs the screen, bottom to top. See the prop.
 */
export const HalftoneVideo = ({
  src,
  cellSize = 9,
  dotScale = 0.72,
  softness = 0,
  gain = 1.9,
  gamma = 0.62,
  mirror = false,
  tilt = 0,
  inkSpread = 2.5,
  pointerScrub = false,
  scrubFrames = 120,
  reveal = true,
  revealBand = 0.28,
  className = "fixed inset-0 -z-10",
}: HalftoneVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HalftoneRenderer | null>(null);
  const framesRef = useRef<ImageBitmap[]>([]);
  const colorsRef = useRef(FALLBACK_COLORS);
  const dprRef = useRef(1);

  const [isSupported, setIsSupported] = useState(true);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isCoarsePointer = useCoarsePointer();
  const { width, height } = useWindowSize();

  /**
   * Two ways to scrub, because the two pointers can afford different things.
   *
   * A mouse moves continuously, so it needs a new picture every ~16ms — far
   * faster than a seek settles (~25–65ms). That path pre-decodes the clip into
   * stills and scrubbing becomes an array lookup.
   *
   * A finger only aims when it taps. Seeking the `<video>` itself is slower but
   * good enough for a discrete target, and it avoids `createImageBitmap` on a
   * paused video — 120 decodes that WebKit is not reliable at, on the platform
   * where every iOS browser is WebKit. Fewer moving parts on the platform that
   * has fewer guarantees.
   */
  const frameScrub = pointerScrub && !isCoarsePointer;
  const seekScrub = pointerScrub && isCoarsePointer;

  // Spring-smoothed so the clip glides to the pointer instead of stepping to
  // it. Starts centred and flat, which is where an untouched page sits.
  const [{ progress, tiltX, tiltY }, pointerApi] = useSpring(() => ({
    progress: 0.5,
    tiltX: 0,
    tiltY: 0,
    config: POINTER_SPRING,
  }));

  // Read inside the loop rather than rendered, so developing the field in costs
  // no re-renders — same reason the pointer values above are springs, not state.
  // It drives the wave's *position*, not the dot size: which dots are up yet is
  // a question about where they sit, so the shader answers it per cell.
  const { wave } = useSpring({
    from: { wave: 0 },
    wave: reveal ? 1 : 0,
    config: REVEAL_SPRING,
  });

  // Sampled into a ref, not read per frame: a `getComputedStyle` on every draw
  // would force a style flush 60 times a second to catch four values that hold
  // still almost always.
  //
  // "Almost" is the colour scheme. The `--halftone-*` tokens have a
  // `prefers-color-scheme: dark` set, so they change when the OS does — at dusk,
  // unprompted, with the page open. CSS repaints itself; a value copied into a
  // ref does not, and the field would keep painting yesterday's ink on today's
  // ground. So the sample is a function, and the media query is what calls it
  // again. Nothing else moves these: retuning the field is still an edit to
  // `globals.css` plus a reload.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sampleColors = () => {
      colorsRef.current = {
        bg: readCssColor(canvas, "--halftone-bg", FALLBACK_COLORS.bg),
        inkLight: readCssColor(
          canvas,
          "--halftone-ink-light",
          FALLBACK_COLORS.inkLight,
        ),
        inkMid: readCssColor(
          canvas,
          "--halftone-ink-mid",
          FALLBACK_COLORS.inkMid,
        ),
        inkDeep: readCssColor(
          canvas,
          "--halftone-ink-deep",
          FALLBACK_COLORS.inkDeep,
        ),
      };
    };

    sampleColors();

    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", sampleColors);
    return () => scheme.removeEventListener("change", sampleColors);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    dprRef.current = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    const renderer = createHalftoneRenderer({ canvas });
    if (!renderer) {
      setIsSupported(false);
      return;
    }
    rendererRef.current = renderer;
    // Size it now rather than waiting for the (debounced) resize effect —
    // otherwise the first frames draw into the canvas's default 300x150.
    renderer.resize(
      Math.round(window.innerWidth * dprRef.current),
      Math.round(window.innerHeight * dprRef.current),
    );

    return () => {
      rendererRef.current = null;
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set imperatively too: a muted video is the only kind allowed to autoplay,
    // and the attribute alone isn't always honoured on first mount.
    video.muted = true;
    if (prefersReducedMotion) {
      video.pause();
      return;
    }
    // Playback starts even when the clip is only going to be scrubbed. iOS
    // ignores `preload` and will not buffer a *paused* video, so parking it
    // before a frame exists means `loadeddata` never fires, `readyState` never
    // reaches HAVE_CURRENT_DATA, and neither the stills nor the live-video
    // fallback have anything to draw — the hero comes up blank on a phone while
    // looking fine on a desktop. The capture effect parks it once it has data.
    //
    // Rejected autoplay leaves the first frame up — nothing to recover from.
    void video.play().catch(() => {});
  }, [prefersReducedMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!pointerScrub || !video) return;

    let cancelled = false;
    const frames: ImageBitmap[] = [];
    const isCancelled = () => cancelled;

    const start = async () => {
      // Metadata is not enough: `createImageBitmap` needs a decoded frame, and
      // throws `InvalidStateError` on a video that only knows its dimensions.
      if (video.readyState < video.HAVE_CURRENT_DATA) {
        await new Promise<void>((resolve) => {
          const done = () => {
            video.removeEventListener("loadeddata", done);
            resolve();
          };
          video.addEventListener("loadeddata", done);
        });
      }
      if (cancelled) return;

      // Parked only now that a frame exists: seeking a playing video fights the
      // decoder, but pausing any earlier is what stops a phone from buffering
      // at all (see the playback effect above).
      video.pause();

      // Seek-scrubbing reads the `<video>` live, so there is nothing to decode.
      if (!frameScrub) return;

      try {
        await captureFrames({
          video,
          count: scrubFrames,
          isCancelled,
          // Publish each frame as it lands: the loop reads whatever exists, so
          // the head of the clip is already scrubbable while the tail decodes.
          onFrame: (frame) => {
            frames.push(frame);
            framesRef.current = frames;
          },
        });
      } catch (error) {
        // Leaves the loop on its live-video fallback: a still hero rather than
        // a blank one.
        console.error("[halftone-video] frame capture failed:", error);
      }
    };

    void start();

    return () => {
      cancelled = true;
      framesRef.current = [];
      frames.forEach((frame) => frame.close());
    };
  }, [pointerScrub, frameScrub, scrubFrames, src]);

  const tracksPointer = pointerScrub || tilt !== 0;

  useEffect(() => {
    if (!tracksPointer) return;

    const aimAt = (event: PointerEvent) =>
      pointerApi.start({
        progress: transformRange(event.clientX, 0, window.innerWidth, 0, 1),
        tiltX: transformRange(event.clientX, 0, window.innerWidth, -1, 1),
        tiltY: transformRange(event.clientY, 0, window.innerHeight, -1, 1),
      });

    // Bound to the window, not the canvas: as a background it sits under the
    // page content and would never receive the events itself.
    //
    // Two events for two kinds of pointer. A mouse hovers, so `pointermove`
    // alone tracks it. A finger only exists while it touches, so a touch screen
    // emits nothing until it lands: `pointerdown` gives the tap its own aim, and
    // `pointermove` then follows a drag. Both feed the same spring, which glides
    // the clip from wherever it is to the new mark rather than cutting — so a
    // tap left of centre turns the head left, a tap right turns it right, and
    // how far out you tap decides how far it travels.
    window.addEventListener("pointerdown", aimAt, { passive: true });
    window.addEventListener("pointermove", aimAt, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", aimAt);
      window.removeEventListener("pointermove", aimAt);
    };
  }, [tracksPointer, pointerApi]);

  useEffect(() => {
    if (!width || !height) return;
    const dpr = dprRef.current;
    rendererRef.current?.resize(
      Math.round(width * dpr),
      Math.round(height * dpr),
    );
  }, [width, height]);

  useLoop(
    () => {
      const renderer = rendererRef.current;
      const video = videoRef.current;
      if (!renderer || !video) return;

      const shared = {
        cell: cellSize * dprRef.current,
        dotScale,
        reveal: wave.get(),
        revealBand,
        softness,
        gain,
        gamma,
        mirror,
        tilt: [tiltX.get() * tilt, tiltY.get() * tilt] as [number, number],
        inkSpread,
        ...colorsRef.current,
      };

      // Aim the parked clip at the spring. Skipped while a seek is in flight —
      // `video.seeking` is the decoder saying it is busy, and queueing another
      // target on top only throws away the one it is working on. The result is
      // a head turn at whatever rate the decoder can manage rather than a
      // stalled one, and it needs no decoded stills to do it.
      if (seekScrub && !video.seeking && Number.isFinite(video.duration)) {
        const target =
          progress.get() * Math.max(video.duration - SEEK_EPSILON, 0);
        if (Math.abs(video.currentTime - target) > SEEK_EPSILON) {
          video.currentTime = target;
        }
      }

      const frames = framesRef.current;
      if (frameScrub && frames.length) {
        // Clamp into what has decoded so far, not the eventual count.
        const index = Math.max(
          Math.min(
            Math.round(progress.get() * (scrubFrames - 1)),
            frames.length - 1,
          ),
          0,
        );
        const frame = frames[index];
        renderer.render({
          ...shared,
          source: frame,
          sourceKey: index,
          sourceSize: [frame.width, frame.height],
        });
        return;
      }

      // No stills yet (still decoding, or the capture failed) — fall back to
      // the video element itself so the hero is never blank.
      if (video.readyState < video.HAVE_CURRENT_DATA) return;
      if (!video.videoWidth || !video.videoHeight) return;

      renderer.render({
        ...shared,
        source: video,
        sourceKey: video.currentTime,
        sourceSize: [video.videoWidth, video.videoHeight],
      });
    },
    { framerate: 0 },
  );

  return (
    <div aria-hidden="true" className={className}>
      <video
        ref={videoRef}
        src={src}
        className="size-full object-cover"
        loop
        muted
        playsInline
        preload="auto"
      />
      {isSupported && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full bg-halftone-bg"
        />
      )}
    </div>
  );
};
