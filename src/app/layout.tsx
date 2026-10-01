import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { I18nProvider } from "@/i18n/client";
import { getDictionary } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return {
    metadataBase: new URL(`${proto}://${host}`),
    title: { default: t.meta.title, template: `%s · ${t.brand.name}` },
    description: t.meta.description,
    applicationName: "Tuwaiq Impact",
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getI18n();
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="min-h-dvh bg-white antialiased">
        <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
          <AppProviders dir={dir}>{children}</AppProviders>
        </I18nProvider>
      </body>
    </html>
  );
}
