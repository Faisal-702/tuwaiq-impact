import { ChevronLeft, ChevronRight, Handshake, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { OfficialLogos } from "@/components/landing/official-logos";
import { PartyChip, SupportChip } from "@/components/admin/partners/partner-chips";
import { PageSizeSelect, PartnerFilters, PartnerRowMenu } from "@/components/admin/partners/partners-admin";
import Link from "@/components/ui/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { fmt, formatNumber } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { ORGANIZATION_CATEGORIES, PARTNER_TYPES, SUPPORT_TYPES } from "@/lib/partners";
import { cn } from "@/lib/utils";
import { listPartnerApplications, type PartnerFilters as Filters } from "@/server/queries/partners";
import skylineImage from "../../../../public/images/entry-scene-right.webp";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.partners.title };
}

const PAGE_SIZES = [10, 20, 50] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
const pick = <T extends string>(all: readonly T[], value: string | undefined) => all.find((v) => v === value);
const validDate = (value: string | undefined) => (value && DATE_RE.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined);

/** 2026/10/14 in Riyadh time (as on the reference design). */
function shortDate(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")}`;
}

/** Page numbers to show: 1 … 4 5 6 … 12 */
function pageList(current: number, last: number): (number | "gap")[] {
  const pages = new Set([1, last, current - 1, current, current + 1].filter((n) => n >= 1 && n <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

export default async function AdminPartnersPage(props: PageProps<"/admin/partners">) {
  const sp = await props.searchParams;
  const { t, locale } = await getI18n();
  const a = t.admin.partners;

  const filters: Filters = {
    q: one(sp.q)?.slice(0, 120) || undefined,
    type: pick(PARTNER_TYPES, one(sp.type)),
    category: pick(ORGANIZATION_CATEGORIES, one(sp.category)),
    support: pick(SUPPORT_TYPES, one(sp.support)),
    from: validDate(one(sp.from)),
    to: validDate(one(sp.to)),
  };
  const filtered = Object.values(filters).some(Boolean);
  const size = PAGE_SIZES.find((n) => String(n) === one(sp.size)) ?? PAGE_SIZES[0];
  const requested = Math.max(1, Math.trunc(Number(one(sp.page))) || 1);
  let { items, total, all } = await listPartnerApplications(filters, requested, size);
  const last = Math.max(1, Math.ceil(total / size));
  const page = Math.min(requested, last);
  if (page !== requested) ({ items, total, all } = await listPartnerApplications(filters, page, size));

  const href = (n: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) if (typeof value === "string" && key !== "page") qs.set(key, value);
    if (n > 1) qs.set("page", String(n));
    const s = qs.toString();
    return s ? `/admin/partners?${s}` : "/admin/partners";
  };
  const listQuery = href(page).split("?")[1] ?? "";
  const first = (page - 1) * size;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <section className="relative isolate overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-white via-[#faf9ff] to-[#f1effd] shadow-soft ring-1 ring-line-soft" data-testid="partners-banner">
        <div className="absolute inset-y-0 end-0 -z-10 hidden w-[42%] md:block">
          <Image
            src={skylineImage}
            alt={a.bannerAlt}
            fill
            sizes="30vw"
            className="object-cover object-[50%_42%] ltr:[mask-image:linear-gradient(to_right,transparent,#000_45%)] rtl:[mask-image:linear-gradient(to_left,transparent,#000_45%)]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-purple/15 to-transparent" />
        </div>
        <div className="px-6 py-7 sm:px-8 sm:py-8 md:max-w-[62%]">
          <OfficialLogos size="banner" only="tuwaiq" moeAlt={t.brand.moeAlt} tuwaiqAlt={t.brand.tuwaiqAlt} />
          <h1 className="mt-5 flex items-center gap-3 text-[2rem] font-bold text-navy">
            <UsersRound className="size-8 text-purple" aria-hidden />
            {a.title}
          </h1>
          <p className="mt-2 text-lg font-semibold text-ink-soft">{a.subtitle}</p>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">{a.intro}</p>
        </div>
      </section>

      <PartnerFilters />

      <section className="rounded-[1.25rem] bg-white shadow-soft ring-1 ring-line-soft">
        {items.length === 0 ? (
          <div className="p-5" data-testid="partners-empty">
            <EmptyState
              icon={filtered ? UsersRound : Handshake}
              title={filtered ? a.emptyFilteredTitle : a.emptyTitle}
              body={filtered ? a.emptyFilteredBody : a.emptyBody}
              action={
                filtered && all > 0 ? (
                  <Link href="/admin/partners" className={buttonClasses("secondary", "sm")}>
                    {a.clearFilters}
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[62rem] text-[0.8125rem]" data-testid="partners-table">
                <thead className="border-b border-line-soft text-[0.8125rem] text-ink">
                  <tr>
                    <th scope="col" className="w-12 px-4 py-4 text-start font-bold">{a.columns.number}</th>
                    <th scope="col" className="px-2.5 py-4 text-start font-bold">{a.columns.fullName}</th>
                    <th scope="col" className="px-2.5 py-4 text-start font-bold">{a.columns.organization}</th>
                    <th scope="col" className="px-2.5 py-4 text-start font-bold">{a.columns.party}</th>
                    <th scope="col" className="px-2.5 py-4 text-start font-bold">{a.columns.partnership}</th>
                    <th scope="col" className="px-2.5 py-4 text-start font-bold">{a.columns.phone}</th>
                    <th scope="col" className="px-2.5 py-4 text-start font-bold">{a.columns.email}</th>
                    <th scope="col" className="px-2.5 py-4 text-start font-bold">{a.columns.date}</th>
                    <th scope="col" className="px-4 py-4 text-center font-bold">{a.columns.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {items.map((item, i) => (
                    <tr key={item.id} className="hover:bg-canvas/60" data-testid="partner-row" data-id={item.id}>
                      <td className="px-4 py-3.5 tabular-nums text-muted">{formatNumber(first + i + 1, "en").padStart(2, "0")}</td>
                      <td dir="auto" className="max-w-[10rem] truncate px-2.5 py-3.5 font-semibold text-ink" title={item.full_name}>
                        {item.full_name}
                      </td>
                      <td dir="auto" className="max-w-[9rem] truncate px-2.5 py-3.5 text-ink-soft" title={item.organization_name ?? undefined}>
                        {item.organization_name ?? <span className="text-muted">—</span>}
                      </td>
                      <td className="px-2.5 py-3.5">
                        <PartyChip type={item.partner_type} category={item.organization_category} other={item.organization_category_other} t={t} />
                      </td>
                      <td className="px-2.5 py-3.5">
                        <span className="flex items-center gap-1.5" title={item.support_types.map((s) => t.partners.support[s]).join(locale === "ar" ? "، " : ", ")}>
                          <SupportChip type={item.support_types[0]} t={t} className="max-w-[8.5rem]" />
                          {item.support_types.length > 1 ? (
                            <span dir="ltr" className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">
                              +{formatNumber(item.support_types.length - 1, locale)}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3.5 tabular-nums text-ink-soft" dir="ltr" style={{ textAlign: "start" }}>
                        {item.phone}
                      </td>
                      <td className="max-w-[12rem] truncate px-2.5 py-3.5 text-ink-soft" dir="ltr" style={{ textAlign: "start" }} title={item.email}>
                        {item.email}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3.5 tabular-nums text-ink-soft">
                        <time dateTime={item.created_at}>{shortDate(item.created_at)}</time>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/admin/partners/${item.id}${listQuery ? `?back=${encodeURIComponent(listQuery)}` : ""}`}
                            className="inline-flex h-9 items-center rounded-lg bg-lavender-soft px-3.5 text-sm font-semibold text-purple-ink transition hover:bg-lavender"
                            aria-label={`${a.view}: ${item.full_name}`}
                            data-testid="partner-view"
                          >
                            {a.view}
                          </Link>
                          <PartnerRowMenu name={item.full_name} email={item.email} phone={item.phone} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-4 border-t border-line-soft px-5 py-4 sm:flex-row">
              <div className="flex items-center gap-3 text-sm text-muted">
                <span data-testid="partners-range">
                  {fmt(a.range, {
                    from: formatNumber(first + 1, locale),
                    to: formatNumber(first + items.length, locale),
                    total: formatNumber(total, locale),
                  })}
                </span>
                <PageSizeSelect value={size} options={PAGE_SIZES} />
              </div>
              <nav aria-label={a.pagination} className="flex items-center gap-1.5" data-testid="partners-pagination">
                <PageLink href={page > 1 ? href(page - 1) : null} label={a.previousPage}>
                  <ChevronRight className="size-4 ltr:rotate-180" aria-hidden />
                </PageLink>
                {pageList(page, last).map((n, i) =>
                  n === "gap" ? (
                    <span key={`gap-${i}`} className="px-1.5 text-muted" aria-hidden>
                      …
                    </span>
                  ) : (
                    <Link
                      key={n}
                      href={href(n)}
                      scroll={false}
                      aria-current={n === page ? "page" : undefined}
                      aria-label={fmt(a.page, { n: formatNumber(n, locale) })}
                      className={cn(
                        "grid size-10 place-items-center rounded-xl text-sm font-semibold tabular-nums transition",
                        n === page ? "bg-purple text-white shadow-[0_8px_18px_-10px_rgb(109_74_255/0.9)]" : "text-ink-soft hover:bg-canvas",
                      )}
                    >
                      {formatNumber(n, locale)}
                    </Link>
                  ),
                )}
                <PageLink href={page < last ? href(page + 1) : null} label={a.nextPage}>
                  <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
                </PageLink>
              </nav>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function PageLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls = "grid size-10 place-items-center rounded-xl ring-1 ring-inset ring-line text-ink-soft transition";
  return href ? (
    <Link href={href} scroll={false} aria-label={label} className={cn(cls, "hover:bg-canvas hover:text-ink")}>
      {children}
    </Link>
  ) : (
    <span aria-hidden className={cn(cls, "opacity-40")}>
      {children}
    </span>
  );
}
