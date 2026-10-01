import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { getStatusCounts } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { default: t.admin.title, template: `%s · ${t.admin.title}` }, robots: { index: false, follow: false } };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side guard: every admin route verifies the session against the database.
  await requireAdmin();
  const counts = await getStatusCounts();
  return <AdminShell trashCount={counts.trash}>{children}</AdminShell>;
}
