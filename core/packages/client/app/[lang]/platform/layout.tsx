import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PlatformShell } from '@/components/platform/PlatformShell';
import { pageMetadata } from '@/lib/page-meta';
import '@/components/platform/platform.css';

const platformMetadata = pageMetadata('platform');

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const en = 'https://cuberoot.me/platform';
  const zh = 'https://cuberoot.me/zh/platform';
  return {
    ...await platformMetadata({ params }),
    alternates: {
      canonical: lang === 'zh' ? zh : en,
      languages: { en, zh, 'x-default': en },
    },
  };
}

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
