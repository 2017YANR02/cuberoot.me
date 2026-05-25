import type { Metadata } from "next";
import Script from "next/script";
import I18nProvider from "@/i18n/I18nProvider";
import { THEME_BOOTSTRAP } from "@/lib/theme-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "CubeRoot",
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
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
        />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
