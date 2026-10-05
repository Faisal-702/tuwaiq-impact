"use client";

import { AlertTriangle, CheckCircle2, Info, LoaderCircle, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { fmt, formatNumber, gradeLabel, plural } from "@/i18n/format";
import { BULK_MAX_STUDENTS, parseNameList, STUDENT_SECTIONS } from "@/lib/students";
import { cn } from "@/lib/utils";
import { bulkCreateStudents, checkBulkStudents } from "@/server/actions/students";

/** Shows at most a few names inline, then "…". */
const preview = (names: string[], max = 4) => names.slice(0, max).join("، ") + (names.length > max ? "…" : "");

/**
 * Students page: add many students at once. One name per line; the chosen
 * grade and section apply to everyone in the list.
 */
export function StudentBulkDialog() {
  const { t, locale } = useI18n();
  const b = t.admin.students.bulk;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [section, setSection] = useState<number | null>(null);
  const [existing, setExisting] = useState<{ key: string; names: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseNameList(text), [text]);
  const classChosen = grade !== null && section !== null;
  const checkKey = classChosen && parsed.names.length > 0 ? `${grade}|${section}|${parsed.names.join("\n")}` : null;

  // Ask the server which names already exist in this grade + section (debounced).
  useEffect(() => {
    if (!checkKey || grade === null || section === null) return;
    const timer = setTimeout(async () => {
      const res = await checkBulkStudents({ text, grade, section });
      if (res.ok && res.data) setExisting({ key: checkKey, names: res.data.existing });
    }, 350);
    return () => clearTimeout(timer);
  }, [checkKey, text, grade, section]);

  const existingNames = existing && existing.key === checkKey ? existing.names : null;
  const checking = checkKey !== null && existingNames === null;
  const toAdd = parsed.names.length - (existingNames?.length ?? 0);
  const tooMany = parsed.names.length > BULK_MAX_STUDENTS;
  const blocked = parsed.tooLong.length > 0 || tooMany;
  const canSubmit = classChosen && !blocked && !checking && toAdd > 0 && !busy;

  const reset = () => {
    setText("");
    setGrade(null);
    setSection(null);
    setExisting(null);
  };

  async function submit() {
    if (!canSubmit || grade === null || section === null) return;
    setBusy(true);
    const res = await bulkCreateStudents({ text, grade, section }).catch(() => null);
    setBusy(false);
    if (!res?.ok || !res.data) {
      toast.error(t.common.somethingWrong);
      return;
    }
    const { created, skipped } = res.data;
    if (created === 0) toast.info(b.nothing);
    else
      toast.success(plural(created, b.done, locale), {
        description: skipped.length > 0 ? fmt(b.skippedDone, { n: formatNumber(skipped.length, locale) }) : undefined,
      });
    setOpen(false);
    reset();
  }

  // Validation summary shown under the form.
  const issues: string[] = [];
  if (parsed.duplicates.length > 0)
    issues.push(fmt(b.duplicates, { n: formatNumber(parsed.duplicates.length, locale), names: preview(parsed.duplicates) }));
  if (existingNames && existingNames.length > 0)
    issues.push(fmt(b.existing, { n: formatNumber(existingNames.length, locale), names: preview(existingNames) }));
  if (parsed.tooLong.length > 0) issues.push(fmt(b.tooLong, { n: formatNumber(parsed.tooLong.length, locale) }));
  if (tooMany) issues.push(fmt(b.tooMany, { max: formatNumber(BULK_MAX_STUDENTS, locale) }));

  const status =
    parsed.names.length === 0 && parsed.tooLong.length === 0
      ? { tone: "neutral" as const, title: b.empty, body: null }
      : blocked
        ? { tone: "danger" as const, title: plural(parsed.names.length, b.detected, locale), body: issues }
        : !classChosen
          ? { tone: "neutral" as const, title: plural(parsed.names.length, b.detected, locale), body: [b.needClass, ...issues] }
          : issues.length > 0
            ? { tone: "warning" as const, title: plural(parsed.names.length, b.detected, locale), body: issues }
            : { tone: "success" as const, title: plural(parsed.names.length, b.detected, locale), body: checking ? [b.checking] : [b.clean] };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="bg-lavender-soft/70 text-purple-ink ring-purple/20"
      >
        <Users className="size-4" aria-hidden />
        {b.open}
      </Button>
      <Modal
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title={b.title}
        closeLabel={t.common.close}
        className="max-w-xl"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <label htmlFor="bulk-student-names" className="block text-sm font-medium text-ink">
              {b.names}
            </label>
            <p id="bulk-student-hint" className="text-[0.8125rem] text-muted">
              {b.hint}
            </p>
            <Textarea
              id="bulk-student-names"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-describedby="bulk-student-hint bulk-student-status"
              rows={9}
              dir="auto"
              spellCheck={false}
              className="min-h-56 resize-y leading-7"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={b.grade} htmlFor="bulk-student-grade">
              <Select id="bulk-student-grade" value={grade ?? ""} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}>
                <option value="" disabled>
                  {b.chooseGrade}
                </option>
                {[10, 11, 12].map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g, t.grades)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={b.section} htmlFor="bulk-student-section">
              <Select id="bulk-student-section" value={section ?? ""} onChange={(e) => setSection(e.target.value ? Number(e.target.value) : null)}>
                <option value="" disabled>
                  {b.chooseSection}
                </option>
                {STUDENT_SECTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <p className="flex items-start gap-2.5 rounded-xl bg-lavender-soft px-4 py-3 text-[0.875rem] text-purple-ink ring-1 ring-inset ring-purple/10">
            <Info className="mt-0.5 size-4 shrink-0 text-purple" aria-hidden />
            {b.applies}
          </p>

          <div
            id="bulk-student-status"
            role="status"
            aria-live="polite"
            data-testid="bulk-status"
            data-tone={status.tone}
            className={cn(
              "flex items-start gap-3 rounded-xl px-4 py-3.5 ring-1 ring-inset",
              status.tone === "success" && "bg-mint-soft ring-teal/20",
              status.tone === "warning" && "bg-[#fdf6e7] ring-[#e9cf8f]/60",
              status.tone === "danger" && "bg-danger-soft ring-danger-ink/15",
              status.tone === "neutral" && "bg-canvas ring-line-soft",
            )}
          >
            {status.tone === "success" ? (
              checking ? (
                <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-teal-deep" aria-hidden />
              ) : (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal-deep" aria-hidden />
              )
            ) : status.tone === "neutral" ? (
              <Info className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
            ) : (
              <AlertTriangle className={cn("mt-0.5 size-5 shrink-0", status.tone === "danger" ? "text-danger-ink" : "text-[#8a6413]")} aria-hidden />
            )}
            <div className="min-w-0 text-sm">
              <p
                className={cn(
                  "font-semibold",
                  status.tone === "success" && "text-teal-deep",
                  status.tone === "warning" && "text-[#8a6413]",
                  status.tone === "danger" && "text-danger-ink",
                  status.tone === "neutral" && "text-ink-soft",
                )}
              >
                {status.title}
              </p>
              {status.body?.map((line) => (
                <p key={line} className="mt-0.5 text-ink-soft">
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" disabled={!canSubmit}>
              {busy ? b.adding : fmt(b.submit, { n: formatNumber(Math.max(toAdd, 0), locale) })}
            </Button>
            <Button variant="subtle" className="bg-white" onClick={() => setOpen(false)} disabled={busy}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
