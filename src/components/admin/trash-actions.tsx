"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { purgeProject, restoreProject } from "@/server/actions/projects";

export function TrashActions({ id, title }: { id: string; title: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="subtle"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await restoreProject(id);
            if (res.ok) {
              toast.success(t.admin.trash.restored);
              router.refresh();
            } else toast.error(t.common.somethingWrong);
          })
        }
      >
        <RotateCcw className="size-4" aria-hidden />
        {t.admin.trash.restore}
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="danger-ghost" size="sm" disabled={pending}>
            <Trash2 className="size-4" aria-hidden />
            {t.admin.trash.purge}
          </Button>
        }
        title={t.admin.trash.confirmPurgeTitle}
        body={fmt(t.admin.trash.confirmPurgeBody, { title })}
        confirmLabel={t.admin.trash.purge}
        cancelLabel={t.common.cancel}
        onConfirm={async () => {
          const res = await purgeProject(id);
          if (res.ok) {
            toast.success(t.admin.trash.purged);
            router.refresh();
          } else toast.error(t.common.somethingWrong);
        }}
      />
    </div>
  );
}
