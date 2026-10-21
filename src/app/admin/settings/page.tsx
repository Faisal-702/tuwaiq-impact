import { KeyRound, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import {
  ChangeCodeButton,
  DefaultsForm,
  PurgeDemoButton,
  ResetCodeButton,
  SignOutEverywhereButton,
} from "@/components/admin/settings-forms";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate } from "@/i18n/format";
import { listVerificationCodes } from "@/server/admin-verification";
import { requireAdmin } from "@/server/auth";
import { getDemoCounts, getSettings } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.settings.title };
}

export default async function AdminSettingsPage() {
  const { t, locale } = await getI18n();
  const session = await requireAdmin();
  const [settings, demo, codes] = await Promise.all([getSettings(), getDemoCounts(), listVerificationCodes()]);
  const hasOwnCode = codes.some((c) => c.userId === session.authUserId);
  const hasDemo = demo.projects + demo.students > 0;
  return (
    <>
      <AdminPageHeader title={t.admin.settings.title} description={t.admin.settings.intro} />
      <div className="max-w-3xl space-y-6">
        <Panel title={t.admin.settings.defaults}>
          <DefaultsForm defaultPoints={settings.defaultPoints} currentAcademicYear={settings.currentAcademicYear} />
        </Panel>
        <Panel title={t.admin.settings.security}>
          <div className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lavender-soft text-purple">
              <KeyRound className="size-4.5" aria-hidden />
            </span>
            <div>
              <p className="font-medium text-ink">{t.admin.settings.accessCode}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t.admin.settings.accessCodeBody}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 border-t border-line-soft pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">{t.admin.settings.signOutAllBody}</p>
            <SignOutEverywhereButton />
          </div>
        </Panel>
        <Panel title={t.admin.settings.codes} description={t.admin.settings.codesBody}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lavender-soft text-purple">
                <ShieldCheck className="size-4.5" aria-hidden />
              </span>
              <div>
                <p className="font-medium text-ink">{t.admin.settings.myCode}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {hasOwnCode ? t.admin.settings.myCodeBody : t.admin.settings.myCodeUnsupported}
                </p>
              </div>
            </div>
            {hasOwnCode ? <ChangeCodeButton /> : null}
          </div>
          <div className="mt-6 border-t border-line-soft pt-5">
            <p className="text-sm font-medium text-ink">{t.admin.settings.adminsWithCodes}</p>
            {codes.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t.admin.settings.noCodes}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line-soft rounded-xl ring-1 ring-line-soft" data-testid="admin-code-list">
                {codes.map((c) => (
                  <li
                    key={c.userId}
                    data-testid="admin-code-row"
                    data-email={c.email}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <bdi dir="ltr" className="block truncate text-[0.9375rem] text-ink">
                        {c.email}
                      </bdi>
                      <p className="mt-0.5 text-xs text-muted">
                        {fmt(t.admin.settings.codeUpdated, { date: formatDate(c.updatedAt, locale) })}
                      </p>
                    </div>
                    {c.userId === session.authUserId ? (
                      <span className="rounded-full bg-lavender-soft px-2.5 py-1 text-xs font-medium text-purple-ink">
                        {t.admin.settings.you}
                      </span>
                    ) : (
                      <ResetCodeButton userId={c.userId} email={c.email} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
        <Panel title={t.admin.settings.demo} description={t.admin.settings.demoBody}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-soft">
              {hasDemo ? fmt(t.admin.settings.demoCount, { students: demo.students, projects: demo.projects }) : t.admin.settings.demoNone}
            </p>
            <PurgeDemoButton disabled={!hasDemo} />
          </div>
        </Panel>
      </div>
    </>
  );
}
