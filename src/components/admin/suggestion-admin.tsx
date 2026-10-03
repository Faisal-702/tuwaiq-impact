"use client";

import { Eye, MoreVertical } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/chip";
import { Modal } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { formatDateTime, gradeLabel } from "@/i18n/format";
import { SUGGESTION_GRADES } from "@/lib/suggestions";

export function SuggestionGradeFilter({ current }: { current: string }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <div className="w-full sm:w-56">
      <label htmlFor="suggestion-grade-filter" className="sr-only">
        {t.admin.suggestions.filterLabel}
      </label>
      <Select
        id="suggestion-grade-filter"
        value={current}
        className="h-10 text-sm"
        onChange={(e) => router.replace(e.target.value ? `/admin/suggestions?grade=${e.target.value}` : "/admin/suggestions")}
      >
        <option value="">{t.admin.suggestions.allGrades}</option>
        {SUGGESTION_GRADES.map((g) => (
          <option key={g} value={g}>
            {gradeLabel(g, t.grades)}
          </option>
        ))}
      </Select>
    </div>
  );
}

const GRADE_TONES: Record<number, { tone: "teal" | "purple"; className?: string }> = {
  10: { tone: "teal", className: "bg-[#eef6fd] text-[#1d5f9e] ring-[#9cc7ee]/50" },
  11: { tone: "teal" },
  12: { tone: "purple" },
};

export function SuggestionGradeBadge({ grade }: { grade: number }) {
  const { t } = useI18n();
  const style = GRADE_TONES[grade] ?? { tone: "teal" as const };
  return (
    <Badge tone={style.tone} className={`whitespace-nowrap px-3 py-1 ${style.className ?? ""}`}>
      {gradeLabel(grade, t.grades)}
    </Badge>
  );
}

export function SuggestionRowActions({
  item,
}: {
  item: { name: string; grade: number; suggestion: string; created_at: string };
}) {
  const { t, dir, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const s = t.admin.suggestions;
  return (
    <>
      <DropdownMenu.Root dir={dir}>
        <DropdownMenu.Trigger
          className="grid size-9 place-items-center rounded-lg text-ink-soft ring-1 ring-inset ring-line-soft transition hover:bg-canvas hover:text-ink data-[state=open]:bg-canvas"
          aria-label={`${s.actions}: ${item.name}`}
        >
          <MoreVertical className="size-4" aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 min-w-48 rounded-xl bg-white p-1.5 shadow-lift ring-1 ring-line data-[state=open]:animate-[fade-in_140ms_ease-out]"
          >
            <DropdownMenu.Item
              onSelect={() => setOpen(true)}
              className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-canvas"
            >
              <Eye className="size-4 text-muted" aria-hidden />
              {s.view}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <Modal open={open} onOpenChange={setOpen} title={s.view} closeLabel={t.common.close}>
        <dl className="space-y-4 text-[0.9375rem]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <dt className="sr-only">{s.name}</dt>
              <dd dir="auto" className="font-semibold text-ink">
                {item.name}
              </dd>
            </div>
            <div>
              <dt className="sr-only">{s.grade}</dt>
              <dd>
                <SuggestionGradeBadge grade={item.grade} />
              </dd>
            </div>
          </div>
          <div>
            <dt className="text-sm text-muted">{s.suggestion}</dt>
            <dd dir="auto" className="mt-1.5 whitespace-pre-line break-words rounded-xl bg-canvas p-4 leading-relaxed text-ink-soft ring-1 ring-inset ring-line-soft">
              {item.suggestion}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">{s.date}</dt>
            <dd className="mt-1 text-ink-soft">{formatDateTime(item.created_at, locale)}</dd>
          </div>
        </dl>
      </Modal>
    </>
  );
}
