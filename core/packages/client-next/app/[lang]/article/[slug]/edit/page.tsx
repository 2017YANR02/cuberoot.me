'use client';

/**
 * /article/[slug]/edit — 编辑现有文章。
 *
 * 注意路由结构:这是 [slug] 的子段 edit。阅读页 [slug]/page.tsx 是 server component,
 * 本页 'use client',互不冲突(Next App Router 同级允许 server / client 混用)。
 *
 * 门控:authed fetchArticleBySlug(含草稿)→ 仅 owner(authorWcaId === user.wcaId)
 * 或 admin(ADMIN_WCA_IDS)可改,否则「无权编辑」。编辑器 CodeMirror 走 dynamic ssr:false。
 */
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import { fetchArticleBySlug, type Article } from '@/lib/article-api';
import '../../article-list.css';

const ArticleEditor = dynamic(() => import('@/components/article/ArticleEditor'), {
  ssr: false,
});

export default function EditArticlePage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const params = useParams<{ lang: string; slug: string }>();
  const lang = params?.lang ?? (isZh ? 'zh' : 'en');
  const slug = params?.slug ?? '';
  const router = useRouter();

  useDocumentTitle(t('article.editArticle'), t('article.editArticle'));

  const user = useAuthStore((s) => s.user);

  const [article, setArticle] = useState<Article | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetchArticleBySlug(slug, { authed: true })
      .then((a) => {
        if (!cancelled) setArticle(a);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const isAdmin = !!user && ADMIN_WCA_IDS.includes(user.wcaId);
  // owner(快照 authorWcaId 对得上)或 admin;canEdit 作后端兜底(新字段防御)。
  const canEdit =
    !!article &&
    !!user &&
    (isAdmin || article.authorWcaId === user.wcaId || article.canEdit === true);

  return (
    <div className="article-list-page">
      <header className="article-list-header">
        <HomeLink className="article-list-back">
          <ChevronLeft size={16} />
          <span>{isZh ? '首页' : 'Home'}</span>
        </HomeLink>
      </header>

      <div className="article-list-titlerow">
        <h1 className="article-list-title">{t('article.editArticle')}</h1>
      </div>

      {loadErr && (
        <div className="article-list-empty article-list-error">
          {t('article.loadFailed')}: {loadErr}
        </div>
      )}

      {!article && !loadErr && (
        <div className="article-list-empty">{t('article.loading')}</div>
      )}

      {article && !canEdit && (
        <div className="article-list-empty">{t('article.noPermission')}</div>
      )}

      {article && canEdit && (
        <ArticleEditor
          mode="edit"
          initial={{
            slug: article.slug,
            title: article.title,
            subtitle: article.subtitle,
            body: article.body,
            publishedAt: article.publishedAt,
          }}
          onSaved={(savedSlug) => router.push(`/${lang}/article/${savedSlug}`)}
        />
      )}
    </div>
  );
}
