import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePostContent, type Lang } from './useAlgCatalog';
import { AlgArticleView } from './AlgArticleView';
import { AlgsetView } from './AlgsetView';
import './alg.css';

export default function AlgPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { post, loading, error } = usePostContent(slug);
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const pageLang = isZh ? 'zh' : 'en';
  const [lang, setLang] = useState<Lang>(pageLang);

  if (loading) {
    return (
      <div className="alg-root">
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--alg-text-muted)' }}>
          {isZh ? '加载中…' : 'Loading…'}
        </div>
      </div>
    );
  }
  if (error || !post) {
    return (
      <div className="alg-root">
        <div style={{ padding: 48, textAlign: 'center' }}>
          <p>{error ?? (isZh ? '未找到此教程' : 'Tutorial not found')}</p>
        </div>
      </div>
    );
  }

  const hasEn = post.view === 'article' ? !!post.content.en : !!post.title.en;
  const hasZh = post.view === 'article' ? !!post.content.zh : !!post.title.zh;
  const title = post.title[lang] ?? post.title[lang === 'zh' ? 'en' : 'zh'] ?? post.slug;

  return (
    <div className="alg-root">
      <div className="alg-post-header">
        <div className="alg-breadcrumb">
          <Link to="/alg" className="alg-breadcrumb-back">
            {isZh ? '公式教程' : 'Algorithms'}
          </Link>
          <span className="alg-breadcrumb-sep">/</span>
          <span>{post.category}</span>
          {post.subcategory && (
            <>
              <span className="alg-breadcrumb-sep">/</span>
              <span>{post.subcategory}</span>
            </>
          )}
          <span className="alg-breadcrumb-sep">/</span>
          <strong>{title}</strong>
        </div>
        <div className="alg-lang-switch">
          <button
            className={'alg-lang-chip' + (lang === 'zh' ? ' is-active' : '')}
            onClick={() => setLang('zh')}
            disabled={!hasZh}
            title={!hasZh ? (isZh ? '无中文版' : 'No Chinese version') : ''}
          >
            中
          </button>
          <button
            className={'alg-lang-chip' + (lang === 'en' ? ' is-active' : '')}
            onClick={() => setLang('en')}
            disabled={!hasEn}
            title={!hasEn ? (isZh ? '无英文版' : 'No English version') : ''}
          >
            EN
          </button>
        </div>
      </div>
      {post.view === 'article' ? (
        <AlgArticleView post={post} lang={lang} />
      ) : (
        <AlgsetView post={post} />
      )}
    </div>
  );
}
