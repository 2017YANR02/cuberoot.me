import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
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

function pickLang(cookieLang: string | undefined, acceptLang: string): 'zh' | 'en' {
  if (cookieLang === 'zh' || cookieLang === 'en') return cookieLang;
  return acceptLang.toLowerCase().includes('zh') ? 'zh' : 'en';
}

// Phase 3 [lang] migration: server-side lang resolution from cookie (set by
// proxy.ts on ?lang= or /zh/ /en/ paths) + Accept-Language fallback. This sets
// <html lang> on the server, matching what I18nProvider boots client i18n
// with — so /zh/foo URLs no longer have the en→zh first-paint flash. Bare
// paths still flash for first-time visitors (no cookie yet) until they pick a
// lang once, after which the cookie carries it.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const acceptLang = (await headers()).get('accept-language') ?? '';
  const lang = pickLang(cookieStore.get('lang')?.value, acceptLang);

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <link id="app-favicon" rel="icon" href="/icons/CubeRoot.png" />
        {/* 关键字体预加载 — 正文 Inter 400 / 500 加快首屏 */}
        <link rel="preload" href="/fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-latin-500-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- inline bootstrap, must run before CSS */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body suppressHydrationWarning>
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
