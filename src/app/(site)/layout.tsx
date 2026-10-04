import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getI18n } from "@/i18n/server";
import { requireViewer } from "@/server/auth";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ t }, viewer] = await Promise.all([getI18n(), requireViewer()]);
  const student =
    viewer.kind === "student" ? { name_en: viewer.student.name_en, name_ar: viewer.student.name_ar } : null;
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader isAdmin={viewer.kind === "admin"} student={student} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
