import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-canvas/60 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="relative mb-5 grid size-14 place-items-center rounded-2xl bg-white shadow-soft ring-1 ring-line">
        <Icon aria-hidden className="size-6 text-teal-deep" strokeWidth={1.75} />
      </div>
      <p className="text-lg font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-[0.9375rem] leading-relaxed text-muted">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
