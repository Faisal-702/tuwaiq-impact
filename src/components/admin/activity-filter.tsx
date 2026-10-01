"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";

export function ActivityFilter({ current }: { current: string }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <div className="w-64">
      <label htmlFor="activity-filter" className="sr-only">
        {t.admin.activity.action}
      </label>
      <Select
        id="activity-filter"
        value={current}
        onChange={(e) => router.replace(e.target.value ? `/admin/activity?action=${e.target.value}` : "/admin/activity")}
      >
        <option value="">{t.admin.activity.all}</option>
        {Object.entries(t.admin.activity.actions).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}
