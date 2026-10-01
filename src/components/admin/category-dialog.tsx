"use client";

import { Archive, ArchiveRestore, Pencil, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { CATEGORY_ACCENTS, CATEGORY_ACCENT_KEYS, CATEGORY_ICONS, CATEGORY_ICON_KEYS } from "@/lib/categories";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveCategory, setCategoryArchived } from "@/server/actions/categories";

export function CategoryDialog({ category }: { category?: Category }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const blank = { nameEn: "", nameAr: "", keywords: "", icon: "sparkles", accent: "teal", kind: "project" as "project" | "activity" };
  const fromCategory = category
    ? { nameEn: category.name_en, nameAr: category.name_ar, keywords: category.keywords, icon: category.icon, accent: category.accent, kind: category.kind }
    : blank;
  const [form, setForm] = useState(fromCategory);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.nameEn.trim() || !form.nameAr.trim()) {
      setError(t.admin.categories.nameRequired);
      return;
    }
    setBusy(true);
    const res = await saveCategory({ id: category?.id, ...form });
    setBusy(false);
    if (!res.ok) {
      toast.error(t.common.somethingWrong);
      return;
    }
    toast.success(category ? t.admin.categories.updated : t.admin.categories.created);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {category ? (
        <button
          type="button"
          onClick={() => {
            setForm(fromCategory);
            setError(null);
            setOpen(true);
          }}
          aria-label={`${t.common.edit}: ${category.name_en}`}
          title={t.common.edit}
          className="grid size-9 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-ink"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      ) : (
        <Button
          onClick={() => {
            setForm(blank);
            setError(null);
            setOpen(true);
          }}
        >
          <PlusCircle className="size-4" aria-hidden />
          {t.admin.categories.add}
        </Button>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={category ? t.admin.categories.editTitle : t.admin.categories.newTitle}
        closeLabel={t.common.close}
        className="max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? t.common.saving : category ? t.admin.common.saveChanges : t.admin.common.create}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.admin.categories.nameEn} htmlFor="cat-en" required error={error && !form.nameEn.trim() ? error : undefined}>
              <Input id="cat-en" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" maxLength={80} />
            </Field>
            <Field label={t.admin.categories.nameAr} htmlFor="cat-ar" required error={error && !form.nameAr.trim() ? error : undefined}>
              <Input id="cat-ar" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" lang="ar" maxLength={80} />
            </Field>
          </div>
          <Field label={t.admin.categories.keywords} htmlFor="cat-keywords" hint={t.admin.categories.keywordsHint}>
            <Input id="cat-keywords" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} dir="auto" maxLength={400} />
          </Field>
          <Field label={t.admin.categories.kind} htmlFor="cat-kind" hint={t.admin.categories.kindHint}>
            <Select id="cat-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "project" | "activity" })}>
              <option value="project">{t.admin.categories.kinds.project}</option>
              <option value="activity">{t.admin.categories.kinds.activity}</option>
            </Select>
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t.admin.categories.icon}</legend>
            <div role="radiogroup" aria-label={t.admin.categories.icon} className="grid grid-cols-8 gap-1.5">
              {CATEGORY_ICON_KEYS.map((key) => {
                const Icon = CATEGORY_ICONS[key];
                const active = form.icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={key}
                    title={key}
                    onClick={() => setForm({ ...form, icon: key })}
                    className={cn(
                      "grid aspect-square place-items-center rounded-xl ring-1 transition",
                      active ? "bg-lavender-soft text-purple ring-purple/40" : "text-ink-soft ring-line hover:bg-canvas",
                    )}
                  >
                    <Icon className="size-4.5" aria-hidden />
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t.admin.categories.accent}</legend>
            <div role="radiogroup" aria-label={t.admin.categories.accent} className="flex flex-wrap gap-2">
              {CATEGORY_ACCENT_KEYS.map((key) => {
                const active = form.accent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={key}
                    title={key}
                    onClick={() => setForm({ ...form, accent: key })}
                    className={cn(
                      "grid size-10 place-items-center rounded-full ring-2 ring-offset-2 transition",
                      active ? "ring-ink" : "ring-transparent hover:ring-line",
                    )}
                  >
                    <span className="size-7 rounded-full" style={{ background: CATEGORY_ACCENTS[key].swatch }} />
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="rounded-xl bg-canvas p-4 ring-1 ring-inset ring-line-soft">
            <CategoryChip
              name={(locale === "ar" ? form.nameAr : form.nameEn) || "—"}
              icon={form.icon}
              accent={form.accent}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

export function ArchiveCategoryButton({ category }: { category: Category }) {
  const { t } = useI18n();
  const router = useRouter();
  if (category.archived_at) {
    return (
      <button
        type="button"
        onClick={async () => {
          const res = await setCategoryArchived(category.id, false);
          if (res.ok) {
            toast.success(t.admin.categories.restoredToast);
            router.refresh();
          }
        }}
        aria-label={`${t.admin.categories.unarchive}: ${category.name_en}`}
        title={t.admin.categories.unarchive}
        className="grid size-9 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-ink"
      >
        <ArchiveRestore className="size-4" aria-hidden />
      </button>
    );
  }
  return (
    <ConfirmDialog
      tone="primary"
      trigger={
        <button
          type="button"
          aria-label={`${t.admin.categories.archive}: ${category.name_en}`}
          title={t.admin.categories.archive}
          className="grid size-9 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-ink"
        >
          <Archive className="size-4" aria-hidden />
        </button>
      }
      title={t.admin.categories.confirmArchiveTitle}
      body={fmt(t.admin.categories.confirmArchiveBody, { name: category.name_en })}
      confirmLabel={t.admin.categories.archive}
      cancelLabel={t.common.cancel}
      onConfirm={async () => {
        const res = await setCategoryArchived(category.id, true);
        if (res.ok) {
          toast.success(t.admin.categories.archivedToast);
          router.refresh();
        } else toast.error(t.common.somethingWrong);
      }}
    />
  );
}
