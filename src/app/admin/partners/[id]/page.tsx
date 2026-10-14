import { ArrowRight, CalendarClock, Handshake, Mail, MapPin, Phone, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InterestChip, PartyChip, SupportChip } from "@/components/admin/partners/partner-chips";
import { CopyButton } from "@/components/admin/partners/partners-admin";
import Link from "@/components/ui/link";
import { fmt, formatDateTime } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getPartnerApplication } from "@/server/queries/partners";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.partners.detailsTitle };
}

/** One partnership application with every answer (admin only). */
export default async function AdminPartnerDetailsPage(props: PageProps<"/admin/partners/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { t, locale } = await getI18n();
  const a = t.admin.partners;
  const f = t.partners.fields;
  const app = await getPartnerApplication(id);
  if (!app) notFound();

  // Back to the list as it was (filters, page), when it came from there.
  const back = typeof sp.back === "string" && /^[\w%.=&+-]*$/.test(sp.back) ? `/admin/partners?${sp.back}` : "/admin/partners";
  const org = app.partner_type === "organization";

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="partner-details">
      <Link href={back} className="inline-flex items-center gap-2 text-sm font-semibold text-purple-ink hover:underline">
        <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
        {a.back}
      </Link>

      <header className="rounded-[1.5rem] bg-gradient-to-br from-white via-[#faf9ff] to-[#f1effd] p-6 shadow-soft ring-1 ring-line-soft sm:p-8">
        <p className="text-sm font-semibold text-teal-deep">{a.detailsTitle}</p>
        <h1 dir="auto" className="mt-2 break-words text-[1.75rem] font-bold text-navy">
          {app.full_name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          <PartyChip type={app.partner_type} category={app.organization_category} other={app.organization_category_other} t={t} />
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-4" aria-hidden />
            {a.submittedAt}: <time dateTime={app.created_at} className="font-medium text-ink-soft">{formatDateTime(app.created_at, locale)}</time>
          </span>
        </div>
      </header>

      <Card title={a.applicant} icon={UserRound}>
        <Row label={f.partnerType}>{t.partners.types[app.partner_type]}</Row>
        <Row label={f.fullName} auto>
          {app.full_name}
        </Row>
        {org ? (
          <>
            <Row label={f.organizationName} auto>
              {app.organization_name}
            </Row>
            <Row label={f.jobTitle} auto>
              {app.job_title}
            </Row>
            <Row label={f.organizationCategory}>{app.organization_category ? t.partners.categories[app.organization_category] : "—"}</Row>
            {app.organization_category_other ? (
              <Row label={f.organizationCategoryOther} auto>
                <span data-testid="detail-category-other">{app.organization_category_other}</span>
              </Row>
            ) : null}
          </>
        ) : null}
      </Card>

      <Card title={a.contact} icon={Phone}>
        <Row label={f.phone}>
          <span className="flex flex-wrap items-center gap-3">
            <a href={`tel:${app.phone}`} dir="ltr" className="font-semibold tabular-nums text-ink hover:text-purple-ink" data-testid="detail-phone">
              {app.phone}
            </a>
            <CopyButton value={app.phone} label={a.copyPhone} />
          </span>
        </Row>
        <Row label={f.email}>
          <span className="flex flex-wrap items-center gap-3">
            <a href={`mailto:${app.email}`} dir="ltr" className="break-all font-semibold text-ink hover:text-purple-ink" data-testid="detail-email">
              {app.email}
            </a>
            <CopyButton value={app.email} label={a.copyEmail} />
            <a href={`mailto:${app.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-purple-ink ring-1 ring-inset ring-line hover:bg-lavender-soft">
              <Mail className="size-4" aria-hidden />
              {a.sendEmail}
            </a>
          </span>
        </Row>
        <Row label={f.city} auto>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-muted" aria-hidden />
            {app.city}
          </span>
        </Row>
      </Card>

      <Card title={a.partnership} icon={Handshake}>
        <Row label={f.supportTypes}>
          <span className="flex flex-wrap gap-2">
            {app.support_types.map((s) => (
              <SupportChip key={s} type={s} t={t} />
            ))}
          </span>
        </Row>
        {app.support_other ? (
          <Row label={f.supportOther} auto>
            <span data-testid="detail-support-other">{app.support_other}</span>
          </Row>
        ) : null}
        <Row label={f.interestFields}>
          <span className="flex flex-wrap gap-2">
            {app.interest_fields.map((s) => (
              <InterestChip key={s} field={s} t={t} />
            ))}
          </span>
        </Row>
        {app.interest_other ? (
          <Row label={f.interestOther} auto>
            <span data-testid="detail-interest-other">{app.interest_other}</span>
          </Row>
        ) : null}
        <div className="px-5 py-4 sm:px-6">
          <p className="text-sm font-medium text-muted">{f.proposal}</p>
          <p dir="auto" className="mt-2 whitespace-pre-line break-words rounded-xl bg-canvas p-4 text-[0.9375rem] leading-[1.9] text-ink-soft ring-1 ring-inset ring-line-soft" data-testid="detail-proposal">
            {app.proposal}
          </p>
        </div>
      </Card>

      <Card title={f.consent} icon={ShieldCheck}>
        <Row label={a.consent}>{fmt(a.consentGiven, { date: formatDateTime(app.consent_at, locale) })}</Row>
        <Row label={a.formLanguage}>{a.languages[app.locale]}</Row>
      </Card>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[1.25rem] bg-white shadow-soft ring-1 ring-line-soft">
      <h2 className="flex items-center gap-2.5 border-b border-line-soft bg-canvas/60 px-5 py-3.5 text-[0.9375rem] font-bold text-ink sm:px-6">
        <Icon className="size-4.5 text-purple" aria-hidden />
        {title}
      </h2>
      <dl className="divide-y divide-line-soft">{children}</dl>
    </section>
  );
}

function Row({ label, auto, children }: { label: string; auto?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-4 sm:px-6">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd dir={auto ? "auto" : undefined} className="min-w-0 break-words text-[0.9375rem] text-ink">
        {children}
      </dd>
    </div>
  );
}
