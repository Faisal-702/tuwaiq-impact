import { cn, initials } from "@/lib/utils";

/** Typographic monogram (students never have profile photos). */
export function StudentMonogram({ name, size = "md", className }: { name: string; size?: "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-mint-soft to-lavender-soft font-semibold text-teal-deep ring-1 ring-inset ring-line-soft",
        size === "lg" ? "size-20 text-2xl" : "size-12 text-base",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
