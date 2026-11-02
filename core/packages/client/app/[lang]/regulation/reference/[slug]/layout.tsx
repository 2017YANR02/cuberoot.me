import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';
import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import references from '../../_data/references-index.json';
import type { RegulationReference } from '@/lib/regulation-references';

type Params = Promise<{ lang: string; slug: string }>;
const description = { zh: 'WCA 规则、公告与调查报告的参考资料。', en: 'Reference material for WCA regulations, announcements and investigation reports.' };
const collection = { zh: '竞赛规则', en: 'Regulations' };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, slug } = await params;
  const item = (references as Omit<RegulationReference, 'html'>[]).find(item => item.id === slug);
  return item ? metadataFromEntry({ title: item.title, description }, lang) : {};
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { lang, slug } = await params;
  const item = (references as Omit<RegulationReference, 'html'>[]).find(item => item.id === slug);
  if (!item) return children;
  const language = lang === 'zh' ? 'zh' : 'en';
  const prefix = { zh: '/zh', en: '' }[language];
  return <><JsonLd data={articleJsonLd({
    headline: item.title[language], description: description[language], lang,
    url: SITE_URL + prefix + '/regulation/reference/' + slug,
    partOfName: collection[language], partOfUrl: SITE_URL + prefix + '/regulation',
  })} />{children}</>;
}
