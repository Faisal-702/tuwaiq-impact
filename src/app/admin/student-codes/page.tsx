import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { StudentCodesManager } from "@/components/admin/student-codes/student-codes-manager";
import { getI18n } from "@/i18n/server";
import { listStudentCodes } from "@/server/queries/student-codes";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.studentCodes.title };
}

export default async function AdminStudentCodesPage() {
  const { t } = await getI18n();
  // Admin-only: listStudentCodes() verifies the admin session itself.
  const rows = await listStudentCodes();
  const s = t.admin.studentCodes;
  return (
    <>
      <div className="mb-8 print:hidden">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-lavender text-purple">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-ink rtl:tracking-normal">{s.title}</h1>
        </div>
        <p className="mt-2 text-[0.9375rem] text-muted">{s.intro}</p>
      </div>
      <StudentCodesManager rows={rows} today={new Date().toISOString()} />
    </>
  );
}
