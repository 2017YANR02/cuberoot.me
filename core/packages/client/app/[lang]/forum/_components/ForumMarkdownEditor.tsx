'use client';

/**
 * ForumMarkdownEditor — rich markdown + directive editor for long-form forum threads.
 *
 * Ported from the retired /article ArticleEditor when the article system was folded into
 * the forum. Split pane = CodeMirror markdown source (left) + LIVE PREVIEW (right). The preview
 * reuses renderArticleMarkdown — the ONE sanitizer of record — inside .forum-post-body, so the
 * author sees exactly what a posted thread renders (same remark-directive → sanitize → leaf pipeline).
 *
 * CodeMirror loads via next/dynamic({ ssr:false }) so its chunk never enters the SSG / server
 * bundle. The live EditorView is captured through onCreateEditor; toolbar edits dispatch on it.
 * Toolbar inserts the directive syntax (:red / :blue / :::figrow / :alg / :cube). Images go through
 * uploadImageBlob (base64 channel) via button / drag-drop / paste; the returned markdown image is
 * inserted at the cursor.
 *
 * Controlled value/onChange only — title, forum picker and submit stay in the page (/forum/new).
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Bold, Heading, Highlighter, Info, Image as ImageIcon, Rows3, Play, Box,
  Video as VideoIcon, X,
} from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import { FORUM_VIDEO_MAX_DURATION_SECONDS } from '@cuberoot/shared/forum';
import { ForumVideoPlayer } from '@/components/forum/ForumVideoPlayer';
import { Spinner } from '@/components/Spinner/Spinner';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { uploadImageBlob } from '@/lib/image-upload';
import {
  deleteForumVideo,
  uploadForumVideo,
  type ForumVideoDraft,
} from '@/lib/forum-api';
import { useT } from '@/hooks/useT';
import './forum_editor.css';

// CodeMirror chunk stays out of the server / SSG bundle. ssr:false → only mounts client-side.
const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), {
  ssr: false,
  loading: () => <div className="forum-editor-cm-loading" />,
});

// markdown() + a class-based highlight style, loaded lazily alongside the editor. basicSetup's
// default (light-only) highlighting is disabled; our classes live in forum_editor.css → auto light/dark.
const markdownExt = () =>
  Promise.all([
    import('@codemirror/lang-markdown'),
    import('@codemirror/language'),
    import('@lezer/highlight'),
    import('@codemirror/view'),
  ]).then(([md, lang, hl, view]) => {
    const t = hl.tags;
    const style = lang.HighlightStyle.define([
      { tag: t.heading, class: 'cm-md-heading' },
      { tag: t.strong, class: 'cm-md-strong' },
      { tag: t.emphasis, class: 'cm-md-em' },
      { tag: t.strikethrough, class: 'cm-md-strike' },
      { tag: [t.link, t.url], class: 'cm-md-link' },
      { tag: t.monospace, class: 'cm-md-code' },
      { tag: [t.list, t.quote], class: 'cm-md-muted' },
      { tag: [t.processingInstruction, t.meta, t.contentSeparator], class: 'cm-md-punct' },
    ]);
    return [md.markdown(), lang.syntaxHighlighting(style), view.EditorView.lineWrapping];
  });

// File → base64 (strip the `data:<mime>;base64,` prefix; backend wants raw b64).
function fileToBase64(file: File): Promise<{ dataB64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve({ dataB64: comma >= 0 ? result.slice(comma + 1) : result, mime: file.type });
    };
    reader.readAsDataURL(file);
  });
}

const ACCEPTED_IMAGE = /^image\/(png|jpeg|webp)$/;
const ACCEPTED_VIDEO = /^video\/(mp4|webm|quicktime)$/;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

function probeVideo(file: File): Promise<{ durationMs: number; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file);
    const media = document.createElement('video');
    const cleanup = () => {
      media.onloadedmetadata = null;
      media.onerror = null;
      media.removeAttribute('src');
      media.load();
    };
    media.preload = 'metadata';
    media.onloadedmetadata = () => {
      const durationMs = Math.round(media.duration * 1000);
      cleanup();
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        URL.revokeObjectURL(previewUrl);
        reject(new Error('duration unavailable'));
        return;
      }
      resolve({ durationMs, previewUrl });
    };
    media.onerror = () => {
      cleanup();
      URL.revokeObjectURL(previewUrl);
      reject(new Error('duration unavailable'));
    };
    media.src = previewUrl;
  });
}

export interface ForumEditorHandle {
  focus: () => void;
}

interface ForumMarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  video?: ForumVideoDraft | null;
  onVideoChange?: (video: ForumVideoDraft | null) => void;
  onUploadStateChange?: (busy: boolean) => void;
  compact?: boolean;
}

export const ForumMarkdownEditor = forwardRef<ForumEditorHandle, ForumMarkdownEditorProps>(function ForumMarkdownEditor({
  value, onChange, placeholder, video = null, onVideoChange, onUploadStateChange, compact = false,
}, ref) {
  const tt = useT();

  const [uploading, setUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const viewRef = useRef<EditorView | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const videoUploadingRef = useRef(false);
  const [cmExtensions, setCmExtensions] = useState<unknown[]>([]);

  // Quote injection (from the thread page) focuses the editor and drops the caret
  // at the end so the appended quote block is in view.
  useImperativeHandle(ref, () => ({
    focus: () => {
      const view = viewRef.current;
      if (view) {
        view.focus();
        view.dispatch({ selection: { anchor: view.state.doc.length } });
      }
      rootRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
  }), []);

  useEffect(() => {
    let alive = true;
    markdownExt().then((ext) => { if (alive) setCmExtensions(ext); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    onUploadStateChange?.(uploading || videoUploading);
  }, [onUploadStateChange, uploading, videoUploading]);

  const preview = useMemo(() => renderArticleMarkdown(value), [value]);

  // ── CodeMirror dispatch helpers ─────────────────────────────────────────────
  const dispatchReplace = useCallback(
    (build: (sel: string) => { insert: string; selFrom?: number; selTo?: number }) => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      const { insert, selFrom, selTo } = build(selected);
      view.dispatch({
        changes: { from, to, insert },
        selection: {
          anchor: from + (selFrom ?? insert.length),
          head: from + (selTo ?? insert.length),
        },
      });
      view.focus();
      onChange(view.state.doc.toString());
    },
    [onChange],
  );

  // Wrap selection with prefix/suffix; if empty, place cursor between and select placeholder.
  const wrap = useCallback(
    (prefix: string, suffix: string, ph: string) => {
      dispatchReplace((sel) => {
        const inner = sel || ph;
        const insert = prefix + inner + suffix;
        return { insert, selFrom: prefix.length, selTo: prefix.length + inner.length };
      });
    },
    [dispatchReplace],
  );

  // Insert a block at the start of the current line (heading / fenced block).
  const insertBlock = useCallback(
    (text: string, selOffset?: [number, number]) => {
      const view = viewRef.current;
      if (!view) return;
      const { from } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      const atLineStart = from === line.from;
      const insert = (atLineStart ? '' : '\n') + text;
      const base = from + (atLineStart ? 0 : 1);
      view.dispatch({
        changes: { from, to: from, insert },
        selection: selOffset
          ? { anchor: base + selOffset[0], head: base + selOffset[1] }
          : { anchor: from + insert.length },
      });
      view.focus();
      onChange(view.state.doc.toString());
    },
    [onChange],
  );

  const insertImageMarkdown = useCallback(
    (url: string, alt: string) => {
      dispatchReplace(() => ({ insert: `![${alt}](${url})` }));
    },
    [dispatchReplace],
  );

  const handleVideo = useCallback(async (file: File) => {
    if (!onVideoChange) return;
    if (videoUploadingRef.current) {
      setError(tt('已有视频正在上传', 'A video is already uploading'));
      return;
    }
    if (!ACCEPTED_VIDEO.test(file.type)) {
      setError(tt('仅支持 MP4 / WebM / MOV 视频', 'Only MP4 / WebM / MOV videos are supported'));
      return;
    }
    if (file.size <= 0 || file.size > MAX_VIDEO_BYTES) {
      setError(tt('视频不能超过 200MB', 'Video cannot exceed 200MB'));
      return;
    }
    setError(null);
    videoUploadingRef.current = true;
    setVideoUploading(true);
    let previewUrl = '';
    try {
      const probe = await probeVideo(file);
      previewUrl = probe.previewUrl;
      if (probe.durationMs > FORUM_VIDEO_MAX_DURATION_SECONDS * 1000) {
        throw new Error(tt(
          `视频不能超过 ${FORUM_VIDEO_MAX_DURATION_SECONDS} 秒`,
          `Video cannot exceed ${FORUM_VIDEO_MAX_DURATION_SECONDS} seconds`,
        ));
      }
      const uploaded = await uploadForumVideo(file);
      if (video) {
        URL.revokeObjectURL(video.previewUrl);
        void deleteForumVideo(video.id).catch(() => {});
      }
      onVideoChange({ ...uploaded, fileName: file.name, previewUrl });
      previewUrl = '';
    } catch (e) {
      setError(e instanceof Error && e.message !== 'duration unavailable'
        ? e.message
        : tt('无法读取视频时长', 'Could not read the video duration'));
    } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      videoUploadingRef.current = false;
      setVideoUploading(false);
    }
  }, [onVideoChange, tt, video]);

  const removeVideo = useCallback(() => {
    if (!video || !onVideoChange) return;
    URL.revokeObjectURL(video.previewUrl);
    onVideoChange(null);
    void deleteForumVideo(video.id).catch(() => {});
  }, [onVideoChange, video]);

  // ── media upload (button / drop / paste) ────────────────────────────────────
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const all = Array.from(files);
      const images = all.filter((f) => ACCEPTED_IMAGE.test(f.type));
      const videos = onVideoChange ? all.filter((f) => ACCEPTED_VIDEO.test(f.type)) : [];
      if (images.length === 0 && videos.length === 0) {
        if (all.length > 0) setError(onVideoChange
          ? tt('仅支持 PNG / JPEG / WebP 图片和 MP4 / WebM / MOV 视频', 'Only PNG / JPEG / WebP images and MP4 / WebM / MOV videos are supported')
          : tt('仅支持 PNG / JPEG / WebP 图片', 'Only PNG / JPEG / WebP images'));
        return;
      }
      setError(null);
      if (images.length > 0) {
        setUploading(true);
        try {
          for (const file of images) {
            const { dataB64, mime } = await fileToBase64(file);
            const img = await uploadImageBlob(dataB64, mime);
            const alt = file.name.replace(/\.[^.]+$/, '');
            insertImageMarkdown(img?.url ?? '', alt);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setUploading(false);
        }
      }
      if (videos.length > 0) await handleVideo(videos[0]);
      if (videos.length > 1) {
        setError(tt('每个主题最多上传一个视频', 'Each thread can have one video'));
      }
    },
    [handleVideo, insertImageMarkdown, onVideoChange, tt],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const media: File[] = [];
      for (const it of Array.from(items)) {
        if (it.kind === 'file' && (ACCEPTED_IMAGE.test(it.type) || (onVideoChange && ACCEPTED_VIDEO.test(it.type)))) {
          const f = it.getAsFile();
          if (f) media.push(f);
        }
      }
      if (media.length > 0) {
        e.preventDefault();
        void handleFiles(media);
      }
    },
    [handleFiles, onVideoChange],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) void handleFiles(files);
    },
    [handleFiles],
  );

  const toolbarBtn = (
    key: string, label: string, Icon: typeof Bold, onClick: () => void,
  ) => (
    <button
      key={key} type="button" className="forum-editor-tool"
      title={label} aria-label={label} onClick={onClick}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className={`forum-editor${compact ? ' is-compact' : ''}`} ref={rootRef}>
      <div className="forum-editor-toolbar">
        {toolbarBtn('bold', tt('加粗', 'Bold'), Bold, () => wrap('**', '**', tt('粗体', 'bold')))}
        {toolbarBtn('heading', tt('小标题', 'Heading'), Heading, () => insertBlock('## ', [3, 3]))}
        {toolbarBtn('red', tt('标红 (重点)', 'Red (key point)'), Highlighter, () =>
          wrap(':red[', ']', tt('重点', 'key point')))}
        {toolbarBtn('blue', tt('标蓝 (背景知识)', 'Blue (background)'), Info, () =>
          wrap(':blue[', ']', tt('背景知识', 'background')))}
        {toolbarBtn('figrow', tt('图网格', 'Figure grid'), Rows3, () =>
          insertBlock(':::figrow\n\n![](url1)\n![](url2)\n\n:::\n'))}
        {toolbarBtn('alg', tt('活动画 (alg)', 'Alg player'), Play, () =>
          wrap(':alg[', ']{puzzle=3x3x3}', "R U R' U'"))}
        {toolbarBtn('cube', tt('魔方图', 'Cube image'), Box, () => wrap(':cube[', ']{view=oll}', ''))}
        <span className="forum-editor-tool-sep" aria-hidden="true" />
        <button
          type="button" className="forum-editor-tool"
          title={tt('插入图片', 'Insert image')} aria-label={tt('插入图片', 'Insert image')}
          onClick={() => fileInputRef.current?.click()} disabled={uploading}
        >
          {uploading ? <Spinner size={16} /> : <ImageIcon size={16} />}
        </button>
        <input
          ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
          onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ''; }}
        />
        {onVideoChange && (
          <>
            <button
              type="button" className="forum-editor-tool"
              title={tt('上传短视频', 'Upload short video')} aria-label={tt('上传短视频', 'Upload short video')}
              onClick={() => videoInputRef.current?.click()} disabled={videoUploading}
            >
              {videoUploading ? <Spinner size={16} /> : <VideoIcon size={16} />}
            </button>
            <input
              ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime,.mov" hidden
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleVideo(file); e.target.value = ''; }}
            />
          </>
        )}
        <span className="forum-editor-tool-hint">
          {onVideoChange
            ? tt(`图片 + 最长 ${FORUM_VIDEO_MAX_DURATION_SECONDS} 秒视频`, `Images + video up to ${FORUM_VIDEO_MAX_DURATION_SECONDS}s`)
            : tt('支持 Markdown 与指令', 'Markdown + directives')}
        </span>
      </div>

      <div className="forum-editor-split">
        <div
          className={'forum-editor-source' + (dragOver ? ' forum-editor-source-drag' : '')}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onPaste={onPaste}
        >
          <CodeMirror
            value={value}
            theme="none"
            height="100%"
            placeholder={placeholder ?? tt(
              '在这里写 markdown… 工具栏可插入标红 / 标蓝 / 活动画等',
              'Write markdown here… use the toolbar for highlights / alg players / images',
            )}
            extensions={cmExtensions as never}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
              syntaxHighlighting: false,
            }}
            onChange={(v) => onChange(v)}
            onCreateEditor={(view) => { viewRef.current = view; }}
          />
          {dragOver && (
            <div className="forum-editor-drop-hint">
              {onVideoChange ? tt('松开上传图片或视频', 'Drop to upload image or video') : tt('松开上传图片', 'Drop to upload image')}
            </div>
          )}
        </div>

        <div className="forum-editor-preview">
          <div className="forum-post-body forum-editor-preview-body">
            {value.trim()
              ? preview
              : <p className="forum-editor-preview-empty">{tt('预览会显示在这里', 'Preview appears here')}</p>}
          </div>
        </div>
      </div>

      {video && (
        <div className="forum-editor-video-preview">
          <div className="forum-editor-video-heading">
            <span>{video.fileName}</span>
            <button className="forum-editor-video-remove" type="button" onClick={removeVideo} aria-label={tt('移除视频', 'Remove video')}>
              <X size={15} aria-hidden="true" />
              {tt('移除', 'Remove')}
            </button>
          </div>
          <ForumVideoPlayer video={video} src={video.previewUrl} />
        </div>
      )}

      {error && <div className="forum-editor-error">{error}</div>}
    </div>
  );
});
