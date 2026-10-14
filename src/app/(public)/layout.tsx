import { LandingFooter } from "@/components/landing/landing-sections";
import { getI18n } from "@/i18n/server";

/** Public pages (no sign-in): the landing page and the partnership form. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <main id="main" className="flex-1">
        {children}
      </main>
      <LandingFooter t={t} />
    </div>
  );
}
