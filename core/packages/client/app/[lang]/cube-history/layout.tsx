import type { ReactNode } from 'react';
import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import { PAGE_META, pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('cube-history');

export default async function Layout({ children, params }: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = lang === 'zh' ? 'zh' : 'en';
  const entry = PAGE_META['cube-history'];
  const prefix = locale === 'zh' ? '/zh' : '';
  return (
    <>
      <JsonLd data={articleJsonLd({
        headline: entry.title[locale],
        description: entry.description?.[locale] ?? '',
        url: `${SITE_URL}${prefix}/cube-history`,
        lang,
      })} />
      {children}
    </>
  );
}
