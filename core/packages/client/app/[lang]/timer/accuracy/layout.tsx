import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import { pageMetadata, PAGE_META } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('timer/accuracy');

export default async function Layout({ children, params }: {
  children: React.ReactNode; params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = lang === 'zh' ? 'zh' : 'en';
  const entry = PAGE_META['timer/accuracy'];
  return <>{children}<JsonLd data={articleJsonLd({
    headline: entry.title[locale], description: entry.description![locale], lang,
    url: `${SITE_URL}${locale === 'zh' ? '/zh' : ''}/timer/accuracy`,
  })} /></>;
}
