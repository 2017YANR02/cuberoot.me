import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import { PAGE_META, pageMetadata } from '@/lib/page-meta';
import './live-guide.css';

export const generateMetadata = pageMetadata('teachers/live-guide');

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang === 'zh' ? 'zh' : 'en';
  const entry = PAGE_META['teachers/live-guide'];
  return <><JsonLd data={articleJsonLd({
    headline: entry.title[locale],
    description: entry.description![locale],
    url: `${SITE_URL}${{ zh: '/zh', en: '' }[locale]}/teachers/live-guide`,
    lang,
  })} />{children}</>;
}
