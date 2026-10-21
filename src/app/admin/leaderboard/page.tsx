import type { Metadata } from "next";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import { PointsEditor } from "@/components/admin/points-editor";
import { LeaderboardList } from "@/components/leaderboard/leaderboard-list";
import { YearSwitch } from "@/components/leaderboard/year-switch";
import { getI18n } from "@/i18n/server";
import { getLeaderboard, getLeaderboardYears } from "@/server/queries/public";
import { listProjectPoints } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.leaderboard.title };
}

export default async function AdminLeaderboardPage(props: PageProps<"/admin/leaderboard">) {
  const sp = await props.searchParams;
  const { t, locale } = await getI18n();
  // The year list and the requested year's data load concurrently. An unknown
  // year falls back to all years (rare: only for a hand-edited URL).
  const requested = typeof sp.year === "string" && sp.year ? sp.year : null;
  const [years, requestedRows, requestedPoints] = await Promise.all([
    getLeaderboardYears(),
    getLeaderboard(requested, 10),
    listProjectPoints(requested),
  ]);
  const year = requested && years.includes(requested) ? requested : null;
  const [rows, points] =
    year === requested ? [requestedRows, requestedPoints] : await Promise.all([getLeaderboard(null, 10), listProjectPoints(null)]);
  return (
    <>
      <AdminPageHeader title={t.admin.leaderboard.title} description={t.admin.leaderboard.intro} actions={<YearSwitch years={years} current={year} />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Panel title={t.admin.leaderboard.standings} bodyClassName="">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted">{t.leaderboard.emptyTitle}</p>
          ) : (
            <LeaderboardList rows={rows} t={t} locale={locale} compact />
          )}
        </Panel>
        <Panel title={t.admin.leaderboard.pointsTitle} description={t.admin.leaderboard.pointsIntro} bodyClassName="">
          {points.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted">{t.admin.overview.noData}</p>
          ) : (
            <PointsEditor rows={points} />
          )}
        </Panel>
      </div>
    </>
  );
}
