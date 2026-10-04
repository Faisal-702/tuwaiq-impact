import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LeaderboardList, medalLabel } from "@/components/leaderboard/leaderboard-list";
import { RankBadge } from "@/components/leaderboard/rank-badge";
import { YearSwitch } from "@/components/leaderboard/year-switch";
import { StudentMonogram } from "@/components/students/student-monogram";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { getI18n } from "@/i18n/server";
import { formatNumber, gradeLabel, localName, projectCount } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { getLeaderboard, getLeaderboardYears } from "@/server/queries/public";
import { requireViewer } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.leaderboard.title, description: t.leaderboard.intro };
}

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  await requireViewer();
  const sp = await props.searchParams;
  const { t, locale } = await getI18n();
  const years = await getLeaderboardYears();
  const year = typeof sp.year === "string" && years.includes(sp.year) ? sp.year : null;
  const rows = await getLeaderboard(year, 10);
  const podium = rows.filter((r) => r.rank <= 3).slice(0, 3);
  const rest = rows.slice(podium.length);
  // Visual order on wide screens: 2nd · 1st · 3rd.
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  return (
    <div className="container-page pb-8 pt-10 sm:pt-14">
      <SectionHeading
        as="h1"
        eyebrow={t.leaderboard.eyebrow}
        title={t.leaderboard.title}
        body={t.leaderboard.intro}
        action={<YearSwitch years={years} current={year} />}
      />

      {rows.length === 0 ? (
        <EmptyState icon={Trophy} title={t.leaderboard.emptyTitle} body={t.leaderboard.emptyBody} className="mt-12" />
      ) : (
        <>
          <ol className="mt-12 grid items-end gap-4 sm:grid-cols-3" aria-label={t.leaderboard.topTen}>
            {podiumOrder.map((row, i) => {
              const first = row.rank === 1;
              const name = localName(row, locale);
              return (
                <Reveal
                  as="li"
                  key={row.id}
                  delay={i * 0.06}
                  className={cn(first ? "sm:order-none" : "", podium.length === 3 && i === 1 ? "order-first sm:order-none" : "")}
                >
                  <Link
                    href={`/students/${row.slug}`}
                    className={cn(
                      "group relative flex flex-col items-center overflow-hidden rounded-[1.5rem] bg-white px-6 text-center ring-1 ring-line-soft transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift",
                      first ? "pb-8 pt-10 shadow-lift sm:pb-10 sm:pt-12" : "pb-7 pt-8 shadow-soft",
                    )}
                  >
                    {first ? (
                      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#e8c968,#d9ae45,#e8c968)]" />
                    ) : null}
                    <div className="relative">
                      <StudentMonogram name={name} size="lg" />
                      <span className="absolute -bottom-3 -end-4 rounded-full ring-4 ring-white">
                        <RankBadge rank={row.rank} label={medalLabel(row.rank, t)} size={first ? "lg" : "md"} />
                      </span>
                    </div>
                    <p className="mt-6 text-lg font-semibold text-ink group-hover:text-purple">{name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {[row.grade ? gradeLabel(row.grade, t.grades) : null, projectCount(row.projects, locale)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-5">
                      <span className={cn("font-bold tabular-nums text-ink", first ? "text-4xl" : "text-3xl")}>
                        {formatNumber(row.points, locale)}
                      </span>
                      <span className="ms-1.5 text-sm text-muted">{t.common.points}</span>
                    </p>
                  </Link>
                </Reveal>
              );
            })}
          </ol>

          {rest.length > 0 ? (
            <Reveal>
              <div className="mt-8 overflow-hidden rounded-[1.5rem] bg-white shadow-soft ring-1 ring-line-soft">
                <div className="grid grid-cols-[1fr_auto] border-b border-line-soft px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted rtl:tracking-normal">
                  <span>{t.leaderboard.student}</span>
                  <span>{t.leaderboard.points}</span>
                </div>
                <LeaderboardList rows={rest} t={t} locale={locale} />
              </div>
            </Reveal>
          ) : null}
        </>
      )}
    </div>
  );
}
