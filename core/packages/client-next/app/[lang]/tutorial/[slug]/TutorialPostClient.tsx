'use client';

import { useState } from 'react';
import Link from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { usePostContent, type Lang } from '../_lib/useTutorialCatalog';
import { TutorialArticleView } from '../_components/TutorialArticleView';
import { AlgsetView } from '../_components/AlgsetView';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../tutorial.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

export default function TutorialPostClient() {
  const params = useParams<{ slug: string | string[] }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const { post, loading, error } = usePostContent(slug);
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const pageLang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const [lang, setLang] = useState<Lang>(pageLang);

  const postTitle = post ? (post.title[pageLang] ?? post.title[pageLang === 'zh' ? 'en' : 'zh'] ?? post.slug) : (tr({ zh: '教程', en: 'Tutorial' }));
  useDocumentTitle(postTitle, postTitle);

  if (loading) {
    return (
      <div className="tutorial-root">
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--tutorial-text-muted)' }}>
          {tr({ zh: '加载中…', en: 'Loading…',
              zhHant: "載入中…"
        })}
        </div>
      </div>
    );
  }
  if (error || !post) {
    return (
      <div className="tutorial-root">
        <div style={{ padding: 48, textAlign: 'center' }}>
          <p>{error ?? (tr({ zh: '未找到此教程', en: 'Tutorial not found' }))}</p>
        </div>
      </div>
    );
  }

  const hasEn = post.view === 'article' ? !!post.content.en : !!post.title.en;
  const hasZh = post.view === 'article' ? !!post.content.zh : !!post.title.zh;
  const title = post.title[lang] ?? post.title[lang === 'zh' ? 'en' : 'zh'] ?? post.slug;

  return (
    <div className="tutorial-root">
      <div className="tutorial-post-header">
        <div className="tutorial-breadcrumb">
          <Link href="/tutorial" className="tutorial-breadcrumb-back">
            {tr({ zh: '公式教程', en: 'Algorithms' })}
          </Link>
          <span className="tutorial-breadcrumb-sep">/</span>
          <span>{post.category}</span>
          {post.subcategory && (
            <>
              <span className="tutorial-breadcrumb-sep">/</span>
              <span>{post.subcategory}</span>
            </>
          )}
          <span className="tutorial-breadcrumb-sep">/</span>
          <strong>{title}</strong>
        </div>
        <div className="tutorial-lang-switch">
          <button
            className={'tutorial-lang-chip' + (lang === 'zh' ? ' is-active' : '')}
            onClick={() => setLang('zh')}
            disabled={!hasZh}
            title={!hasZh ? (tr({ zh: '无中文版', en: 'No Chinese version',
                zhHant: "無中文版"
            })) : ''}
          >
            中
          </button>
          <button
            className={'tutorial-lang-chip' + (lang === 'en' ? ' is-active' : '')}
            onClick={() => setLang('en')}
            disabled={!hasEn}
            title={!hasEn ? (tr({ zh: '无英文版', en: 'No English version',
                zhHant: "無英文版"
            })) : ''}
          >
            EN
          </button>
        </div>
      </div>
      {post.view === 'article' ? (
        <TutorialArticleView post={post} lang={lang} />
      ) : (
        <AlgsetView post={post} />
      )}
    </div>
  );
}
