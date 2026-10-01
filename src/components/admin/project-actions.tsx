"use client";

import { Eye, MoreHorizontal, Pencil, Send, Star, StarOff, Trash2, Undo2, ExternalLink } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { setProjectState, trashProject } from "@/server/actions/projects";

const itemClass =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-canvas";

export function ProjectRowActions({
  id,
  slug,
  title,
  status,
  featured,
}: {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  featured: boolean;
}) {
  const { t, dir } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = (change: "publish" | "unpublish" | "feature" | "unfeature") =>
    startTransition(async () => {
      const res = await setProjectState(id, change);
      if (res.ok) {
        toast.success(
          {
            publish: t.admin.projects.toast.published,
            unpublish: t.admin.projects.toast.unpublished,
            feature: t.admin.projects.toast.featured,
            unfeature: t.admin.projects.toast.unfeatured,
          }[change],
        );
        router.refresh();
      } else toast.error(t.common.somethingWrong);
    });

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/admin/projects/${id}/edit`}
        className="grid size-9 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-ink"
        aria-label={`${t.admin.projects.actions.edit}: ${title}`}
        title={t.admin.projects.actions.edit}
      >
        <Pencil className="size-4" aria-hidden />
      </Link>
      <DropdownMenu.Root dir={dir}>
        <DropdownMenu.Trigger
          disabled={pending}
          className="grid size-9 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-ink disabled:opacity-50 data-[state=open]:bg-canvas"
          aria-label={`${t.admin.projects.actions.more}: ${title}`}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 min-w-52 rounded-xl bg-white p-1.5 shadow-lift ring-1 ring-line data-[state=open]:animate-[fade-in_140ms_ease-out]"
          >
            <DropdownMenu.Item asChild className={itemClass}>
              <Link href={`/admin/projects/${id}/preview`}>
                <Eye className="size-4 text-muted" aria-hidden />
                {t.admin.projects.actions.preview}
              </Link>
            </DropdownMenu.Item>
            {status === "published" ? (
              <DropdownMenu.Item asChild className={itemClass}>
                <Link href={`/projects/${slug}`} target="_blank">
                  <ExternalLink className="size-4 text-muted" aria-hidden />
                  {t.admin.projects.actions.view}
                </Link>
              </DropdownMenu.Item>
            ) : null}
            <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
            {status === "draft" ? (
              <DropdownMenu.Item className={itemClass} onSelect={() => run("publish")}>
                <Send className="size-4 text-teal-deep rtl:-scale-x-100" aria-hidden />
                {t.admin.projects.actions.publish}
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item className={itemClass} onSelect={() => run("unpublish")}>
                <Undo2 className="size-4 text-muted" aria-hidden />
                {t.admin.projects.actions.unpublish}
              </DropdownMenu.Item>
            )}
            {featured ? (
              <DropdownMenu.Item className={itemClass} onSelect={() => run("unfeature")}>
                <StarOff className="size-4 text-muted" aria-hidden />
                {t.admin.projects.actions.unfeature}
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item className={itemClass} onSelect={() => run("feature")}>
                <Star className="size-4 text-purple" aria-hidden />
                {t.admin.projects.actions.feature}
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
            <DropdownMenu.Item className={`${itemClass} text-danger-ink data-[highlighted]:bg-danger-soft`} onSelect={() => setConfirmOpen(true)}>
              <Trash2 className="size-4" aria-hidden />
              {t.admin.projects.actions.delete}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ControlledConfirm
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t.admin.projects.confirmDeleteTitle}
        body={fmt(t.admin.projects.confirmDeleteBody, { title })}
        confirmLabel={t.admin.projects.actions.delete}
        cancelLabel={t.common.cancel}
        onConfirm={async () => {
          const res = await trashProject(id);
          if (res.ok) {
            toast.success(t.admin.projects.toast.deleted);
            router.refresh();
          } else toast.error(t.common.somethingWrong);
        }}
      />
    </div>
  );
}

/** ConfirmDialog driven from a menu item (the trigger is hidden). */
function ControlledConfirm(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => Promise<void>;
}) {
  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      trigger={<span hidden />}
      title={props.title}
      body={props.body}
      confirmLabel={props.confirmLabel}
      cancelLabel={props.cancelLabel}
      onConfirm={props.onConfirm}
    />
  );
}

