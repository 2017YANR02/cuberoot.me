import { notFound } from 'next/navigation';
import I18nProvider from '@/i18n/I18nProvider';

const SUPPORTED = ['en', 'zh'] as const;
type Locale = typeof SUPPORTED[number];

// Phase 3 [lang] migration: routes under app/[lang]/* get URL-driven locale
// (/zh/foo, /en/foo) instead of the legacy ?lang= query form. The root
// app/layout.tsx still owns <html>/<body>; this nested layout only adds the
// i18n wrapper with the URL-derived initial language so there's no en→zh
// flash for /zh/* pages.

export function generateStaticParams() {
  return SUPPORTED.map((lang) => ({ lang }));
}

export const dynamicParams = false; // 404 anything outside en/zh

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!SUPPORTED.includes(lang as Locale)) notFound();
  return <I18nProvider initialLang={lang as Locale}>{children}</I18nProvider>;
}
