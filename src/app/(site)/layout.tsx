import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getI18n } from "@/i18n/server";
import { isAdmin } from "@/server/auth";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ t }, admin] = await Promise.all([getI18n(), isAdmin()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader isAdmin={admin} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
