'use client';

/**
 * /article/author/[wcaId] — 某作者的已发布文章。
 *
 * 镜像列表页结构:客户端 fetchArticles({ author }),复用 .article-grid / .article-card。
 * 双语走 useTranslation + isZh + i18n key。无 New Article 按钮(纯浏览)。
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, PenLine } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fetchArticles, type ArticleListItem } from '@/lib/article-api';
import '../../article-list.css';
import { tr } from '@/i18n/tr';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  // ISO yyyy-mm-dd(房规:日期一律 ISO,不用 locale 月份名)。
  return iso.slice(0, 10);
}

export default function ArticleAuthorClient() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const langPrefix = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  const params = useParams<{ wcaId: string }>();
  const wcaId = Array.isArray(params.wcaId) ? params.wcaId[0] : params.wcaId;

  const [articles, setArticles] = useState<ArticleListItem[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!wcaId) return;
    let cancelled = false;
    fetchArticles({ author: wcaId })
      .then((list) => {
        if (!cancelled) setArticles(list);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [wcaId]);

  // 所有文章同一作者:取首篇作者名。未知则回退到 wcaId。
  const authorName = useMemo(() => {
    const raw = articles?.[0]?.authorName;
    return raw ? displayCuberName(raw, isZh) : '';
  }, [articles, isZh]);

  const heading = authorName ? t('article.byAuthor', { name: authorName }) : (wcaId ?? '');
  useDocumentTitle(heading, heading);

  return (
    <div className="article-list-page">
      <header className="article-list-header">
        <HomeLink className="article-list-back">
          <ChevronLeft size={16} />
          <span>{tr({ zh: '首页', en: 'Home'
        })}</span>
        </HomeLink>
        <Link href={`/${langPrefix}/article`} className="article-list-back article-author-crumb">
          <ChevronLeft size={16} />
          <span>{t('article.backToList')}</span>
        </Link>
      </header>

      <h1 className="article-list-title article-author-title">{heading}</h1>

      {loadErr && (
        <div className="article-list-empty article-list-error">
          {tr({ zh: '加载失败: ', en: 'Failed to load: '
                          }) + loadErr}
        </div>
      )}

      {!articles && !loadErr && (
        <div className="article-list-empty">{t('article.loading')}</div>
      )}

      {articles && articles.length === 0 && (
        <div className="article-list-empty article-author-empty">
          <p>{t('article.authorEmpty')}</p>
          <Link href={`/${langPrefix}/article/new`} className="article-new-btn">
            <PenLine size={15} />
            <span>{t('article.writeOne')}</span>
          </Link>
        </div>
      )}

      {articles && articles.length > 0 && (
        <div className="article-grid">
          {articles.map((a) => (
            <Link
              key={a.slug}
              href={`/${langPrefix}/article/${a.slug}`}
              className="article-card"
            >
              <div className="article-card-title">{a.title}</div>
              {a.subtitle && <div className="article-card-subtitle">{a.subtitle}</div>}
              <div className="article-card-meta">
                {a.publishedAt ? (
                  <span>{formatDate(a.publishedAt)}</span>
                ) : (
                  <span className="article-card-draft">{t('article.draft')}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
