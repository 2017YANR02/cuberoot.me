import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import "./fonts.css";
import { SiteHeader, type HeaderUser } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackPageView } from "@/components/TrackPageView";
import { SwRegister } from "@/components/SwRegister";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { getCurrentUser } from "@/lib/auth-user";
import { getSiteUrl, ogImageUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

const TITLE = "魔方开放社群 — 一站式魔方垂直综合服务平台";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "魔方社群",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: [
      { url: ogImageUrl(SITE_NAME), width: 1200, height: 630, alt: SITE_NAME },
    ],
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: [ogImageUrl(SITE_NAME)],
  },
};

export const viewport: Viewport = {
  themeColor: "#2A5DF4",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await getCurrentUser();
  const headerUser: HeaderUser | null = u
    ? { id: u.id, nickname: u.nickname, role: u.role }
    : null;
  return (
    <html lang="zh-CN">
      <body>
        <NuqsAdapter>
          <SiteHeader user={headerUser} />
          <main>{children}</main>
          <SiteFooter />
          <Suspense fallback={null}>
            <TrackPageView />
          </Suspense>
          <SwRegister />
          <PwaInstallButton />
        </NuqsAdapter>
      </body>
    </html>
  );
}
