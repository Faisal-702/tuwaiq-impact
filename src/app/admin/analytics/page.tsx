import type { Metadata } from "next";
import Link from "next/link";
import { Columns, HorizontalBars } from "@/components/admin/charts";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import { getI18n } from "@/i18n/server";
import { formatNumber, gradeLabel } from "@/i18n/format";
import { getAnalytics } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.analytics.title };
}

export default async function AdminAnalyticsPage() {
  const { t, locale } = await getI18n();
  const { totals, viewsByDay, topViewed, byGrade, contentMix } = await getAnalytics();
  const fmt = (n: number) => formatNumber(n, locale);
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d));

  const tiles = [
    { label: t.admin.analytics.totalViews, value: totals.total_views },
    { label: t.admin.analytics.views30Short, value: totals.views_30 },
    { label: t.admin.analytics.avgPoints, value: totals.avg_points },
    { label: t.admin.analytics.mediaItems, value: totals.media_items },
  ];

  return (
    <>
      <AdminPageHeader title={t.admin.analytics.title} description={t.admin.analytics.intro} />
      <dl className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[1.25rem] bg-white p-5 shadow-soft ring-1 ring-line-soft">
            <dt className="text-sm text-muted">{tile.label}</dt>
            <dd className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink">{fmt(tile.value)}</dd>
          </div>
        ))}
      </dl>

      <Panel title={t.admin.analytics.views30} className="mt-6">
        {totals.views_30 === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{t.admin.analytics.noViews}</p>
        ) : (
          <div className="pt-6">
            <Columns
              data={viewsByDay.map((d) => ({ key: d.day, label: dayLabel(d.day), value: d.count }))}
              caption={t.admin.analytics.views30}
              valueLabel={t.common.views}
              color="#6D4AFF"
              locale={locale}
              labelEvery={5}
              height={220}
            />
          </div>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title={t.admin.analytics.topViewed} bodyClassName="" className="xl:col-span-1">
          {topViewed.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted">{t.admin.overview.noData}</p>
          ) : (
            <ol className="divide-y divide-line-soft">
              {topViewed.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 px-6 py-3">
                  <span className="w-5 text-sm tabular-nums text-muted">{i + 1}</span>
                  <Link href={`/projects/${p.slug}`} target="_blank" dir="auto" className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-purple">
                    {p.title}
                  </Link>
                  <span className="text-sm tabular-nums text-ink-soft">{fmt(p.view_count)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title={t.admin.analytics.byGrade}>
          {byGrade.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">{t.admin.overview.noData}</p>
          ) : (
            <HorizontalBars
              data={byGrade.map((g) => ({
                key: String(g.grade),
                label: g.grade ? gradeLabel(g.grade, t.grades.label) : "—",
                value: g.count,
              }))}
              caption={t.admin.analytics.byGrade}
              valueLabel={t.common.projects}
              color="#0D9488"
              locale={locale}
            />
          )}
        </Panel>
        <Panel title={t.admin.analytics.contentMix}>
          {contentMix.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">{t.admin.overview.noData}</p>
          ) : (
            <HorizontalBars
              data={contentMix.map((c) => ({
                key: c.kind,
                label: t.projects.contentTypes[c.kind as "image"] ?? c.kind,
                value: c.count,
              }))}
              caption={t.admin.analytics.contentMix}
              valueLabel={t.common.projects}
              locale={locale}
            />
          )}
        </Panel>
      </div>
    </>
  );
}
