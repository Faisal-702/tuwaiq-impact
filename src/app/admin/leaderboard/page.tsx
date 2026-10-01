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
  const years = await getLeaderboardYears();
  const year = typeof sp.year === "string" && years.includes(sp.year) ? sp.year : null;
  const [rows, points] = await Promise.all([getLeaderboard(year, 10), listProjectPoints(year)]);
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
