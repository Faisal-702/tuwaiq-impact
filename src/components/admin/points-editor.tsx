"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { updateProjectPoints } from "@/server/actions/projects";

export function PointsEditor({
  rows,
}: {
  rows: { id: string; title: string; points: number; students: string; academic_year: string | null }[];
}) {
  const { t } = useI18n();
  return (
    <ul className="divide-y divide-line-soft">
      {rows.map((r) => (
        <PointsRow key={`${r.id}-${r.points}`} row={r} label={t.admin.projects.columns.points} savedLabel={t.admin.leaderboard.updated} />
      ))}
    </ul>
  );
}

function PointsRow({
  row,
  label,
  savedLabel,
}: {
  row: { id: string; title: string; points: number; students: string; academic_year: string | null };
  label: string;
  savedLabel: string;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(String(row.points));
  const [busy, setBusy] = useState(false);
  const parsed = Number(value);
  const valid = value !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 100000;
  const dirty = valid && parsed !== row.points;

  async function save() {
    if (!dirty) return;
    setBusy(true);
    const res = await updateProjectPoints(row.id, parsed);
    setBusy(false);
    if (res.ok) {
      toast.success(savedLabel);
    } else toast.error(t.common.somethingWrong);
  }

  return (
    <li className="flex items-center gap-4 px-6 py-3">
      <div className="min-w-0 flex-1">
        <p dir="auto" className="truncate text-sm font-medium text-ink">{row.title}</p>
        <p className="truncate text-xs text-muted">
          {row.students}
          {row.academic_year ? ` · ${row.academic_year}` : ""}
        </p>
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <input
          type="number"
          min={0}
          max={100000}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`${label}: ${row.title}`}
          aria-invalid={!valid || undefined}
          className="h-9 w-24 rounded-lg border border-line px-3 text-end text-sm tabular-nums focus:border-purple/50 focus:outline-none focus:ring-2 focus:ring-purple/10 aria-invalid:border-danger-ink/50"
        />
        <button
          type="submit"
          disabled={!dirty || busy}
          aria-label={t.common.save}
          title={t.common.save}
          className="grid size-9 place-items-center rounded-lg bg-purple text-white transition hover:bg-purple-strong disabled:bg-canvas disabled:text-line"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
        </button>
      </form>
    </li>
  );
}
