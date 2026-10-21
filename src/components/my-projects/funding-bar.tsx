import type { Funding } from "@/lib/funding";
import { cn } from "@/lib/utils";

/**
 * The funding progress bar: the filled part grows with the support recorded
 * (never the other way round). Same look on My Projects, Explore cards and
 * the project page. Works on the server and in the browser.
 */
export function FundingBar({ funding, label, className, size = "md" }: { funding: Funding; label?: string; className?: string; size?: "sm" | "md" }) {
  const width = funding.percent > 0 ? Math.max(funding.percent, 2) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(funding.percent)}
      className={cn("w-full overflow-hidden rounded-full bg-[#e2e7f3]", size === "sm" ? "h-1.5" : "h-2", className)}
      data-testid="funding-bar"
      data-percent={funding.percent}
    >
      <div className="h-full rounded-full bg-[#5cc5c2] transition-[width] duration-500 ease-out" style={{ width: `${width}%` }} />
    </div>
  );
}
