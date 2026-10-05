"use client";

import { Pencil, PlusCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { fmt, gradeLabel } from "@/i18n/format";
import { STUDENT_SECTIONS } from "@/lib/students";
import { deleteStudent, saveStudent } from "@/server/actions/students";

type Student = { id: string; name_en: string | null; name_ar: string | null; grade: number | null; section?: number | null };

export function StudentDialog({ student, trigger }: { student?: Student; trigger: "add" | "edit" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState(student?.name_en ?? "");
  const [nameAr, setNameAr] = useState(student?.name_ar ?? "");
  const [grade, setGrade] = useState<number | null>(student?.grade ?? null);
  const [section, setSection] = useState<number | null>(student?.section ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setNameEn(student?.name_en ?? "");
    setNameAr(student?.name_ar ?? "");
    setGrade(student?.grade ?? null);
    setSection(student?.section ?? null);
    setError(null);
  };

  async function submit() {
    if (!nameEn.trim() && !nameAr.trim()) {
      setError(t.admin.students.nameRequired);
      return;
    }
    setBusy(true);
    const res = await saveStudent({ id: student?.id, nameEn, nameAr, grade, section });
    setBusy(false);
    if (!res.ok) {
      toast.error(t.common.somethingWrong);
      return;
    }
    toast.success(student ? t.admin.students.updated : t.admin.students.created);
    setOpen(false);
  }

  return (
    <>
      {trigger === "add" ? (
        <Button
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          <PlusCircle className="size-4" aria-hidden />
          {t.admin.students.add}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          aria-label={`${t.common.edit}: ${student?.name_en ?? student?.name_ar ?? ""}`}
          title={t.common.edit}
          className="grid size-9 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-ink"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={student ? t.admin.students.editTitle : t.admin.students.newTitle}
        description={t.admin.students.nameHint}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? t.common.saving : student ? t.admin.common.saveChanges : t.admin.common.create}
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label={t.admin.students.nameEn} htmlFor="student-name-en" error={error ?? undefined}>
            <Input id="student-name-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" maxLength={120} aria-invalid={error ? true : undefined} />
          </Field>
          <Field label={t.admin.students.nameAr} htmlFor="student-name-ar">
            <Input id="student-name-ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" lang="ar" maxLength={120} />
          </Field>
          <Field label={t.admin.students.grade} htmlFor="student-grade-input">
            <Select id="student-grade-input" value={grade ?? ""} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{t.admin.students.noGrade}</option>
              {[10, 11, 12].map((g) => (
                <option key={g} value={g}>
                  {gradeLabel(g, t.grades)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.admin.students.section} htmlFor="student-section-input">
            <Select id="student-section-input" value={section ?? ""} onChange={(e) => setSection(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{t.admin.students.noSection}</option>
              {STUDENT_SECTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <button type="submit" hidden />
        </form>
      </Modal>
    </>
  );
}

export function DeleteStudentButton({ id, name, linked }: { id: string; name: string; linked: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  if (linked) {
    return (
      <span
        title={t.admin.students.deleteBlocked}
        className="grid size-9 cursor-not-allowed place-items-center rounded-lg text-line"
        aria-label={t.admin.students.deleteBlocked}
      >
        <Trash2 className="size-4" aria-hidden />
      </span>
    );
  }
  return (
    <ConfirmDialog
      trigger={
        <button
          type="button"
          aria-label={`${t.admin.students.delete}: ${name}`}
          title={t.admin.students.delete}
          className="grid size-9 place-items-center rounded-lg text-ink-soft transition hover:bg-danger-soft hover:text-danger-ink"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      }
      title={t.admin.students.confirmDeleteTitle}
      body={fmt(t.admin.students.confirmDeleteBody, { name })}
      confirmLabel={t.common.delete}
      cancelLabel={t.common.cancel}
      onConfirm={async () => {
        const res = await deleteStudent(id);
        if (res.ok) {
          toast.success(t.admin.students.deleted);
          router.refresh();
        } else toast.error(res.error === "linked" ? t.admin.students.deleteBlocked : t.common.somethingWrong);
      }}
    />
  );
}
