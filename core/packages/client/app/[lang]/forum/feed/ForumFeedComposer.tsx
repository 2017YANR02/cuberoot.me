'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Key, PenLine, Video } from 'lucide-react';
import { T, tr, useLang } from '@/i18n/tr';
import { useAuthStore, useAuthUser, useIsAdmin } from '@/lib/auth-store';
import {
  createThread,
  deleteForumVideo,
  fetchForumIndex,
  type ForumIndexData,
  type ForumVideoDraft,
} from '@/lib/forum-api';
import { ForumMarkdownEditor } from '../_components/ForumMarkdownEditor';
import './forum_feed_composer.css';

const MAX_TITLE_LEN = 200;
const MAX_CONTENT_LEN = 50000;

export function ForumFeedComposer({ onCreated }: { onCreated: () => void }) {
  const lang = useLang();
  const zh = lang === 'zh';
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const [expanded, setExpanded] = useState(false);
  const [index, setIndex] = useState<ForumIndexData | null>(null);
  const [forumSlug, setForumSlug] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [video, setVideo] = useState<ForumVideoDraft | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const videoRef = useRef<ForumVideoDraft | null>(null);

  useEffect(() => { videoRef.current = video; }, [video]);
  useEffect(() => () => {
    const pending = videoRef.current;
    if (!pending) return;
    URL.revokeObjectURL(pending.previewUrl);
    void deleteForumVideo(pending.id).catch(() => {});
  }, []);

  useEffect(() => {
    if (!expanded || index) return;
    let cancelled = false;
    fetchForumIndex()
      .then((next) => { if (!cancelled) setIndex(next); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [expanded, index]);

  const categories = useMemo(() => (index?.categories ?? [])
    .map((category) => ({
      ...category,
      forums: category.forums.filter((forum) => !forum.adminOnly || isAdmin),
    }))
    .filter((category) => category.forums.length > 0), [index, isAdmin]);

  useEffect(() => {
    if (forumSlug || categories.length === 0) return;
    setForumSlug(categories[0].forums[0]?.slug ?? '');
  }, [categories, forumSlug]);

  const discardVideo = () => {
    const pending = videoRef.current;
    if (!pending) return;
    URL.revokeObjectURL(pending.previewUrl);
    void deleteForumVideo(pending.id).catch(() => {});
    videoRef.current = null;
    setVideo(null);
  };

  const collapse = () => {
    discardVideo();
    setTitle('');
    setContent('');
    setError('');
    setExpanded(false);
  };

  const submit = async () => {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!forumSlug) return setError(tr({ zh: '请选择版块', en: 'Pick a forum' }));
    if (!cleanTitle) return setError(tr({ zh: '请填写标题', en: 'Add a title' }));
    if (!cleanContent && !video) return setError(tr({ zh: '请填写文字或上传视频', en: 'Write something or upload a video' }));
    if (cleanContent.length > MAX_CONTENT_LEN) {
      return setError(tr({ zh: `内容超过 ${MAX_CONTENT_LEN} 字上限`, en: `Content exceeds ${MAX_CONTENT_LEN} characters` }));
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await createThread(forumSlug, cleanTitle, cleanContent, video?.id);
      if (video) URL.revokeObjectURL(video.previewUrl);
      videoRef.current = null;
      setVideo(null);
      setTitle('');
      setContent('');
      setExpanded(false);
      if (result.status === 'approved') {
        setNotice(tr({ zh: '已发布到社区动态。', en: 'Published to the community feed.' }));
        onCreated();
      } else {
        setNotice(tr({ zh: '已提交，审核通过后会显示在动态中。', en: 'Submitted. It will appear after review.' }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <button type="button" className="forum-feed-compose-trigger" onClick={() => useAuthStore.getState().login()}>
        <Key size={18} aria-hidden="true" />
        <span><T zh="登录后发布文字、图片或短视频" en="Log in to post text, images, or short video" /></span>
      </button>
    );
  }

  return (
    <section className={`forum-feed-composer${expanded ? ' is-expanded' : ''}`}>
      {!expanded ? (
        <>
          <button
            type="button"
            className="forum-feed-compose-trigger"
            onClick={() => { setNotice(''); setExpanded(true); }}
          >
            <PenLine size={18} aria-hidden="true" />
            <span><T zh="分享一个想法、图片或短视频…" en="Share a thought, image, or short video…" /></span>
            <span className="forum-feed-compose-kinds" aria-hidden="true">
              <ImageIcon size={17} />
              <Video size={17} />
            </span>
          </button>
          {notice && <p className="forum-feed-compose-notice">{notice}</p>}
        </>
      ) : (
        <>
          <div className="forum-feed-compose-fields">
            <input
              className="forum-title-input"
              value={title}
              maxLength={MAX_TITLE_LEN}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr({ zh: '标题：方便搜索与回复', en: 'Title: make it easy to find and reply' })}
              aria-label={tr({ zh: '主题标题', en: 'Thread title' })}
            />
            <select
              className="forum-sort-select"
              value={forumSlug}
              onChange={(e) => setForumSlug(e.target.value)}
              aria-label={tr({ zh: '发布版块', en: 'Destination forum' })}
            >
              {!index && <option value=""><T zh="加载版块中…" en="Loading forums…" /></option>}
              {categories.map((category) => (
                <optgroup key={category.id} label={zh ? category.nameZh : category.nameEn}>
                  {category.forums.map((forum) => (
                    <option key={forum.id} value={forum.slug}>{zh ? forum.nameZh : forum.nameEn}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <ForumMarkdownEditor
            compact
            value={content}
            onChange={setContent}
            video={video}
            onVideoChange={setVideo}
            onUploadStateChange={setMediaBusy}
            placeholder={tr({ zh: '写点文字，或从工具栏上传图片 / 视频…', en: 'Write something, or upload images / video from the toolbar…' })}
          />
          {error && <div className="forum-error">{error}</div>}
          <div className="forum-feed-compose-actions">
            <button type="button" className="forum-btn-ghost" onClick={collapse} disabled={mediaBusy || submitting}>
              <T zh="取消" en="Cancel" />
            </button>
            <button
              type="button"
              className="forum-btn-primary"
              onClick={submit}
              disabled={!forumSlug || !title.trim() || (!content.trim() && !video) || mediaBusy || submitting}
            >
              {submitting ? tr({ zh: '发布中…', en: 'Posting…' }) : tr({ zh: '发布', en: 'Post' })}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
