import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { ActivityList } from "@/components/admin/activity-list";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber } from "@/i18n/format";
import { listActivity } from "@/server/queries/admin";
import { ActivityFilter } from "@/components/admin/activity-filter";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.activity.title };
}

const PAGE = 30;

export default async function AdminActivityPage(props: PageProps<"/admin/activity">) {
  const sp = await props.searchParams;
  const { t, locale } = await getI18n();
  const action = typeof sp.action === "string" && sp.action in t.admin.activity.actions ? sp.action : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listActivity({ action, limit: PAGE * page });
  const more = new URLSearchParams();
  if (action) more.set("action", action);
  more.set("page", String(page + 1));

  return (
    <>
      <AdminPageHeader title={t.admin.activity.title} description={t.admin.activity.intro} actions={<ActivityFilter current={action ?? ""} />} />
      <Panel bodyClassName="">
        <ActivityList items={items} t={t} locale={locale} />
      </Panel>
      {items.length < total ? (
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="text-sm text-muted">
            {fmt(t.common.showing, { shown: formatNumber(items.length, locale), total: formatNumber(total, locale) })}
          </p>
          <Link href={`/admin/activity?${more}`} scroll={false} className={buttonClasses("secondary", "sm")}>
            {t.common.loadMore}
          </Link>
        </div>
      ) : null}
    </>
  );
}
