"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** The site's loading animation (Lottie JSON served from /public). */
export const LOADING_ANIMATION_URL = "/lottie/loading.json";

type LottiePlayer = typeof import("lottie-web/build/player/lottie_light").default;
type Assets = { lottie: LottiePlayer; data: unknown };

let assets: Promise<Assets> | null = null;

/**
 * Loads the player (lottie-web's light SVG build, ~47 KB gzipped, in its own
 * chunk) and the animation once per page session; later loaders reuse both.
 */
export function preloadLoadingAnimation(): Promise<Assets> {
  assets ??= Promise.all([
    import("lottie-web/build/player/lottie_light").then((m) => m.default),
    fetch(LOADING_ANIMATION_URL).then((r) => {
      if (!r.ok) throw new Error(`Loading animation: HTTP ${r.status}`);
      return r.json() as Promise<unknown>;
    }),
  ])
    .then(([lottie, data]) => ({ lottie, data }))
    .catch((error) => {
      assets = null; // allow a later retry
      throw error;
    });
  return assets;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The shared loading animation. Fixed size, so nothing moves while the
 * animation loads; with reduced motion it shows a still frame. If the
 * animation cannot be loaded, a plain spinner is shown instead.
 */
export function LoadingAnimation({ size = 88, className }: { size?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    preloadLoadingAnimation()
      .then(({ lottie, data }) => {
        if (cancelled || !ref.current) return;
        const still = prefersReducedMotion();
        const animation = lottie.loadAnimation({
          container: ref.current,
          renderer: "svg",
          loop: !still,
          autoplay: !still,
          // The player mutates the data it is given: pass a copy.
          animationData: structuredClone(data),
          rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: true },
        });
        if (still) animation.addEventListener("DOMLoaded", () => animation.goToAndStop(Math.floor(animation.totalFrames / 2), true));
        destroy = () => animation.destroy();
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, []);

  return (
    <div
      aria-hidden
      dir="ltr"
      data-testid="loading-animation"
      className={cn("grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <LoaderCircle className="size-1/3 animate-spin text-purple motion-reduce:animate-none" />
      ) : (
        <div ref={ref} className="size-full" />
      )}
    </div>
  );
}
