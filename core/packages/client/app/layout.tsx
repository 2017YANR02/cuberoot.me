import type { Metadata } from "next";
import { THEME_BOOTSTRAP, LANG_BOOTSTRAP } from "@/lib/theme-bootstrap";
import DeskPet from "@/components/DeskPet";
import ThemeColorSync from "@/components/ThemeColorSync";
import AuthTokenRefresher from "@/components/AuthTokenRefresher";
import MembershipReminder from "@/components/MembershipReminder";
import AppNuqsAdapter from "@/components/AppNuqsAdapter";
import "./fonts.css";
import "./globals.css";

// Title is owned by pages via the useDocumentTitle hook (bilingual zh/en).
// Setting `title` in layout metadata re-emits <title> into <head> on every
// route re-render (e.g. post-hydration i18n changeLanguage), clobbering
// whatever the hook set. Keep description here; let pages set title.
export const metadata: Metadata = {
  description: "Cubing toolkit — solver, recon, training, WCA statistics.",
};

// Root layout is static (no dynamic APIs) so the whole tree can be statically
// prerendered. UI language is owned by I18nProvider in [lang]/layout (URL param
// drives it); html[lang] is set pre-paint by LANG_BOOTSTRAP from the URL.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link id="app-favicon" rel="icon" href="/icons/CubeRoot.png" />
        {/* iOS Safari chrome (top/bottom toolbar) tint. Bootstrap sets a pre-paint
            guess; ThemeColorSync refines it to the live page bg. */}
        <meta id="app-theme-color" name="theme-color" content="#fafafa" />
        {/* 关键字体预加载 — 正文 Inter 400 / 500 加快首屏 */}
        <link rel="preload" href="/fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-latin-500-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* 主题 / 语言 bootstrap 必须在 CSS 解析前同步执行(避免 white→dark FOUC + 设对 html[lang])。
            React 19 dev 会对 inline <script> 报 "Encountered a script tag while rendering"
            (CSR 重渲染时脚本不会重跑) — 我们本来就不需要重跑,这是 false positive,prod 不显示。 */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- inline bootstrap, must run before CSS */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- inline bootstrap, must run before paint */}
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOTSTRAP }} />
      </head>
      <body suppressHydrationWarning>
        {/* auth callback: inject bg iframe before React so the prior page shows (no black flash).
            Must be at <body> start — document.body exists here; head is too early. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){if(!location.pathname.startsWith('/auth/'))return;try{var u=sessionStorage.getItem('wca_return_url');if(u){var f=document.createElement('iframe');f.src=u;f.scrolling='no';f.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;border:none;z-index:0;overflow:hidden';f.setAttribute('aria-hidden','true');f.setAttribute('tabindex','-1');document.body.appendChild(f);}}catch(e){}})();` }} />
        <AppNuqsAdapter>
          {children}
          <MembershipReminder />
          <DeskPet />
          <ThemeColorSync />
          <AuthTokenRefresher />
        </AppNuqsAdapter>
      </body>
    </html>
  );
}
