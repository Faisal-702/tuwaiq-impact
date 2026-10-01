import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  body,
  action,
  id,
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  action?: ReactNode;
  id?: string;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <Tag
          id={id}
          className={cn(
            "font-bold tracking-[-0.025em] text-ink rtl:tracking-normal",
            Tag === "h1" ? "mt-3 text-4xl sm:text-5xl" : "mt-3 text-3xl sm:text-[2.375rem] sm:leading-tight",
          )}
        >
          {title}
        </Tag>
        {body ? <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">{body}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
