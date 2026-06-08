'use client';

/**
 * /article/new — 写新文章。
 *
 * 登录门控:未登录显示登录提示;登录后挂 <ArticleEditor mode="create" />,
 * 保存成功 → 跳到阅读页 /:lang/article/:slug。
 *
 * 编辑器(CodeMirror)走 next/dynamic({ssr:false}),不进 SSG bundle(SPEC §6),
 * 故本页 'use client'。语言前缀从 useParams 取(房规:全局组件 render 内禁 useSearchParams)。
 */
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, PenLine } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/lib/auth-store';
import '../article-list.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

// ArticleEditor pulls in CodeMirror; keep it out of any server / SSG path.
const ArticleEditor = dynamic(() => import('@/components/article/ArticleEditor'), {
  ssr: false,
});

export default function NewArticlePage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const params = useParams<{ lang: string }>();
  const lang = params?.lang ?? ((i18n.language.startsWith('zh') ? 'zh' : 'en'));
  const router = useRouter();

  useDocumentTitle(t('article.newArticle'), t('article.newArticle'));

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const isLoggedIn = !!user;

  return (
    <div className="article-list-page article-list-page--editor">
      <header className="article-list-header">
        <HomeLink className="article-list-back">
          <ChevronLeft size={16} />
          <span>{tr({ zh: '首页', en: 'Home',
              zhHant: "首頁"
        })}</span>
        </HomeLink>
      </header>

      <div className="article-list-titlerow">
        <h1 className="article-list-title">{t('article.newArticle')}</h1>
      </div>

      {!isLoggedIn ? (
        <div className="article-list-empty">
          <p>{t('article.signInToWrite')}</p>
          <button type="button" className="article-new-btn" onClick={() => login()}>
            <PenLine size={15} />
            <span>{t('article.signIn')}</span>
          </button>
        </div>
      ) : (
        <ArticleEditor
          mode="create"
          onSaved={(slug) => router.push(`${lang === 'zh' ? '/zh' : ''}/article/${slug}`)}
        />
      )}
    </div>
  );
}
