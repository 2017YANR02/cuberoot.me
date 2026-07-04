'use client';

// 桌宠「反馈」弹窗 — 需求 / Bug / 其他。登录后可提;支持 Ctrl+V / 拖拽 / 选择截图
// (客户端缩放转 webp)+ 一段短视频(≤15s ≤20MB,落服务端磁盘)。提交时静默捕获
// 页面/语言/主题/视口/UA 供 admin 复现。结构镜像 DonateModal(lang prop + 本地 t)。

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Film, X, Loader2, Check, LogIn, Inbox, MessagesSquare } from 'lucide-react';
import { useAuthStore, isAdmin } from '@/lib/auth-store';
import AppLink from '@/components/AppLink';
import { submitFeedback, uploadFeedbackImage, uploadFeedbackVideo } from '@/lib/feedback-api';
import './feedback-modal.css';

interface Props {
  lang: 'zh' | 'en';
  onClose: () => void;
}

const ICON = 15;
const MAX_IMAGES = 6;
const IMG_MAX_DIM = 1920;
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
const VIDEO_MAX_SEC = 15;
const BODY_MAX = 8000;

interface PendingImage { dataB64: string; mime: string; previewUrl: string; }
interface PendingVideo { file: File; durationMs: number; previewUrl: string; }

/** 缩放到 ≤IMG_MAX_DIM 并转 webp(不支持则 jpeg)。返回 base64 + 预览 dataURL。 */
async function fileToWebp(file: File): Promise<PendingImage | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, IMG_MAX_DIM / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bmp.close?.(); return null; }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    let mime = 'image/webp';
    let url = canvas.toDataURL(mime, 0.85);
    if (!url.startsWith('data:image/webp')) { mime = 'image/jpeg'; url = canvas.toDataURL(mime, 0.85); }
    const dataB64 = url.split(',')[1] ?? '';
    if (!dataB64) return null;
    return { dataB64, mime, previewUrl: url };
  } catch {
    return null;
  }
}

/** 读取视频时长(秒);失败返 0。 */
function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => resolve(0);
    v.src = url;
  });
}

export default function FeedbackModal({ lang, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [text, setText] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [video, setVideo] = useState<PendingVideo | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    };
  }, [onClose, submitting]);

  const addImages = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    setImgBusy(true);
    try {
      const processed: PendingImage[] = [];
      for (const f of files) {
        const p = await fileToWebp(f);
        if (p) processed.push(p);
      }
      setImages((prev) => [...prev, ...processed].slice(0, MAX_IMAGES));
    } finally {
      setImgBusy(false);
    }
  }, []);

  const setVideoFile = useCallback(async (file: File) => {
    setError(null);
    if (file.size > VIDEO_MAX_BYTES) {
      setError(t('视频太大,上限 20MB', 'Video too large (max 20MB)'));
      return;
    }
    const url = URL.createObjectURL(file);
    const dur = await probeDuration(url);
    if (dur > VIDEO_MAX_SEC + 0.5) {
      URL.revokeObjectURL(url);
      setError(t(`视频太长,上限 ${VIDEO_MAX_SEC} 秒`, `Video too long (max ${VIDEO_MAX_SEC}s)`));
      return;
    }
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    videoUrlRef.current = url;
    setVideo({ file, durationMs: Math.round(dur * 1000), previewUrl: url });
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const ingest = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const imgs = arr.filter((f) => f.type.startsWith('image/'));
    const vid = arr.find((f) => f.type.startsWith('video/'));
    if (imgs.length) void addImages(imgs);
    if (vid) void setVideoFile(vid);
  }, [addImages, setVideoFile]);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const files = e.clipboardData?.files;
    if (files && files.length && Array.from(files).some((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))) {
      e.preventDefault();
      ingest(files);
    }
  }, [ingest]);

  const removeImage = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));
  const removeVideo = () => {
    if (videoUrlRef.current) { URL.revokeObjectURL(videoUrlRef.current); videoUrlRef.current = null; }
    setVideo(null);
  };

  const canSubmit = text.trim().length > 0 && !submitting && !imgBusy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const theme = document.documentElement.getAttribute('data-theme')
        || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const { id } = await submitFeedback({
        kind: 'other',
        body: text.trim().slice(0, BODY_MAX),
        pageUrl: location.href,
        lang,
        theme,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent,
      });
      for (const img of images) {
        await uploadFeedbackImage(id, img.dataB64, img.mime);
      }
      if (video) {
        await uploadFeedbackVideo(id, video.file, video.durationMs);
      }
      setDone(true);
      try { window.dispatchEvent(new CustomEvent('clawd:state', { detail: 'happy' })); } catch { /* noop */ }
      setTimeout(onClose, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  return (
    <div className="fb-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
      role="dialog" aria-modal="true">
      <div className="fb-modal" onPaste={onPaste}>
        <button className="fb-close" onClick={onClose} aria-label={t('关闭', 'Close')} disabled={submitting}>
          <X size={ICON} />
        </button>

        {done ? (
          <div className="fb-done">
            <span className="fb-done-icon"><Check size={28} strokeWidth={2.4} /></span>
            <p>{t('收到了,谢谢你的反馈 ♡', 'Got it — thanks for the feedback ♡')}</p>
            <AppLink href="/feedback" className="fb-admin-link" onClick={onClose}>
              <MessagesSquare size={14} /> {t('在「我的反馈」查看进度和回复', 'Track it in My feedback')}
            </AppLink>
          </div>
        ) : !user ? (
          <div className="fb-login">
            <h2 className="fb-title">{t('反馈', 'Feedback')}</h2>
            <p className="fb-login-hint">{t('登录后即可提需求 / 报 Bug,方便我回复你。',
              'Sign in to send ideas / report bugs so I can follow up with you.')}</p>
            <button className="fb-login-btn" onClick={login}>
              <LogIn size={ICON} /> {t('登录', 'Sign in')}
            </button>
          </div>
        ) : (
          <>
            <h2 className="fb-title">{t('反馈', 'Feedback')}</h2>

            <textarea
              className="fb-textarea"
              value={text}
              maxLength={BODY_MAX}
              autoFocus
              onChange={(e) => setText(e.target.value)}
              placeholder={t('需求 / Bug / 建议,想说什么都行(可 Ctrl+V 粘贴截图)',
                'Ideas, bugs, anything — paste a screenshot with Ctrl+V')}
            />

            {(images.length > 0 || video) && (
              <div className="fb-attachments">
                {images.map((img, i) => (
                  <div key={i} className="fb-thumb">
                    <img src={img.previewUrl} alt="" />
                    <button type="button" className="fb-thumb-x" onClick={() => removeImage(i)}
                      aria-label={t('移除', 'Remove')}><X size={12} /></button>
                  </div>
                ))}
                {video && (
                  <div className="fb-thumb fb-thumb-video">
                    <video src={video.previewUrl} muted playsInline />
                    <span className="fb-thumb-dur">{(video.durationMs / 1000).toFixed(1)}s</span>
                    <button type="button" className="fb-thumb-x" onClick={removeVideo}
                      aria-label={t('移除', 'Remove')}><X size={12} /></button>
                  </div>
                )}
              </div>
            )}

            <div className="fb-add-row">
              <label className={`fb-add${images.length >= MAX_IMAGES ? ' is-disabled' : ''}`}>
                {imgBusy ? <Loader2 size={ICON} className="fb-spin" /> : <ImagePlus size={ICON} />}
                {t('截图', 'Screenshot')}
                <input type="file" accept="image/*" multiple hidden
                  disabled={images.length >= MAX_IMAGES}
                  onChange={(e) => { if (e.target.files) ingest(e.target.files); e.target.value = ''; }} />
              </label>
              <label className={`fb-add${video ? ' is-disabled' : ''}`}>
                <Film size={ICON} />
                {t('视频', 'Video')}
                <input type="file" accept="video/*" hidden disabled={!!video}
                  onChange={(e) => { if (e.target.files?.[0]) setVideoFile(e.target.files[0]); e.target.value = ''; }} />
              </label>
              <span className="fb-add-note">{t('≤15秒 · 也可粘贴/拖拽', '≤15s · paste or drag too')}</span>
            </div>

            {error && <p className="fb-error">{error}</p>}

            <button className="fb-submit" onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? <><Loader2 size={ICON} className="fb-spin" /> {t('提交中…', 'Sending…')}</> : t('提交', 'Send')}
            </button>

            <div className="fb-links">
              <AppLink href="/feedback" className="fb-admin-link" onClick={onClose}>
                <MessagesSquare size={14} /> {t('我的反馈', 'My feedback')}
              </AppLink>
              {isAdmin() && (
                <AppLink href="/feedback/admin" className="fb-admin-link" onClick={onClose}>
                  <Inbox size={14} /> {t('管理', 'Manage')}
                </AppLink>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
