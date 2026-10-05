import { CheckCircle2, FolderKanban, PlusCircle, Star, Users } from "lucide-react";
import Link from "@/components/ui/link";
import { ActivityList } from "@/components/admin/activity-list";
import { Columns, HorizontalBars } from "@/components/admin/charts";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import { LeaderboardList } from "@/components/leaderboard/leaderboard-list";
import { buttonClasses } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { formatMonth, formatNumber } from "@/i18n/format";
import { getLeaderboard } from "@/server/queries/public";
import { getOverview, listActivity } from "@/server/queries/admin";

export default async function AdminOverviewPage() {
  const { t, locale } = await getI18n();
  const [overview, leaders, activity] = await Promise.all([getOverview(), getLeaderboard(null, 5), listActivity({ limit: 8 })]);
  const { counts, byCategory, byMonth } = overview;

  const tiles = [
    { label: t.admin.overview.totalProjects, value: counts.total, icon: FolderKanban, tone: "bg-lavender-soft text-purple" },
    { label: t.admin.overview.totalStudents, value: counts.students, icon: Users, tone: "bg-mint-soft text-teal-deep" },
    { label: t.admin.overview.published, value: counts.published, icon: CheckCircle2, tone: "bg-mint-soft text-teal-deep" },
    { label: t.admin.overview.featured, value: counts.featured, icon: Star, tone: "bg-lavender-soft text-purple" },
  ];

  // Fold long tails into "Other" so the chart stays readable.
  const top = byCategory.slice(0, 7);
  const rest = byCategory.slice(7).reduce((sum, c) => sum + c.count, 0);
  const categoryData = [
    ...top.map((c) => ({ key: c.name_en, label: locale === "ar" ? c.name_ar : c.name_en, value: c.count })),
    ...(rest > 0 ? [{ key: "other", label: locale === "ar" ? "أخرى" : "Other", value: rest }] : []),
  ];
  const monthData = byMonth.map((m) => ({ key: m.month, label: formatMonth(m.month, locale), value: m.count }));
  const fmt = (n: number) => formatNumber(n, locale);

  return (
    <>
      <AdminPageHeader
        title={t.admin.overview.title}
        description={t.admin.overview.intro}
        actions={
          <Link href="/admin/projects/new" className={buttonClasses("primary", "md")}>
            <PlusCircle className="size-4" aria-hidden />
            {t.admin.nav.addProject}
          </Link>
        }
      />

      <dl className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[1.25rem] bg-white p-5 shadow-soft ring-1 ring-line-soft">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted">{tile.label}</dt>
              <span className={`grid size-9 place-items-center rounded-xl ${tile.tone}`}>
                <tile.icon className="size-[1.125rem]" aria-hidden />
              </span>
            </div>
            <dd className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-ink">{fmt(tile.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title={t.admin.overview.byCategory} description={t.admin.overview.publishedOnly}>
          {categoryData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">{t.admin.overview.noData}</p>
          ) : (
            <HorizontalBars data={categoryData} caption={t.admin.overview.byCategory} valueLabel={t.common.projects} locale={locale} />
          )}
        </Panel>
        <Panel title={t.admin.overview.byMonth} description={t.admin.overview.lastMonths}>
          <div className="pt-6">
            <Columns data={monthData} caption={t.admin.overview.byMonth} valueLabel={t.common.projects} locale={locale} labelEvery={2} />
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.25fr]">
        <Panel
          title={t.admin.overview.leaderboard}
          bodyClassName=""
          action={
            <Link href="/admin/leaderboard" className="text-sm font-medium text-purple hover:underline">
              {t.common.viewAll}
            </Link>
          }
        >
          {leaders.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted">{t.leaderboard.emptyTitle}</p>
          ) : (
            <LeaderboardList rows={leaders} t={t} locale={locale} compact />
          )}
        </Panel>
        <Panel
          title={t.admin.overview.recentActivity}
          bodyClassName=""
          action={
            <Link href="/admin/activity" className="text-sm font-medium text-purple hover:underline">
              {t.common.viewAll}
            </Link>
          }
        >
          <ActivityList items={activity.items} t={t} locale={locale} />
        </Panel>
      </div>
    </>
  );
}
