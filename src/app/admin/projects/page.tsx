import { FolderKanban, PlusCircle, Search, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProjectRowActions } from "@/components/admin/project-actions";
import { ProjectThumb } from "@/components/admin/project-thumb";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { getI18n } from "@/i18n/server";
import { formatDate, formatNumber, localName } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { getStatusCounts, listAdminProjects } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.projects.title };
}

const TABS = ["all", "draft", "published", "featured"] as const;

export default async function AdminProjectsPage(props: PageProps<"/admin/projects">) {
  const sp = await props.searchParams;
  const { t, locale } = await getI18n();
  const status = TABS.includes(sp.status as (typeof TABS)[number]) ? (sp.status as (typeof TABS)[number]) : "all";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const [projects, counts] = await Promise.all([
    listAdminProjects({ status: status === "all" ? undefined : status, q }),
    getStatusCounts(),
  ]);

  const href = (s: string) => {
    const p = new URLSearchParams();
    if (s !== "all") p.set("status", s);
    if (q) p.set("q", q);
    return `/admin/projects${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        title={t.admin.projects.title}
        description={t.admin.projects.intro}
        actions={
          <Link href="/admin/projects/new" className={buttonClasses("primary", "md")}>
            <PlusCircle className="size-4" aria-hidden />
            {t.admin.projects.add}
          </Link>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label={t.admin.projects.columns.status} className="scrollbar-none -mx-1 overflow-x-auto px-1">
          <ul className="inline-flex rounded-2xl bg-white p-1 shadow-soft ring-1 ring-line-soft">
            {TABS.map((tab) => (
              <li key={tab}>
                <Link
                  href={href(tab)}
                  aria-current={status === tab ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition",
                    status === tab ? "bg-ink text-white" : "text-ink-soft hover:text-ink",
                  )}
                >
                  {t.admin.projects.tabs[tab]}
                  <span className={cn("rounded-full px-1.5 text-xs tabular-nums", status === tab ? "bg-white/20" : "bg-canvas text-muted")}>
                    {formatNumber(tab === "all" ? counts.all : counts[tab], locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form role="search" className="relative lg:w-80">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="admin-project-search" className="sr-only">
            {t.admin.projects.search}
          </label>
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            id="admin-project-search"
            name="q"
            type="search"
            defaultValue={q}
            dir="auto"
            placeholder={t.admin.projects.search}
            className="h-11 w-full rounded-xl border border-line bg-white ps-10 pe-4 text-sm shadow-soft focus:border-purple/50 focus:outline-none focus:ring-4 focus:ring-purple/10"
          />
        </form>
      </div>

      {projects.length === 0 ? (
        counts.all === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={t.admin.projects.emptyTitle}
            body={t.admin.projects.emptyBody}
            className="bg-white"
            action={
              <Link href="/admin/projects/new" className={buttonClasses("primary", "md")}>
                <PlusCircle className="size-4" aria-hidden />
                {t.admin.projects.add}
              </Link>
            }
          />
        ) : (
          <EmptyState icon={FolderKanban} title={t.admin.projects.noMatches} className="bg-white" />
        )
      ) : (
        <div className="overflow-hidden rounded-[1.25rem] bg-white shadow-soft ring-1 ring-line-soft">
          <table className="w-full text-sm">
            <thead className="hidden border-b border-line-soft text-start text-xs font-medium uppercase tracking-wider text-muted md:table-header-group rtl:tracking-normal">
              <tr>
                <th scope="col" className="px-5 py-3 text-start font-medium">{t.admin.projects.columns.project}</th>
                <th scope="col" className="hidden px-3 py-3 text-start font-medium xl:table-cell">{t.admin.projects.columns.category}</th>
                <th scope="col" className="px-3 py-3 text-start font-medium">{t.admin.projects.columns.status}</th>
                <th scope="col" className="hidden px-3 py-3 text-end font-medium lg:table-cell">{t.admin.projects.columns.points}</th>
                <th scope="col" className="hidden px-3 py-3 text-end font-medium lg:table-cell">{t.admin.projects.columns.views}</th>
                <th scope="col" className="hidden px-3 py-3 text-start font-medium xl:table-cell">{t.admin.projects.columns.updated}</th>
                <th scope="col" className="px-5 py-3 text-end font-medium">
                  <span className="sr-only">{t.admin.projects.columns.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {projects.map((p) => (
                <tr key={p.id} className="group transition-colors hover:bg-canvas/60" data-testid="admin-project-row">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3.5">
                      <ProjectThumb src={p.thumb} icon={p.category_icon} />
                      <div className="min-w-0">
                        <Link href={`/admin/projects/${p.id}/edit`} dir="auto" className="line-clamp-1 font-medium text-ink hover:text-purple">
                          {p.title}
                        </Link>
                        <p className="line-clamp-1 text-muted">
                          {p.students.map((s) => localName(s, locale)).join(locale === "ar" ? "، " : ", ")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3.5 text-ink-soft xl:table-cell">{locale === "ar" ? p.category_ar : p.category_en}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {p.status === "published" ? <Badge tone="teal">{t.admin.projects.status.published}</Badge> : <Badge>{t.admin.projects.status.draft}</Badge>}
                      {p.is_featured ? (
                        <Badge tone="purple">
                          <Star className="size-3 fill-current" aria-hidden />
                          {t.admin.projects.status.featured}
                        </Badge>
                      ) : null}
                      {p.is_demo ? <Badge tone="amber">{t.common.demo}</Badge> : null}
                    </div>
                  </td>
                  <td className="hidden px-3 py-3.5 text-end tabular-nums text-ink lg:table-cell">{formatNumber(p.points, locale)}</td>
                  <td className="hidden px-3 py-3.5 text-end tabular-nums text-ink-soft lg:table-cell">{formatNumber(p.view_count, locale)}</td>
                  <td className="hidden px-3 py-3.5 text-muted xl:table-cell">{formatDate(p.updated_at, locale, "short")}</td>
                  <td className="px-5 py-3.5">
                    <ProjectRowActions id={p.id} slug={p.slug} title={p.title} status={p.status} featured={p.is_featured} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
