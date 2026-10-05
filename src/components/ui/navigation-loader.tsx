"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLinkStatus } from "next/link";
import { LoadingAnimation, preloadLoadingAnimation } from "@/components/ui/loading-animation";
import { useI18n } from "@/i18n/client";

/*
 * Navigation that cannot show a route loading state right away (a page
 * without `loading.tsx`, such as a project or student page, or a link that
 * was not prefetched yet) keeps the current page on screen until the next one
 * is ready. Links report that pending phase here, and <NavigationLoader />
 * shows the loading animation if it lasts.
 */
let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Rendered inside every Link (components/ui/link.tsx); renders nothing. */
export function LinkPendingReporter() {
  const { pending: isPending } = useLinkStatus();
  useEffect(() => {
    if (!isPending) return;
    pending++;
    emit();
    return () => {
      pending--;
      emit();
    };
  }, [isPending]);
  return null;
}

/** Mounted once (AppProviders): a small centered loading card while a navigation is pending. */
export function NavigationLoader() {
  const { t } = useI18n();
  const active = useSyncExternalStore(subscribe, () => pending > 0, () => false);

  // Warm up the player and the animation when the browser is idle, so the
  // first loader shows without delay. Skipped when the user saves data.
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saveData) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => void preloadLoadingAnimation().catch(() => {}));
    return () => cancel(id);
  }, []);

  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="navigation-loading"
      className="pointer-events-none fixed inset-0 z-[70] grid place-items-center"
    >
      <span className="sr-only">{t.common.loading}</span>
      <div className="loading-reveal grid size-24 place-items-center rounded-3xl bg-white/95 shadow-panel ring-1 ring-line-soft backdrop-blur">
        <LoadingAnimation size={72} />
      </div>
    </div>
  );
}
