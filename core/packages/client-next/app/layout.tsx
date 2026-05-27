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

function pickLang(
  headerLang: string | null,
  cookieLang: string | undefined,
  acceptLang: string,
): 'zh' | 'en' {
  // x-lang is set by proxy.ts on /zh/* /en/* paths — URL locale wins over
  // cookie so /zh/foo always renders zh, even on first visit.
  if (headerLang === 'zh' || headerLang === 'en') return headerLang;
  if (cookieLang === 'zh' || cookieLang === 'en') return cookieLang;
  return acceptLang.toLowerCase().includes('zh') ? 'zh' : 'en';
}

// Phase 3 [lang] migration: server-side lang resolution prefers the x-lang
// request header set by proxy.ts (URL-derived), then cookie, then
// Accept-Language. Owning i18n at root means [lang]/layout doesn't need its
// own I18nProvider — nested providers were deadlocking Turbopack dev.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const h = await headers();
  const lang = pickLang(
    h.get('x-lang'),
    cookieStore.get('lang')?.value,
    h.get('accept-language') ?? '',
  );

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <link id="app-favicon" rel="icon" href="/icons/CubeRoot.png" />
        {/* 关键字体预加载 — 正文 Inter 400 / 500 加快首屏 */}
        <link rel="preload" href="/fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-latin-500-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* 主题 bootstrap 必须在 CSS 解析前同步执行,避免 white→dark FOUC。
            React 19 dev 会对 inline <script> 报 "Encountered a script tag while rendering"
            (CSR 重渲染时脚本不会重跑) — 我们本来就不需要重跑,这是 false positive,
            prod 不显示。试过 next/script + beforeInteractive 一样会触发警告。 */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- inline bootstrap, must run before CSS */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body suppressHydrationWarning>
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
