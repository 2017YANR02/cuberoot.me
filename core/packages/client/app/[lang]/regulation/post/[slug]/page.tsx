import { notFound } from 'next/navigation';
import { REG_NEWS } from '@/lib/regulation-posts';
import posts from '../../_data/posts.json';
import {ALL_NEWS} from '@/lib/regulation-posts';
import PostArticle from '../_components/PostArticle';
import NewsArticle from '../_components/NewsArticle';

export const dynamicParams = false;
export function generateStaticParams() {
  return ALL_NEWS.map((item) => ({ slug: item.id }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post=posts.find(item=>item.id===slug);
  if(post) return <PostArticle article={post}/>;
  if (!Object.hasOwn(REG_NEWS, slug)) notFound();
  return <NewsArticle slug={slug as keyof typeof REG_NEWS} />;
}
