import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import I18nProvider from '@/i18n/I18nProvider';
import PageNoticeBar from '@/components/PageNoticeBar';
import WeChatShareSync from '@/components/WeChatShareSync';

const SUPPORTED = ['en', 'zh'] as const;
type Locale = typeof SUPPORTED[number];

// Prerender both locales at build → pages under here become static (root layout
// is no longer dynamic). i18n is owned HERE (single provider, not nested under
// root) and driven by the URL param. The single <Suspense> gives the pages that
// call useSearchParams an ancestor boundary so static generation doesn't bail.
export function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'zh' }];
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!SUPPORTED.includes(lang as Locale)) notFound();
  return (
    <I18nProvider initialLang={lang as Locale}>
      <Suspense>
        <PageNoticeBar />
        {children}
      </Suspense>
      <WeChatShareSync />
    </I18nProvider>
  );
}
