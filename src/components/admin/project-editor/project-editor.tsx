"use client";

import { Eye, Link2, LoaderCircle, Plus, Send, Star, X } from "lucide-react";
import { Switch } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { gradeLabel } from "@/i18n/format";
import { safeHttpUrl } from "@/lib/utils";
import { saveProject, type ProjectInput } from "@/server/actions/projects";
import { MediaManager, type MediaItem } from "./media-manager";
import { StudentPicker, type StudentOption, type StudentValue } from "./student-picker";

export type EditorCategory = { id: string; name_en: string; name_ar: string; archived: boolean };

export type EditorInitial = {
  id?: string;
  slug?: string;
  status: "draft" | "published";
  featured: boolean;
  title: string;
  description: string;
  categoryId: string;
  grade: number | null;
  className: string;
  academicYear: string;
  supervisor: string;
  award: string;
  points: number;
  students: StudentValue[];
  media: MediaItem[];
  links: { key: string; id?: string; url: string; caption: string }[];
  coverKey: string | null;
};

const GRADES = [10, 11, 12];

export function ProjectEditor({
  initial,
  categories,
  students,
  years,
}: {
  initial: EditorInitial;
  categories: EditorCategory[];
  students: StudentOption[];
  years: string[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [media, setMediaState] = useState<MediaItem[]>(initial.media);
  const [coverKey, setCoverKey] = useState<string | null>(initial.coverKey);
  const [busy, setBusy] = useState<null | "draft" | "publish" | "preview">(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const snapshot = (f: EditorInitial, m: MediaItem[], c: string | null) =>
    JSON.stringify({ f: { ...f, media: undefined }, m: m.map((i) => [i.key, i.caption, i.storagePath ?? i.status]), c });
  const [baseline] = useState(() => snapshot(initial, initial.media, initial.coverKey));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const current = snapshot(form, media, coverKey);
  const dirty = current !== baseline && current !== savedAt;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof EditorInitial>(key: K, value: EditorInitial[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setMedia = (update: (prev: MediaItem[]) => MediaItem[]) => setMediaState(update);

  const uploading = media.some((m) => m.status === "processing" || m.status === "uploading");
  const isPublished = initial.status === "published";

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = t.admin.editor.errors.title;
    if (form.students.length === 0) e.students = t.admin.editor.errors.students;
    if (!form.categoryId) e.category = t.admin.editor.errors.category;
    if (!Number.isInteger(form.points) || form.points < 0 || form.points > 100000) e.points = t.admin.editor.errors.points;
    form.links.forEach((l, i) => {
      if (l.url.trim() && !safeHttpUrl(l.url)) e[`link-${i}`] = t.admin.editor.invalidLink;
    });
    setErrors(e);
    return e;
  };

  const payload = (): ProjectInput => ({
    id: form.id,
    title: form.title,
    description: form.description,
    categoryId: form.categoryId,
    grade: form.grade,
    className: form.className,
    academicYear: form.academicYear,
    supervisor: form.supervisor,
    award: form.award,
    points: form.points,
    featured: form.featured,
    students: form.students,
    media: media
      .filter((m) => m.status === "ready" && m.storagePath)
      .map((m) => ({
        id: m.id,
        key: m.key,
        kind: m.kind,
        caption: m.caption,
        storagePath: m.storagePath!,
        previewPath: m.previewPath ?? null,
        thumbPath: m.thumbPath ?? null,
        fileName: m.fileName,
        mimeType: m.mimeType,
        sizeBytes: m.sizeBytes,
        width: m.width ?? null,
        height: m.height ?? null,
        durationSeconds: m.durationSeconds ?? null,
      })),
    links: form.links.filter((l) => l.url.trim()).map((l) => ({ id: l.id, url: l.url.trim(), caption: l.caption })),
    coverKey,
  });

  async function submit(intent: "draft" | "publish" | "preview") {
    const e = validate();
    if (Object.keys(e).length > 0) {
      toast.error(Object.values(e)[0]);
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    if (uploading) {
      toast.error(t.admin.editor.errors.uploading);
      return;
    }
    // Open the preview tab synchronously so pop-up blockers allow it.
    const previewWindow = intent === "preview" ? window.open("about:blank", "_blank") : null;
    setBusy(intent);
    try {
      const statusIntent = intent === "preview" ? (isPublished ? "publish" : "draft") : intent;
      const res = await saveProject(payload(), statusIntent);
      if (!res.ok || !res.data) {
        previewWindow?.close();
        toast.error(t.common.somethingWrong);
        return;
      }
      setSavedAt(current);
      const { id } = res.data;
      if (intent === "preview") {
        if (previewWindow) previewWindow.location.href = `/admin/projects/${id}/preview`;
      } else {
        toast.success(
          intent === "draft"
            ? isPublished
              ? t.admin.projects.toast.unpublished
              : t.admin.editor.toast.draftSaved
            : isPublished
              ? t.admin.editor.toast.updated
              : t.admin.editor.toast.published,
        );
      }
      // saveProject revalidates the pages, so an existing project's editor
      // updates without an extra refresh; a new one moves to its edit URL.
      if (!form.id) router.replace(`/admin/projects/${id}/edit`);
    } catch {
      previewWindow?.close();
      toast.error(t.common.somethingWrong);
    } finally {
      setBusy(null);
    }
  }

  const activeCategories = useMemo(
    () => categories.filter((c) => !c.archived || c.id === initial.categoryId),
    [categories, initial.categoryId],
  );

  return (
    <form
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"
      onSubmit={(e) => {
        e.preventDefault();
        void submit("publish");
      }}
      noValidate
    >
      <div className="min-w-0 space-y-6">
        <Panel title={t.admin.editor.basics}>
          <div className="space-y-5">
            <Field label={t.admin.editor.titleLabel} htmlFor="project-title" required error={errors.title}>
              <Input
                id="project-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={t.admin.editor.titlePlaceholder}
                maxLength={200}
                dir="auto"
                aria-invalid={errors.title ? true : undefined}
              />
            </Field>
            <Field label={t.admin.editor.categoryLabel} htmlFor="project-category" required error={errors.category}>
              <Select
                id="project-category"
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                aria-invalid={errors.category ? true : undefined}
              >
                <option value="">{t.admin.editor.categoryPlaceholder}</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {locale === "ar" ? c.name_ar : c.name_en}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.admin.editor.descriptionLabel} htmlFor="project-description" optionalLabel={t.common.optional}>
              <Textarea
                id="project-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder={t.admin.editor.descriptionPlaceholder}
                rows={7}
                maxLength={20000}
                dir="auto"
              />
            </Field>
            <Field
              label={t.admin.editor.awardLabel}
              htmlFor="project-award"
              optionalLabel={t.common.optional}
              hint={t.admin.editor.awardHint}
            >
              <Input
                id="project-award"
                value={form.award}
                onChange={(e) => set("award", e.target.value)}
                placeholder={t.admin.editor.awardPlaceholder}
                maxLength={200}
                dir="auto"
              />
            </Field>
          </div>
        </Panel>

        <Panel title={t.admin.editor.people}>
          <div className="space-y-5">
            <Field
              label={t.admin.editor.studentsLabel}
              htmlFor="project-students"
              required
              error={errors.students}
              hint={t.admin.editor.studentsHint}
            >
              <StudentPicker
                options={students}
                value={form.students}
                onChange={(v) => set("students", v)}
                invalid={!!errors.students}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t.admin.editor.gradeLabel} htmlFor="project-grade" optionalLabel={t.common.optional}>
                <Select
                  id="project-grade"
                  value={form.grade ?? ""}
                  onChange={(e) => set("grade", e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{t.admin.editor.gradePlaceholder}</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {gradeLabel(g, t.grades)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.admin.editor.classLabel} htmlFor="project-class" optionalLabel={t.common.optional}>
                <Input
                  id="project-class"
                  value={form.className}
                  onChange={(e) => set("className", e.target.value)}
                  placeholder={t.admin.editor.classPlaceholder}
                  maxLength={40}
                  dir="auto"
                />
              </Field>
              <Field label={t.admin.editor.yearLabel} htmlFor="project-year" optionalLabel={t.common.optional}>
                <Input
                  id="project-year"
                  value={form.academicYear}
                  onChange={(e) => set("academicYear", e.target.value)}
                  placeholder={t.admin.editor.yearPlaceholder}
                  list="academic-years"
                  maxLength={40}
                  dir="auto"
                />
                <datalist id="academic-years">
                  {years.map((y) => (
                    <option key={y} value={y} />
                  ))}
                </datalist>
              </Field>
              <Field label={t.admin.editor.supervisorLabel} htmlFor="project-supervisor" optionalLabel={t.common.optional}>
                <Input
                  id="project-supervisor"
                  value={form.supervisor}
                  onChange={(e) => set("supervisor", e.target.value)}
                  placeholder={t.admin.editor.supervisorPlaceholder}
                  maxLength={120}
                  dir="auto"
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title={t.admin.editor.content}>
          <MediaManager items={media} setItems={setMedia} coverKey={coverKey} setCoverKey={setCoverKey} />

          <div className="mt-8 border-t border-line-soft pt-6">
            <h3 className="text-sm font-semibold text-ink">{t.admin.editor.linksLabel}</h3>
            <ul className="mt-3 space-y-2.5">
              {form.links.map((link, i) => (
                <li key={link.key} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="relative flex-1">
                    <Link2 className="pointer-events-none absolute start-3.5 top-3.5 size-4 text-muted" aria-hidden />
                    <Input
                      value={link.url}
                      onChange={(e) =>
                        set(
                          "links",
                          form.links.map((l) => (l.key === link.key ? { ...l, url: e.target.value } : l)),
                        )
                      }
                      placeholder={t.admin.editor.linkPlaceholder}
                      aria-label={t.admin.editor.linksLabel}
                      aria-invalid={errors[`link-${i}`] ? true : undefined}
                      dir="ltr"
                      type="url"
                      inputMode="url"
                      className="ps-10"
                    />
                    {errors[`link-${i}`] ? <p className="mt-1.5 text-sm text-danger-ink">{errors[`link-${i}`]}</p> : null}
                  </div>
                  <Input
                    value={link.caption}
                    onChange={(e) =>
                      set(
                        "links",
                        form.links.map((l) => (l.key === link.key ? { ...l, caption: e.target.value } : l)),
                      )
                    }
                    placeholder={t.admin.media.captionPlaceholder}
                    aria-label={t.admin.media.caption}
                    dir="auto"
                    maxLength={200}
                    className="sm:w-56"
                  />
                  <button
                    type="button"
                    onClick={() => set("links", form.links.filter((l) => l.key !== link.key))}
                    aria-label={t.admin.media.remove}
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-danger-soft hover:text-danger-ink"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              variant="subtle"
              size="sm"
              className="mt-3"
              onClick={() => set("links", [...form.links, { key: crypto.randomUUID(), url: "", caption: "" }])}
            >
              <Plus className="size-4" aria-hidden />
              {t.admin.editor.addLink}
            </Button>
          </div>
        </Panel>
      </div>

      <aside className="space-y-6">
        <div className="xl:sticky xl:top-8">
          <Panel title={t.admin.editor.publishing}>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">{t.admin.editor.statusLabel}</span>
                {isPublished ? (
                  initial.featured ? (
                    <Badge tone="purple">
                      <Star className="size-3 fill-current" aria-hidden />
                      {t.admin.projects.status.featured}
                    </Badge>
                  ) : (
                    <Badge tone="teal">{t.admin.projects.status.published}</Badge>
                  )
                ) : (
                  <Badge>{t.admin.projects.status.draft}</Badge>
                )}
              </div>

              <Field label={t.admin.editor.pointsLabel} htmlFor="project-points" hint={t.admin.editor.pointsHint} error={errors.points}>
                <Input
                  id="project-points"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100000}
                  step={1}
                  value={Number.isNaN(form.points) ? "" : form.points}
                  onChange={(e) => set("points", e.target.value === "" ? NaN : Number(e.target.value))}
                  aria-invalid={errors.points ? true : undefined}
                />
              </Field>

              <div className="flex items-start justify-between gap-4 rounded-xl bg-canvas p-4 ring-1 ring-inset ring-line-soft">
                <div>
                  <label htmlFor="project-featured" className="text-sm font-medium text-ink">
                    {t.admin.editor.featureLabel}
                  </label>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{t.admin.editor.featureHint}</p>
                </div>
                <Switch.Root
                  id="project-featured"
                  checked={form.featured}
                  onCheckedChange={(v) => set("featured", v)}
                  className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-[#d5d9e0] transition-colors data-[state=checked]:bg-purple"
                >
                  <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.375rem] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[1.375rem]" />
                </Switch.Root>
              </div>

              <div className="space-y-2.5 border-t border-line-soft pt-5">
                <Button type="submit" className="w-full" disabled={busy !== null}>
                  {busy === "publish" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4 rtl:-scale-x-100" aria-hidden />}
                  {isPublished ? t.admin.editor.update : t.admin.editor.publish}
                </Button>
                <Button variant="secondary" className="w-full" disabled={busy !== null} onClick={() => void submit("draft")}>
                  {busy === "draft" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
                  {isPublished ? t.admin.editor.unpublish : t.admin.editor.saveDraft}
                </Button>
                <Button variant="ghost" className="w-full" disabled={busy !== null} onClick={() => void submit("preview")}>
                  {busy === "preview" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  {t.admin.editor.preview}
                </Button>
              </div>
              {uploading ? (
                <p className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                  {t.admin.media.uploading}
                </p>
              ) : dirty ? (
                <p className="text-xs text-muted">{t.admin.editor.unsaved}</p>
              ) : null}
            </div>
          </Panel>
        </div>
      </aside>
    </form>
  );
}
