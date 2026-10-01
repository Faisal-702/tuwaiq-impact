"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { purgeDemoData, saveSettings, signOutEverywhere } from "@/server/actions/settings";

export function DefaultsForm({ defaultPoints, currentAcademicYear }: { defaultPoints: number; currentAcademicYear: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [points, setPoints] = useState(String(defaultPoints));
  const [year, setYear] = useState(currentAcademicYear ?? "");
  const [busy, setBusy] = useState(false);
  const valid = /^\d+$/.test(points) && Number(points) <= 100000;
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setBusy(true);
        const res = await saveSettings({ defaultPoints: Number(points), currentAcademicYear: year });
        setBusy(false);
        if (res.ok) {
          toast.success(t.admin.settings.saved);
          router.refresh();
        } else toast.error(t.common.somethingWrong);
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.admin.settings.defaultPoints} htmlFor="set-points" error={!valid ? t.admin.editor.errors.points : undefined}>
          <Input id="set-points" type="number" min={0} max={100000} value={points} onChange={(e) => setPoints(e.target.value)} aria-invalid={!valid || undefined} />
        </Field>
        <Field label={t.admin.settings.currentYear} htmlFor="set-year" hint={t.admin.settings.currentYearHint}>
          <Input id="set-year" value={year} onChange={(e) => setYear(e.target.value)} maxLength={40} dir="auto" placeholder={t.admin.editor.yearPlaceholder} />
        </Field>
      </div>
      <Button type="submit" disabled={busy || !valid}>
        {busy ? t.common.saving : t.common.save}
      </Button>
    </form>
  );
}

export function SignOutEverywhereButton() {
  const { t } = useI18n();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="subtle">
          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
          {t.admin.settings.signOutAll}
        </Button>
      }
      title={t.admin.settings.confirmSignOutTitle}
      body={t.admin.settings.confirmSignOutBody}
      confirmLabel={t.admin.settings.signOutAll}
      cancelLabel={t.common.cancel}
      onConfirm={async () => {
        await signOutEverywhere();
      }}
    />
  );
}

export function PurgeDemoButton({ disabled }: { disabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="danger-ghost" disabled={disabled} className="ring-1 ring-inset ring-danger-ink/20">
          <Trash2 className="size-4" aria-hidden />
          {t.admin.settings.demoPurge}
        </Button>
      }
      title={t.admin.settings.confirmDemoTitle}
      body={t.admin.settings.confirmDemoBody}
      confirmLabel={t.admin.settings.demoPurge}
      cancelLabel={t.common.cancel}
      onConfirm={async () => {
        const res = await purgeDemoData();
        if (res.ok) {
          toast.success(t.admin.settings.demoPurged);
          router.refresh();
        } else toast.error(t.common.somethingWrong);
      }}
    />
  );
}
