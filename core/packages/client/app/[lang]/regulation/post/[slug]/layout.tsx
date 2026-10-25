import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';
import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import { ALL_NEWS } from '@/lib/regulation-posts';

type Params = Promise<{ lang: string; slug: string }>;
const description = { zh: 'WCA 官方公告与中文译文。', en: 'WCA announcement and Chinese translation.' };
const collection = { zh: '公告', en: 'Posts' };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, slug } = await params;
  const item=ALL_NEWS.find(item=>item.id===slug);
  if(!item)return {};
  return metadataFromEntry({title:item.title,description},lang);
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { lang, slug } = await params;
  const item=ALL_NEWS.find(item=>item.id===slug);
  if(!item)return children;
  const language = lang === 'zh' ? 'zh' : 'en';
  const prefix = { zh: '/zh', en: '' }[language];
  return <><JsonLd data={articleJsonLd({
    headline: item.title[language], description: description[language], lang,
    url: SITE_URL + prefix + '/regulation/post/' + slug,
    partOfName: collection[language], partOfUrl: SITE_URL + prefix + '/regulation/post',
  })} />{children}</>;
}
