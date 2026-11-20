import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import { PAGE_META, pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('math/generalized-riemann-hypothesis');
export default async function Layout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = lang === 'zh' ? 'zh' : 'en';
  const meta = PAGE_META['math/generalized-riemann-hypothesis'];
  return <>
    <JsonLd data={articleJsonLd({
      headline: meta.title[locale],
      description: meta.description?.[locale] ?? meta.title[locale],
      url: SITE_URL + { zh: '/zh/math/generalized-riemann-hypothesis', en: '/math/generalized-riemann-hypothesis' }[locale],
      lang: locale,
    })} />
    {children}
  </>;
}
