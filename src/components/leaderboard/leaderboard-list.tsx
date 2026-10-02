import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatNumber, gradeLabel, localName, projectCount } from "@/i18n/format";
import type { LeaderboardRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RankBadge } from "./rank-badge";

export function medalLabel(rank: number, t: Dictionary) {
  return rank === 1 ? t.leaderboard.first : rank === 2 ? t.leaderboard.second : rank === 3 ? t.leaderboard.third : undefined;
}

export function LeaderboardList({
  rows,
  t,
  locale,
  compact,
  className,
}: {
  rows: LeaderboardRow[];
  t: Dictionary;
  locale: Locale;
  compact?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("divide-y divide-line-soft", className)}>
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/students/${row.slug}`}
            className={cn(
              "flex items-center gap-4 transition-colors hover:bg-canvas/80",
              compact ? "px-5 py-3.5" : "px-5 py-4 sm:px-6",
            )}
          >
            <RankBadge rank={row.rank} label={medalLabel(row.rank, t)} size={compact ? "sm" : "md"} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{localName(row, locale)}</p>
              <p className="text-sm text-muted">
                {[
                  row.grade ? gradeLabel(row.grade, t.grades) : null,
                  projectCount(row.projects, locale),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <p className="shrink-0 text-end">
              <span className="text-lg font-semibold tabular-nums text-ink">{formatNumber(row.points, locale)}</span>
              <span className="ms-1 text-sm text-muted">{t.common.pointsShort}</span>
            </p>
          </Link>
        </li>
      ))}
    </ol>
  );
}
