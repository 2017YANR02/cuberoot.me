'use client';

// /forum/new — start a new thread. ?f= preselects the target forum.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryState, parseAsString } from 'nuqs';
import { Key } from 'lucide-react';
import { tr, T, useLang } from '@/i18n/tr';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore, useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { fetchForumIndex, createThread, type ForumIndexData } from '@/lib/forum-api';
import { ForumBreadcrumbs } from '../_components/ForumBreadcrumbs';
import { ForumMarkdownEditor } from '../_components/ForumMarkdownEditor';
import '../forum.css';
import './forum_new.css';

const MAX_TITLE_LEN = 200;
const MAX_CONTENT_LEN = 50000;

export default function ForumNewThreadPage() {
  useDocumentTitle('发帖', 'New thread');
  const router = useRouter();
  const lang = useLang();
  const zh = lang === 'zh';
  const user = useAuthUser();
  const isAdmin = useIsAdmin();

  const [forumSlug, setForumSlug] = useQueryState('f', parseAsString.withDefault(''));
  const [index, setIndex] = useState<ForumIndexData | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchForumIndex()
      .then(d => { if (!cancelled) setIndex(d); })
      .catch(e => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => {
    if (!index) return [];
    return index.categories
      .map(c => ({ ...c, forums: c.forums.filter(f => !f.adminOnly || isAdmin) }))
      .filter(c => c.forums.length > 0);
  }, [index, isAdmin]);

  // Default to the first postable forum when ?f= is absent or invalid.
  const validSlugs = useMemo(
    () => new Set(categories.flatMap(c => c.forums.map(f => f.slug))),
    [categories],
  );
  const selected = validSlugs.has(forumSlug) ? forumSlug : '';

  const handleSubmit = async () => {
    const t = title.trim();
    const body = content.trim();
    if (!selected) return setError(tr({ zh: '请选择版块', en: 'Pick a forum' }));
    if (!t) return setError(tr({ zh: '标题不能为空', en: 'Title is required' }));
    if (!body) return setError(tr({ zh: '内容不能为空', en: 'Content is required' }));
    if (body.length > MAX_CONTENT_LEN) {
      return setError(tr({ zh: `内容超过 ${MAX_CONTENT_LEN} 字上限`, en: `Content exceeds ${MAX_CONTENT_LEN} characters` }));
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await createThread(selected, t, body);
      const prefix = lang === 'zh' ? '/zh' : '';
      router.push(`${prefix}/forum/t/${res.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  const canSubmit = !!selected && !!title.trim() && !!content.trim() && !submitting;

  return (
    <div className="forum-page forum-new-page">
      <ForumBreadcrumbs items={[{ label: tr({ zh: '发帖', en: 'New thread' }) }]} />
      <div className="forum-page-header">
        <div>
          <h1><T zh="发新主题" en="Start a new thread" /></h1>
        </div>
      </div>

      {error && <div className="forum-error">{error}</div>}

      {!user ? (
        <button
          type="button"
          className="forum-login-hint"
          onClick={() => useAuthStore.getState().login()}
        >
          <Key size={15} aria-hidden="true" />
          <T zh="登录后发帖" en="Log in to post" />
        </button>
      ) : (
        <div className="forum-new-form">
          <label className="forum-new-field">
            <span className="forum-new-label"><T zh="版块" en="Forum" /></span>
            <select
              className="forum-sort-select"
              value={selected}
              onChange={e => setForumSlug(e.target.value || null)}
            >
              <option value="" disabled>{tr({ zh: '选择版块…', en: 'Pick a forum…' })}</option>
              {categories.map(cat => (
                <optgroup key={cat.id} label={zh ? cat.nameZh : cat.nameEn}>
                  {cat.forums.map(f => (
                    <option key={f.id} value={f.slug}>{zh ? f.nameZh : f.nameEn}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="forum-new-field">
            <span className="forum-new-label"><T zh="标题" en="Title" /></span>
            <div className="forum-new-title-wrap">
              <input
                className="forum-title-input"
                value={title}
                maxLength={MAX_TITLE_LEN}
                onChange={e => setTitle(e.target.value)}
                placeholder={tr({ zh: '一句话说清主题', en: 'Sum up your topic in one line' })}
              />
              {title.length >= MAX_TITLE_LEN - 40 && (
                <span className="forum-new-title-count">{title.length}/{MAX_TITLE_LEN}</span>
              )}
            </div>
          </label>

          <div className="forum-new-field">
            <span className="forum-new-label"><T zh="内容" en="Content" /></span>
            <ForumMarkdownEditor
              value={content}
              onChange={setContent}
              placeholder={tr({ zh: '展开说说…支持 Markdown 与标红 / 标蓝 / 活动画等指令', en: 'Tell us more… Markdown plus highlights / alg players and more' })}
            />
          </div>

          <div className="forum-new-actions">
            <button
              type="button"
              className="forum-btn-primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? tr({ zh: '发布中…', en: 'Posting…' }) : tr({ zh: '发布主题', en: 'Post thread' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
