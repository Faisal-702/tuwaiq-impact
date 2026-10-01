import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import { DefaultsForm, PurgeDemoButton, SignOutEverywhereButton } from "@/components/admin/settings-forms";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { getDemoCounts, getSettings } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.settings.title };
}

export default async function AdminSettingsPage() {
  const { t } = await getI18n();
  const [settings, demo] = await Promise.all([getSettings(), getDemoCounts()]);
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
