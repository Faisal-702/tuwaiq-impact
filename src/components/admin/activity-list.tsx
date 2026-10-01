import { FolderKanban, History, Settings, ShieldCheck, Tags, Trash2, UserRound } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatDateTime } from "@/i18n/format";
import type { AdminActivity } from "@/server/queries/admin";

const ICONS = {
  project: FolderKanban,
  student: UserRound,
  category: Tags,
  settings: Settings,
  session: ShieldCheck,
  demo: Trash2,
} as const;

export function activityLabel(action: string, t: Dictionary) {
  return t.admin.activity.actions[action] ?? action;
}

export function ActivityList({ items, t, locale }: { items: AdminActivity[]; t: Dictionary; locale: Locale }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center text-sm text-muted">
        <History className="mb-3 size-6 text-line" aria-hidden />
        {t.admin.activity.empty}
      </div>
    );
  }
  return (
    <ol className="divide-y divide-line-soft">
      {items.map((item) => {
        const Icon = ICONS[item.target_type as keyof typeof ICONS] ?? History;
        const details = item.details as { from?: number; to?: number };
        return (
          <li key={item.id} className="flex items-start gap-3.5 px-6 py-3.5">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-canvas text-ink-soft ring-1 ring-inset ring-line-soft">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <span className="font-medium">{activityLabel(item.action, t)}</span>
                {item.action === "project.points_changed" && details.from !== undefined ? (
                  <span className="ms-1.5 tabular-nums text-muted" dir="ltr">
                    {details.from} → {details.to}
                  </span>
                ) : null}
              </p>
              {item.target_label ? (
                <p dir="auto" className="truncate text-sm text-muted">
                  {item.target_label}
                </p>
              ) : null}
            </div>
            <time dateTime={new Date(item.created_at).toISOString()} className="shrink-0 text-xs text-muted">
              {formatDateTime(item.created_at, locale)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
