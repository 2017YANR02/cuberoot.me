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
 * owner/admin 的 Edit/Delete 与登录用户的 Report 抽到 client island ArticleActions(依赖 auth)。
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';
import { displayCuberName } from '@/lib/cuber-name-display';
import { ArticleBody } from '@/components/article/ArticleBody';
import ArticleActions from '@/components/article/ArticleActions';
import type { Article, ArticleListItem } from '@/lib/article-api';
import '../article.css';

// 服务端三态文案 resolver。本页是 RSC,不能调客户端的 i18n/tr(tr 走 'use client' 的
// i18n singleton)。按路由 lang 参数直接 resolve en / zh / zh-Hant。
function trServer(lang: string, m: { en: string; zh: string; zhHant?: string }): string {
  if (lang === 'en') return m.en;
  if (lang === 'zh-Hant') return m.zhHant ?? m.zh;
  return m.zh;
}

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

/**
 * 「该作者的更多文章」:服务端拉作者已发布列表,去掉当前篇,只留已发布,最多 4 篇。
 * 失败 / 异常一律返空(不阻塞阅读页),返回轻量 list item。
 */
async function getMoreByAuthor(authorWcaId: string, currentSlug: string): Promise<ArticleListItem[]> {
  try {
    const r = await fetch(apiUrl(`/v1/article?author=${encodeURIComponent(authorWcaId)}`), {
      next: { revalidate: 300 },
    });
    if (!r.ok) return [];
    const data = (await r.json()) as ArticleListItem[] | { articles?: ArticleListItem[] };
    const list = Array.isArray(data) ? data : (data?.articles ?? []);
    return list
      .filter((a) => a && typeof a.slug === 'string' && a.slug !== currentSlug && !!a.publishedAt)
      .slice(0, 4);
  } catch {
    return [];
  }
}

export default async function ArticleReaderPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const isZh = lang.startsWith('zh');
  const langPrefix = isZh ? 'zh' : 'en';

  const article = await getArticle(slug);
  if (!article) notFound();

  const author = article.authorName ? displayCuberName(article.authorName, isZh) : '';
  const date = article.publishedAt ? article.publishedAt.slice(0, 10) : '';

  const more = article.authorWcaId
    ? await getMoreByAuthor(article.authorWcaId, article.slug)
    : [];

  return (
    <main className="article-page">
      <Link href={`/${langPrefix}/article`} className="article-breadcrumb">
        <ChevronLeft size={15} />
        <span>{trServer(lang, { zh: '全部文章', en: 'All articles', zhHant: '全部文章' })}</span>
      </Link>

      <h1>{article.title}</h1>
      {article.subtitle && <p className="article-subtitle">{article.subtitle}</p>}
      {(author || date) && (
        <p className="article-byline">
          {trServer(lang, { zh: '作者 ', en: 'by ', zhHant: '作者 ' })}
          {author && (
            <Link
              href={`/${langPrefix}/article/author/${article.authorWcaId}`}
              className="article-byline-author"
            >
              {author}
            </Link>
          )}
          {date && <span className="article-byline-date">{date}</span>}
        </p>
      )}

      <ArticleActions slug={article.slug} authorWcaId={article.authorWcaId} lang={lang} />

      <ArticleBody body={article.body} />

      {more.length > 0 && (
        <section className="article-more-by">
          <h2 className="article-more-by-title">
            {trServer(lang, { zh: '该作者的更多文章', en: 'More by this author', zhHant: '該作者的更多文章' })}
          </h2>
          <ul className="article-more-by-list">
            {more.map((a) => (
              <li key={a.slug}>
                <Link href={`/${langPrefix}/article/${a.slug}`}>{a.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
