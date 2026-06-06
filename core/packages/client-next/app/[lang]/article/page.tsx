'use client';

/**
 * /article — 社区长文列表。
 *
 * 已发布文章(published_at DESC)。任何登录 WCA 用户可写(New Article 门控在登录态)。
 * 卡片网格无外框(房规):靠分隔线 + gap 区分条目。双语走 useTranslation + isZh + i18n key。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { ChevronLeft, PenLine } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/lib/auth-store';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fetchArticles, type ArticleListItem } from '@/lib/article-api';
import './article-list.css';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  // ISO yyyy-mm-dd(房规:日期一律 ISO,不用 locale 月份名)。
  return iso.slice(0, 10);
}

export default function ArticleListPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle(t('article.title'), t('article.title'));

  const user = useAuthStore((s) => s.user);
  const isLoggedIn = !!user;

  const [articles, setArticles] = useState<ArticleListItem[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [mine, setMine] = useState<ArticleListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchArticles()
      .then((list) => {
        if (!cancelled) setArticles(list);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 「我的文章」(草稿 + 已发布),仅登录时拉;失败静默(主列表不受影响)。
  useEffect(() => {
    if (!isLoggedIn) {
      setMine(null);
      return;
    }
    let cancelled = false;
    fetchArticles({ mine: true })
      .then((list) => {
        if (!cancelled) setMine(list);
      })
      .catch(() => {
        if (!cancelled) setMine([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  return (
    <div className="article-list-page">
      <header className="article-list-header">
        <HomeLink className="article-list-back">
          <ChevronLeft size={16} />
          <span>{isZh ? '首页' : 'Home'}</span>
        </HomeLink>
      </header>

      <div className="article-list-titlerow">
        <h1 className="article-list-title">{t('article.title')}</h1>
        {isLoggedIn && (
          <Link href={isZh ? '/zh/article/new' : '/en/article/new'} className="article-new-btn">
            <PenLine size={15} />
            <span>{t('article.writeOne')}</span>
          </Link>
        )}
      </div>

      <p className="article-list-lead">{t('article.subtitle')}</p>

      {isLoggedIn && mine && mine.length > 0 && (
        <section className="article-mine">
          <h2 className="article-mine-title">{t('article.myArticles')}</h2>
          <div className="article-grid">
            {mine.map((a) => (
              <Link
                key={`mine-${a.slug}`}
                href={`/${isZh ? 'zh' : 'en'}/article/${a.slug}/edit`}
                className="article-card"
              >
                <div className="article-card-title">{a.title}</div>
                {a.subtitle && <div className="article-card-subtitle">{a.subtitle}</div>}
                <div className="article-card-meta">
                  {a.publishedAt ? (
                    <span>
                      {t('article.published')} {formatDate(a.publishedAt)}
                    </span>
                  ) : (
                    <span className="article-card-draft">{t('article.draft')}</span>
                  )}
                  <span className="article-card-editlink">{t('article.edit')}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {loadErr && (
        <div className="article-list-empty article-list-error">
          {(isZh ? '加载失败: ' : 'Failed to load: ') + loadErr}
        </div>
      )}

      {!articles && !loadErr && (
        <div className="article-list-empty">{t('article.loading')}</div>
      )}

      {articles && articles.length === 0 && (
        <div className="article-list-empty">{t('article.empty')}</div>
      )}

      {articles && articles.length > 0 && (
        <div className="article-grid">
          {articles.map((a) => (
            <Link
              key={a.slug}
              href={isZh ? `/zh/article/${a.slug}` : `/en/article/${a.slug}`}
              className="article-card"
            >
              <div className="article-card-title">{a.title}</div>
              {a.subtitle && <div className="article-card-subtitle">{a.subtitle}</div>}
              <div className="article-card-meta">
                {a.authorName && <span>{displayCuberName(a.authorName, isZh)}</span>}
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
