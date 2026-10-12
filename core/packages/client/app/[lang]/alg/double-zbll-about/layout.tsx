import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import { PAGE_META, pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('alg/double-zbll-about');

export default async function Layout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = lang === 'zh' ? 'zh' : 'en';
  const entry = PAGE_META['alg/double-zbll-about'];
  return <>
    <JsonLd data={articleJsonLd({
      headline: entry.title[locale], description: entry.description![locale], lang,
      url: `${SITE_URL}${locale === 'zh' ? '/zh' : ''}/alg/double-zbll-about`,
    })} />
    {children}
  </>;
}
