"use client";

import { KeyRound, LogOut, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { isAdminCodeFormat, normalizeAdminCode } from "@/lib/admin-code";
import {
  changeMyVerificationCode,
  purgeDemoData,
  resetAdminVerificationCode,
  saveSettings,
  signOutEverywhere,
} from "@/server/actions/settings";

export function DefaultsForm({ defaultPoints, currentAcademicYear }: { defaultPoints: number; currentAcademicYear: string | null }) {
  const { t } = useI18n();
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
        } else toast.error(t.common.somethingWrong);
      }}
    />
  );
}

const codeInputProps = {
  type: "password",
  inputMode: "numeric",
  maxLength: 12,
  spellCheck: false,
  className: "tracking-[0.18em] placeholder:tracking-normal",
} as const;

/** Lets the signed-in administrator change their own verification code. */
export function ChangeCodeButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = [current, next, confirm].every((v) => isAdminCodeFormat(normalizeAdminCode(v)));
  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };
  return (
    <>
      <Button variant="subtle" onClick={() => setOpen(true)}>
        <KeyRound className="size-4" aria-hidden />
        {t.admin.settings.changeCode}
      </Button>
      <Modal
        open={open}
        onOpenChange={(o) => {
          if (busy) return;
          setOpen(o);
          if (!o) reset();
        }}
        title={t.admin.settings.changeCode}
        description={t.admin.settings.myCodeBody}
        closeLabel={t.common.cancel}
      >
        <form
          id="change-code-form"
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ready || busy) return;
            setBusy(true);
            const res = await changeMyVerificationCode({ current, next, confirm });
            setBusy(false);
            if (res.ok) {
              toast.success(t.admin.settings.codeChanged);
              setOpen(false);
              reset();
            } else setError(t.admin.settings.codeErrors[res.error] ?? t.common.somethingWrong);
          }}
        >
          <Field label={t.admin.settings.currentCode} htmlFor="code-current">
            <Input id="code-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} {...codeInputProps} />
          </Field>
          <Field label={t.admin.settings.newCode} htmlFor="code-new" hint={t.admin.settings.codeHint}>
            <Input id="code-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} {...codeInputProps} />
          </Field>
          <Field label={t.admin.settings.confirmCode} htmlFor="code-confirm">
            <Input id="code-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} {...codeInputProps} />
          </Field>
          <p id="change-code-error" aria-live="polite" className="min-h-5 text-sm text-danger-ink">
            {error}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={!ready || busy}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Removes another administrator's verification code (they create a new one at next sign-in). */
export function ResetCodeButton({ userId, email }: { userId: string; email: string }) {
  const { t } = useI18n();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" aria-label={`${t.admin.settings.resetCode}: ${email}`}>
          <RotateCcw className="size-4" aria-hidden />
          {t.admin.settings.resetCode}
        </Button>
      }
      title={t.admin.settings.confirmResetTitle}
      body={fmt(t.admin.settings.confirmResetBody, { email })}
      confirmLabel={t.admin.settings.resetCode}
      cancelLabel={t.common.cancel}
      onConfirm={async () => {
        const res = await resetAdminVerificationCode(userId);
        if (res.ok) {
          toast.success(t.admin.settings.codeReset);
        } else toast.error(t.common.somethingWrong);
      }}
    />
  );
}
