import type { ReactNode } from 'react';
import { pageMetadata, PAGE_META } from '@/lib/page-meta';
import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';

export const generateMetadata = pageMetadata('dev/continuous-corners');

export default async function Layout({ children, params }: {
  children: ReactNode; params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = lang === 'zh' ? 'zh' : 'en';
  const meta = PAGE_META['dev/continuous-corners']!;
  return <>
    <JsonLd data={articleJsonLd({
      headline: meta.title[locale],
      description: meta.description![locale],
      lang,
      url: `${SITE_URL}${locale === 'zh' ? '/zh' : ''}/dev/continuous-corners`,
      partOfName: 'CubeRoot dev',
      partOfUrl: `${SITE_URL}${locale === 'zh' ? '/zh' : ''}/dev`,
    })} />
    {children}
  </>;
}
