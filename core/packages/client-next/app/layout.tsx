import type { Metadata } from "next";
import I18nProvider from "@/i18n/I18nProvider";
import { THEME_BOOTSTRAP } from "@/lib/theme-bootstrap";
import "./fonts.css";
import "./globals.css";

// Title is owned by pages via the useDocumentTitle hook (bilingual zh/en).
// Setting `title` in layout metadata re-emits <title> into <head> on every
// route re-render (e.g. post-hydration i18n changeLanguage), clobbering
// whatever the hook set. Keep description here; let pages set title.
export const metadata: Metadata = {
  description: "Cubing toolkit — solver, recon, training, WCA statistics.",
};

// SSR boots at lang="en"; client switches to ?lang=/cookie/navigator in
// I18nProvider's useEffect → first paint flashes en→zh for zh users.
// suppressHydrationWarning on <body> silences the resulting React diff
// warning (every i18n'd string differs server vs client first render).
// Long-term fix: migrate to /[lang]/ path prefix so server knows the locale
// before render (Vercel / next-intl pattern).
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link id="app-favicon" rel="icon" href="/icons/CubeRoot.png" />
        {/* 关键字体预加载 — 正文 Inter 400 / 500 加快首屏 */}
        <link rel="preload" href="/fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-latin-500-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- inline bootstrap, must run before CSS */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body suppressHydrationWarning>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
