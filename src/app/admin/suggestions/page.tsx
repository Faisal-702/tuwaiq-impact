import { MessageSquareText, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SuggestionGradeBadge, SuggestionGradeFilter, SuggestionRowActions } from "@/components/admin/suggestion-admin";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber } from "@/i18n/format";
import { SUGGESTION_GRADES } from "@/lib/suggestions";
import { listSuggestions } from "@/server/queries/suggestions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.suggestions.title };
}

const PAGE = 30;

export default async function AdminSuggestionsPage(props: PageProps<"/admin/suggestions">) {
  const sp = await props.searchParams;
  const { t, locale } = await getI18n();
  const s = t.admin.suggestions;
  const grade = SUGGESTION_GRADES.find((g) => String(g) === sp.grade);
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listSuggestions({ grade, limit: PAGE * page });
  const more = new URLSearchParams();
  if (grade) more.set("grade", String(grade));
  more.set("page", String(page + 1));
  const dateParts = (iso: string) => {
    const d = new Date(iso);
    const tz = { timeZone: "Asia/Riyadh" } as const;
    const loc = locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
    return [
      new Intl.DateTimeFormat(loc, { ...tz, day: "numeric", month: "long", year: "numeric" }).format(d),
      new Intl.DateTimeFormat(loc, { ...tz, hour: "2-digit", minute: "2-digit" }).format(d),
    ];
  };

  return (
    <>
      <AdminPageHeader
        title={s.title}
        description={s.intro}
        actions={
          <Link href="/admin/projects/new" className={buttonClasses("primary", "md")}>
            <PlusCircle className="size-4" aria-hidden />
            {t.admin.nav.addProject}
          </Link>
        }
      />
      <section className="rounded-[1.25rem] bg-white shadow-soft ring-1 ring-line-soft">
        <div className="flex items-center justify-end border-b border-line-soft px-5 py-4">
          <SuggestionGradeFilter current={grade ? String(grade) : ""} />
        </div>
        {items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={MessageSquareText}
              title={grade ? s.emptyFilteredTitle : s.emptyTitle}
              body={grade ? s.emptyFilteredBody : s.emptyBody}
              action={
                grade ? (
                  <Link href="/admin/suggestions" className={buttonClasses("secondary", "sm")}>
                    {s.showAll}
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm" data-testid="suggestions-table">
              <thead className="border-b border-line-soft bg-canvas/70 text-[0.8125rem] text-ink-soft">
                <tr>
                  <th scope="col" className="w-12 px-5 py-3.5 text-start font-semibold">{s.number}</th>
                  <th scope="col" className="px-3 py-3.5 text-start font-semibold">{s.name}</th>
                  <th scope="col" className="px-3 py-3.5 text-start font-semibold">{s.grade}</th>
                  <th scope="col" className="px-3 py-3.5 text-start font-semibold">{s.suggestion}</th>
                  <th scope="col" className="px-3 py-3.5 text-start font-semibold">{s.date}</th>
                  <th scope="col" className="w-16 px-5 py-3.5 text-center font-semibold">{s.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {items.map((item, i) => {
                  const [day, time] = dateParts(item.created_at);
                  return (
                    <tr key={item.id} className="hover:bg-canvas/60" data-testid="admin-suggestion-row">
                      <td className="px-5 py-4 tabular-nums text-muted">{formatNumber(i + 1, locale)}</td>
                      <td dir="auto" className="max-w-[12rem] truncate px-3 py-4 font-medium text-ink">{item.name}</td>
                      <td className="px-3 py-4">
                        <SuggestionGradeBadge grade={item.grade} />
                      </td>
                      <td className="max-w-0 w-full px-3 py-4 text-ink-soft">
                        <p dir="auto" className="truncate" title={item.suggestion}>
                          {item.suggestion}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-[0.8125rem] leading-snug text-muted">
                        <time dateTime={item.created_at}>
                          <span className="block">{day}</span>
                          <span className="block">{time}</span>
                        </time>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center">
                          <SuggestionRowActions item={item} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {items.length < total ? (
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="text-sm text-muted">
            {fmt(t.common.showing, { shown: formatNumber(items.length, locale), total: formatNumber(total, locale) })}
          </p>
          <Link href={`/admin/suggestions?${more}`} scroll={false} className={buttonClasses("secondary", "sm")}>
            {t.common.loadMore}
          </Link>
        </div>
      ) : null}
    </>
  );
}
