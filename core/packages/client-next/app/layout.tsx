import type { Metadata } from "next";
import { headers } from "next/headers";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // proxy.ts injects x-lang from ?lang= so SSR can render with the right
  // locale on the first paint — otherwise client switches to zh in useEffect
  // and React reports a hydration mismatch on every translated string.
  const hdr = await headers();
  const initialLang = hdr.get("x-lang") === "zh" ? "zh" : "en";

  return (
    // suppressHydrationWarning: the inline theme bootstrap mutates html[data-theme]
    // before React hydrates; without this the diff between server (no attribute) and
    // client (data-theme=dark) prints a hydration warning.
    <html lang={initialLang} suppressHydrationWarning>
      <head>
        <link id="app-favicon" rel="icon" href="/icons/CubeRoot.png" />
        {/* 关键字体预加载 — 正文 Inter 400 / 500 加快首屏 */}
        <link rel="preload" href="/fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-latin-500-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- inline bootstrap, must run before CSS */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <I18nProvider initialLang={initialLang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
