import { cn } from "@/lib/utils";

/*
 * Decorative "mosaic" of soft rotated tiles in the platform colours, used on
 * the edges of the landing sections (as in the visual identity reference).
 * Purely decorative: hidden from assistive technology.
 */

const TILES: { x: number; y: number; s: number; c: string }[] = [
  { x: 64, y: 0, s: 22, c: "bg-teal/70" },
  { x: 36, y: 26, s: 26, c: "bg-mint" },
  { x: 72, y: 34, s: 18, c: "bg-violet/45" },
  { x: 10, y: 56, s: 20, c: "bg-teal/35" },
  { x: 50, y: 64, s: 30, c: "bg-lavender" },
  { x: 84, y: 76, s: 16, c: "bg-teal-strong/50" },
  { x: 26, y: 92, s: 18, c: "bg-violet/30" },
  { x: 62, y: 104, s: 22, c: "bg-mint" },
  { x: 0, y: 120, s: 16, c: "bg-lavender" },
  { x: 40, y: 132, s: 14, c: "bg-teal/45" },
];

export function Mosaic({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <div aria-hidden className={cn("pointer-events-none relative h-40 w-28", flip && "-scale-x-100", className)}>
      {TILES.map((t, i) => (
        <span
          key={i}
          className={cn("absolute rotate-45 rounded-[5px]", t.c)}
          style={{ insetInlineStart: t.x, top: t.y, width: t.s, height: t.s }}
        />
      ))}
    </div>
  );
}
