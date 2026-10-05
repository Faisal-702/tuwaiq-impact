"use client";

import NextLink from "next/link";
import { useState, type ComponentProps } from "react";

type LinkProps = ComponentProps<typeof NextLink>;

/**
 * `next/link` that prefetches on intent (hover, keyboard focus or touch)
 * instead of as soon as the link scrolls into view.
 *
 * Every page here is rendered per request (session cookies), so the default
 * viewport prefetching rendered each visible link's page on the server in the
 * background: a dashboard view triggered a dozen or more full renders, each
 * with its own database queries, competing with the page the user actually
 * opened. Prefetching on intent keeps navigation instant (the route's loading
 * state is prefetched while the pointer is on the link) without that load.
 * `prefetch={false}` still disables prefetching entirely.
 */
export default function Link({ prefetch, onMouseEnter, onTouchStart, onFocus, ...props }: LinkProps) {
  const [intent, setIntent] = useState(false);
  return (
    <NextLink
      {...props}
      prefetch={prefetch === false || !intent ? false : (prefetch ?? null)}
      onMouseEnter={(e) => {
        setIntent(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
    />
  );
}
