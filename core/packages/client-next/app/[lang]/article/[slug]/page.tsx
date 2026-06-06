/**
 * /article/[slug] — 阅读页(READER)。
 *
 * SERVER COMPONENT + ISR(SPEC §0.2 / §6)。这是站点唯一偏离「全 'use client' +
 * 客户端 fetch」惯例的页:文章正文要被搜索引擎索引,markdown 净化是服务端硬边界。
 * react-markdown 管道(lib/article-markdown.tsx)显式声明可在 RSC 内渲染,ArticleBody
 * 无 'use client' —— 故采用 server-render 变体(见报告说明)。
 *
 *   dynamicParams=true:首篇外的 slug 首次命中按 ISR 渲染再缓存。
 *   revalidate=300:5 分钟再校验。
 *   generateStaticParams:拉已发布 slug 预生成(失败 try/catch 返空,不阻塞 build)。
 *
 * 不可用 cookies()/headers()(SSG 约束);只服已发布,缺失 / 未发布 → notFound()。
 */
import { notFound } from 'next/navigation';
import { apiUrl } from '@/lib/api-base';
import { displayCuberName } from '@/lib/cuber-name-display';
import { ArticleBody } from '@/components/article/ArticleBody';
import type { Article, ArticleListItem } from '@/lib/article-api';
import '../article.css';

export const dynamicParams = true;
export const revalidate = 300;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const r = await fetch(apiUrl('/v1/article'), { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const data = (await r.json()) as ArticleListItem[] | { articles?: ArticleListItem[] };
    const list = Array.isArray(data) ? data : (data?.articles ?? []);
    return list
      .filter((a) => a.publishedAt && typeof a.slug === 'string')
      .map((a) => ({ slug: a.slug }));
  } catch {
    return [];
  }
}

async function getArticle(slug: string): Promise<Article | null> {
  try {
    const r = await fetch(apiUrl(`/v1/article/${encodeURIComponent(slug)}`), {
      next: { revalidate: 300 },
    });
    if (!r.ok) return null;
    // 后端单篇包一层 { article };防御性回退到裸对象。
    const data = (await r.json()) as { article?: Article };
    const a = data?.article ?? (data as unknown as Article);
    // 阅读页只服已发布(草稿预览走编辑器客户端,带 auth)。
    if (!a || !a.publishedAt) return null;
    return a;
  } catch {
    return null;
  }
}

export default async function ArticleReaderPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const isZh = lang.startsWith('zh');

  const article = await getArticle(slug);
  if (!article) notFound();

  const author = article.authorName ? displayCuberName(article.authorName, isZh) : '';
  const date = article.publishedAt ? article.publishedAt.slice(0, 10) : '';
  const byline = [author, date].filter(Boolean).join('  ');

  return (
    <main className="article-page">
      <h1>{article.title}</h1>
      {article.subtitle && <p className="article-subtitle">{article.subtitle}</p>}
      {byline && (
        <p className="article-byline">
          {isZh ? '作者 ' : 'by '}
          {byline}
        </p>
      )}
      <ArticleBody body={article.body} />
    </main>
  );
}
