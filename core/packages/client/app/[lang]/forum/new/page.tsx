'use client';

// /forum/new — start a new thread. ?f= preselects the target forum.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryState, parseAsString } from 'nuqs';
import { Key } from 'lucide-react';
import { tr, T, useLang } from '@/i18n/tr';
import { useAuthStore, useAuthUser, useIsAdmin } from '@/lib/auth-store';
import {
  createThread,
  deleteForumVideo,
  fetchForumIndex,
  type ForumIndexData,
  type ForumVideoDraft,
} from '@/lib/forum-api';
import { ForumBreadcrumbs } from '../_components/ForumBreadcrumbs';
import { ForumMarkdownEditor } from '../_components/ForumMarkdownEditor';
import '../forum.css';
import './forum_new.css';

const MAX_TITLE_LEN = 200;
const MAX_CONTENT_LEN = 50000;

export default function ForumNewThreadPage() {
  const router = useRouter();
  const lang = useLang();
  const zh = lang === 'zh';
  const user = useAuthUser();
  const isAdmin = useIsAdmin();

  const [forumSlug, setForumSlug] = useQueryState('f', parseAsString.withDefault(''));
  const [index, setIndex] = useState<ForumIndexData | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [video, setVideo] = useState<ForumVideoDraft | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef<ForumVideoDraft | null>(null);

  useEffect(() => { videoRef.current = video; }, [video]);
  useEffect(() => () => {
    const pending = videoRef.current;
    if (!pending) return;
    URL.revokeObjectURL(pending.previewUrl);
    void deleteForumVideo(pending.id).catch(() => {});
  }, []);

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
    if (!body && !video) return setError(tr({ zh: '请填写文字或上传视频', en: 'Write something or upload a video' }));
    if (body.length > MAX_CONTENT_LEN) {
      return setError(tr({ zh: `内容超过 ${MAX_CONTENT_LEN} 字上限`, en: `Content exceeds ${MAX_CONTENT_LEN} characters` }));
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await createThread(selected, t, body, video?.id);
      if (video) URL.revokeObjectURL(video.previewUrl);
      videoRef.current = null;
      const prefix = lang === 'zh' ? '/zh' : '';
      router.push(`${prefix}/forum/t/${res.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  const canSubmit = !!selected && !!title.trim() && (!!content.trim() || !!video) && !submitting && !mediaBusy;

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
          <div className="forum-new-meta-row">
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
          </div>

          <div className="forum-new-field">
            <span className="forum-new-label"><T zh="内容与媒体" en="Content and media" /></span>
            <ForumMarkdownEditor
              value={content}
              onChange={setContent}
              video={video}
              onVideoChange={setVideo}
              onUploadStateChange={setMediaBusy}
              placeholder={tr({ zh: '写点文字，或直接上传图片 / 视频…', en: 'Write something, or upload images / video…' })}
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
