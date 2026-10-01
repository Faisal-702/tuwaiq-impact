"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export function YearSwitch({ years, current }: { years: string[]; current: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const go = (year: string | null) =>
    startTransition(() => router.replace(year ? `${pathname}?year=${encodeURIComponent(year)}` : pathname, { scroll: false }));

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", pending && "opacity-70")}>
      <div role="group" aria-label={t.leaderboard.title} className="inline-flex rounded-2xl bg-canvas p-1 ring-1 ring-inset ring-line-soft">
        <button
          type="button"
          aria-pressed={!current}
          onClick={() => go(null)}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-medium transition",
            !current ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink",
          )}
        >
          {t.leaderboard.overall}
        </button>
        <button
          type="button"
          aria-pressed={!!current}
          disabled={years.length === 0}
          onClick={() => go(current ?? years[0])}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50",
            current ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink",
          )}
        >
          {t.leaderboard.byYear}
        </button>
      </div>
      {current ? (
        <div className="sm:w-48">
          <label htmlFor="lb-year" className="sr-only">
            {t.leaderboard.selectYear}
          </label>
          <Select id="lb-year" value={current} onChange={(e) => go(e.target.value)} className="h-11">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
    </div>
  );
}
