import { cn } from "@/lib/utils";

/** "Tuwaiq Impact | أثر طويق" text lockup. */
export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight text-ink", className)} dir="ltr">
      <span lang="en" className="whitespace-nowrap">
        <span className="text-gradient-brand">Tuwaiq</span> <span className="text-gradient-purple">Impact</span>
      </span>
      {!compact ? (
        <>
          <span aria-hidden className="h-4 w-px bg-line" />
          <span lang="ar" dir="rtl" className="whitespace-nowrap font-[family-name:var(--font-arabic)] text-teal-deep">
            أثر طويق
          </span>
        </>
      ) : null}
    </span>
  );
}

/** Small dotted motif inspired by the Ministry identity. */
export function DotMotif({ className }: { className?: string }) {
  const dots: { cx: number; cy: number; r: number; o: number }[] = [];
  const cols = 9;
  for (let c = 0; c < cols; c++) {
    const depth = Math.abs(c - (cols - 1) / 2);
    for (let r = 0; r < 3; r++) {
      dots.push({
        cx: 6 + c * 13,
        cy: 6 + r * 12 + (4 - depth) * 3.2,
        r: 2.2 + depth * 0.55,
        o: 0.35 + depth * 0.13,
      });
    }
  }
  return (
    <svg viewBox="0 0 116 56" className={className} aria-hidden>
      <defs>
        <linearGradient id="ti-dots" x1="0" x2="1">
          <stop offset="0" stopColor="#0F766E" />
          <stop offset="1" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="url(#ti-dots)" opacity={Math.min(d.o, 1)} />
      ))}
    </svg>
  );
}
