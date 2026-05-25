import type { Metadata } from "next";
import I18nProvider from "@/i18n/I18nProvider";
import { THEME_BOOTSTRAP } from "@/lib/theme-bootstrap";
import "./globals.css";

// Title is owned by pages via the useDocumentTitle hook (bilingual zh/en).
// Setting `title` in layout metadata re-emits <title> into <head> on every
// route re-render (e.g. post-hydration i18n changeLanguage), clobbering
// whatever the hook set. Keep description here; let pages set title.
export const metadata: Metadata = {
  description: "Cubing toolkit — solver, recon, training, WCA statistics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline theme bootstrap mutates html[data-theme]
    // before React hydrates; without this the diff between server (no attribute) and
    // client (data-theme=dark) prints a hydration warning.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link id="app-favicon" rel="icon" href="/icons/CubeRoot.png" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- inline bootstrap, must run before CSS */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
