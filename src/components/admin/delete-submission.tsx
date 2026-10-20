"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { AlertDialog as A } from "radix-ui";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { deleteStudentSubmission } from "@/server/actions/submissions";

/**
 * "Delete Project" on Manage Projects: asks for confirmation (naming the
 * project and the student), then permanently deletes that one submission
 * and its published project on the server. Nothing happens on Cancel; the
 * buttons are disabled while the deletion runs.
 */
export function DeleteSubmissionButton({ submissionId, title, student }: { submissionId: string; title: string; student: string }) {
  const { t } = useI18n();
  const p = t.admin.projects;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Guards against a second click before the first one has re-rendered the button as disabled.
  const inFlight = useRef(false);

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await deleteStudentSubmission(submissionId);
      if (res.ok) {
        setOpen(false);
        toast.success(fmt(p.deleted, { title: title || student }));
        router.refresh();
      } else {
        toast.error(p.deleteFailed);
      }
    } catch {
      toast.error(p.deleteFailed);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <A.Root open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <A.Trigger asChild>
        <button
          type="button"
          className={buttonClasses("danger", "sm")}
          aria-label={fmt(p.deleteOf, { title: title || student })}
          data-testid="submission-delete"
        >
          <Trash2 className="size-4" aria-hidden />
          {p.deleteProject}
        </button>
      </A.Trigger>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 bg-[#0f1729]/35 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_180ms_ease-out]" />
        <A.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 text-start shadow-panel ring-1 ring-line focus:outline-none data-[state=open]:animate-[dialog-in_220ms_cubic-bezier(0.22,1,0.36,1)]"
          data-testid="delete-dialog"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger-ink">
              <Trash2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <A.Title className="text-lg font-semibold text-ink">{p.deleteTitle}</A.Title>
              <A.Description className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted">{p.deleteBody}</A.Description>
            </div>
          </div>
          <dl className="mt-5 space-y-2 rounded-2xl bg-canvas px-4 py-3 text-sm ring-1 ring-line-soft" data-testid="delete-target">
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted">{p.deleteProjectLabel}:</dt>
              <dd dir="auto" className="min-w-0 break-words font-semibold text-ink" data-testid="delete-title">
                {title || "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted">{p.deleteStudentLabel}:</dt>
              <dd dir="auto" className="min-w-0 break-words font-semibold text-ink" data-testid="delete-student">
                {student || "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="subtle" disabled={busy} data-testid="delete-cancel">
                {t.common.cancel}
              </Button>
            </A.Cancel>
            <Button variant="danger" disabled={busy} aria-busy={busy || undefined} onClick={confirm} data-testid="delete-confirm">
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
              {busy ? p.deleting : p.deleteConfirm}
            </Button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
