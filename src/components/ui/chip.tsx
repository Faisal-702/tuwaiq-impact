import type { ReactNode } from "react";
import { CategoryIcon, categoryAccent } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryChip({
  name,
  icon,
  accent,
  size = "sm",
  className,
}: {
  name: string;
  icon: string;
  accent: string;
  size?: "xs" | "sm";
  className?: string;
}) {
  const a = categoryAccent(accent);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        size === "xs" ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-1 text-xs",
        a.chip,
        className,
      )}
    >
      <CategoryIcon name={icon} aria-hidden className={size === "xs" ? "size-3" : "size-3.5"} strokeWidth={2} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "teal" | "purple" | "amber" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-canvas text-ink-soft ring-line",
    teal: "bg-mint-soft text-teal-deep ring-teal/25",
    purple: "bg-lavender-soft text-purple-ink ring-purple/20",
    amber: "bg-[#fdf6e7] text-[#8a6413] ring-[#e9cf8f]/60",
    danger: "bg-danger-soft text-danger-ink ring-danger-ink/15",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
