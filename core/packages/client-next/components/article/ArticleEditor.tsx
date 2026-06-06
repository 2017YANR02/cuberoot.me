'use client';

/**
 * ArticleEditor — in-browser markdown + directive editor for /article.
 *
 * Split pane = CodeMirror markdown source (left) + LIVE PREVIEW (right). The preview reuses
 * renderArticleMarkdown — the ONE sanitizer of record — so what the author sees is byte-for-byte
 * what the reader page renders (same remark-directive → sentinel → rehype-sanitize → leaf pipeline).
 *
 * CodeMirror is loaded via next/dynamic({ ssr:false }) so the editor chunk never enters the
 * SSG / server bundle (SPEC §6). We capture the live EditorView through onCreateEditor (rather
 * than ref-forwarding through next/dynamic, which is brittle) and dispatch toolbar edits on it.
 *
 * Toolbar inserts the directive syntax from SPEC §4. Images go through uploadArticleImage
 * (base64 channel) via button / drag-drop / paste; the returned markdown image is inserted at
 * the cursor. Save draft / Publish call createArticle | updateArticle.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import {
  Bold,
  Heading,
  Highlighter,
  Info,
  Image as ImageIcon,
  Rows3,
  Play,
  Box,
  Loader2,
} from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import {
  createArticle,
  updateArticle,
  uploadArticleImage,
  type Article,
} from '@/lib/article-api';
import { ClearButton } from '@/components/ClearButton';
// Preview reuses the reader's .article-page / .article-content typography so preview == reader.
import '@/app/[lang]/article/article.css';
import '@/app/[lang]/article/editor.css';

// CodeMirror chunk stays out of the server / SSG bundle. ssr:false → only mounts client-side.
const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), {
  ssr: false,
  loading: () => <div className="article-editor-cm-loading" />,
});
// markdown() returns a CM Extension; loaded lazily alongside the editor.
const markdownExt = () =>
  import('@codemirror/lang-markdown').then((m) => [m.markdown()]);

// Mirrors the backend slug regex (SPEC §2): lowercase alnum groups joined by single hyphens.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-') // non-ascii-alnum → hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, 200);
}

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

export interface ArticleEditorProps {
  mode: 'create' | 'edit';
  initial?: {
    slug: string;
    title: string;
    subtitle?: string;
    body: string;
    publishedAt?: string | null;
  };
  onSaved?: (slug: string) => void;
}

export default function ArticleEditor({ mode, initial, onSaved }: ArticleEditorProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const tt = (zh: string, en: string) => (isZh ? zh : en);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  // Auto-suggest slug from title until the author edits it (create only).
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');

  const [saving, setSaving] = useState<false | 'draft' | 'publish'>(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const viewRef = useRef<EditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cmExtensions, setCmExtensions] = useState<unknown[]>([]);

  // Load the markdown language extension once the editor is in play.
  useEffect(() => {
    let alive = true;
    markdownExt().then((ext) => {
      if (alive) setCmExtensions(ext);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Keep slug in sync with title until the author takes over the slug field (create mode).
  useEffect(() => {
    if (mode === 'create' && !slugTouched) setSlug(slugify(title));
  }, [title, slugTouched, mode]);

  const slugValid = slug.length > 0 && slug.length <= 200 && SLUG_RE.test(slug);
  const slugError = slug.length > 0 && !slugValid;

  // ── live preview (one sanitizer of record) ──────────────────────────────────
  const preview = useMemo(() => renderArticleMarkdown(body), [body]);

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
      setBody(view.state.doc.toString());
    },
    [],
  );

  // Wrap selection with prefix/suffix; if empty, place cursor between and select placeholder.
  const wrap = useCallback(
    (prefix: string, suffix: string, placeholder: string) => {
      dispatchReplace((sel) => {
        const inner = sel || placeholder;
        const insert = prefix + inner + suffix;
        // Select the inner text so the author can type over the placeholder.
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
      setBody(view.state.doc.toString());
    },
    [],
  );

  const insertImageMarkdown = useCallback(
    (url: string, alt: string) => {
      dispatchReplace(() => {
        const md = `![${alt}](${url})`;
        return { insert: md };
      });
    },
    [dispatchReplace],
  );

  // ── image upload (button / drop / paste) ────────────────────────────────────
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => ACCEPTED_IMAGE.test(f.type));
      if (list.length === 0) {
        if (Array.from(files).length > 0)
          setError(tt('仅支持 PNG / JPEG / WebP 图片', 'Only PNG / JPEG / WebP images'));
        return;
      }
      setError(null);
      setUploading(true);
      try {
        for (const file of list) {
          const { dataB64, mime } = await fileToBase64(file);
          const img = await uploadArticleImage(dataB64, mime);
          const alt = file.name.replace(/\.[^.]+$/, '');
          insertImageMarkdown(img?.url ?? '', alt);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setUploading(false);
      }
    },
    [insertImageMarkdown, tt],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (const it of Array.from(items)) {
        if (it.kind === 'file' && ACCEPTED_IMAGE.test(it.type)) {
          const f = it.getAsFile();
          if (f) imgs.push(f);
        }
      }
      if (imgs.length > 0) {
        e.preventDefault();
        void handleFiles(imgs);
      }
    },
    [handleFiles],
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

  // ── save ─────────────────────────────────────────────────────────────────────
  const canSave = title.trim().length > 0 && slugValid && body.trim().length > 0 && !saving;

  const save = useCallback(
    async (publish: boolean) => {
      if (!canSave) return;
      setError(null);
      setSaving(publish ? 'publish' : 'draft');
      try {
        let result: Article;
        if (mode === 'create') {
          result = await createArticle({
            slug,
            title: title.trim(),
            subtitle: subtitle.trim() || undefined,
            body,
            publish,
          });
        } else {
          result = await updateArticle(initial?.slug ?? slug, {
            slug,
            title: title.trim(),
            subtitle: subtitle.trim() || undefined,
            body,
            publish,
          });
        }
        onSaved?.(result?.slug ?? slug);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    },
    [canSave, mode, slug, title, subtitle, body, initial?.slug, onSaved],
  );

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined') window.history.back();
  }, []);

  const toolbarBtn = (
    key: string,
    label: string,
    Icon: typeof Bold,
    onClick: () => void,
  ) => (
    <button
      key={key}
      type="button"
      className="article-editor-tool"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="article-editor">
      {/* ── metadata fields ── */}
      <div className="article-editor-meta">
        <div className="article-editor-field">
          <label className="article-editor-label">{tt('标题', 'Title')}</label>
          <div className="article-editor-input-wrap">
            <input
              className="article-editor-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tt('文章标题', 'Article title')}
            />
            {title && (
              <ClearButton onClick={() => setTitle('')} isZh={isZh} preserveFocus />
            )}
          </div>
        </div>

        <div className="article-editor-field">
          <label className="article-editor-label">{tt('副标题', 'Subtitle')}</label>
          <div className="article-editor-input-wrap">
            <input
              className="article-editor-input"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={tt('可选', 'Optional')}
            />
            {subtitle && (
              <ClearButton onClick={() => setSubtitle('')} isZh={isZh} preserveFocus />
            )}
          </div>
        </div>

        <div className="article-editor-field">
          <label className="article-editor-label">{tt('链接名 (slug)', 'Slug')}</label>
          <div className="article-editor-input-wrap">
            <input
              className={
                'article-editor-input article-editor-slug' +
                (slugError ? ' article-editor-input-error' : '')
              }
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="my-article"
              spellCheck={false}
            />
            {slug && (
              <ClearButton
                onClick={() => {
                  setSlug('');
                  setSlugTouched(true);
                }}
                isZh={isZh}
                preserveFocus
              />
            )}
          </div>
          {slugError && (
            <div className="article-editor-hint article-editor-hint-error">
              {tt(
                '只能用小写字母、数字、连字符,如 my-article',
                'Lowercase letters, digits, hyphens only, e.g. my-article',
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── toolbar ── */}
      <div className="article-editor-toolbar">
        {toolbarBtn('bold', tt('加粗', 'Bold'), Bold, () => wrap('**', '**', tt('粗体', 'bold')))}
        {toolbarBtn('heading', tt('小标题', 'Heading'), Heading, () =>
          insertBlock('## ', [3, 3]),
        )}
        {toolbarBtn('red', tt('标红 (重点)', 'Red (key point)'), Highlighter, () =>
          wrap(':red[', ']', tt('重点', 'key point')),
        )}
        {toolbarBtn('blue', tt('标蓝 (背景知识)', 'Blue (background)'), Info, () =>
          wrap(':blue[', ']', tt('背景知识', 'background')),
        )}
        {toolbarBtn('figrow', tt('图网格', 'Figure grid'), Rows3, () =>
          insertBlock(':::figrow\n\n![](url1)\n![](url2)\n\n:::\n'),
        )}
        {toolbarBtn('alg', tt('活动画 (alg)', 'Alg player'), Play, () =>
          wrap(':alg[', "]{puzzle=3x3x3}", "R U R' U'"),
        )}
        {toolbarBtn('cube', tt('魔方图', 'Cube image'), Box, () =>
          wrap(':cube[', ']{view=oll}', ''),
        )}
        <span className="article-editor-tool-sep" aria-hidden="true" />
        <button
          type="button"
          className="article-editor-tool"
          title={tt('插入图片', 'Insert image')}
          aria-label={tt('插入图片', 'Insert image')}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 size={16} className="article-editor-spin" />
          ) : (
            <ImageIcon size={16} />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* ── split pane: source | preview ── */}
      <div className="article-editor-split">
        <div
          className={'article-editor-source' + (dragOver ? ' article-editor-source-drag' : '')}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onPaste={onPaste}
        >
          <CodeMirror
            value={body}
            theme="none"
            height="100%"
            placeholder={tt(
              '在这里写 markdown… 工具栏可插入标红 / 标蓝 / 活动画等',
              'Write markdown here… use the toolbar for highlights / alg players / images',
            )}
            extensions={cmExtensions as never}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
            onChange={(v) => setBody(v)}
            onCreateEditor={(view) => {
              viewRef.current = view;
            }}
          />
          {dragOver && (
            <div className="article-editor-drop-hint">
              {tt('松开上传图片', 'Drop to upload image')}
            </div>
          )}
        </div>

        <div className="article-editor-preview">
          <div className="article-page article-editor-preview-page">
            {title && <h1>{title}</h1>}
            {subtitle && <p className="article-subtitle">{subtitle}</p>}
            <div className="article-content">{preview}</div>
          </div>
        </div>
      </div>

      {/* ── error ── */}
      {error && <div className="article-editor-error">{error}</div>}

      {/* ── footer actions ── */}
      <div className="article-editor-footer">
        <button
          type="button"
          className="article-editor-action article-editor-action-ghost"
          onClick={cancel}
        >
          {tt('取消', 'Cancel')}
        </button>
        <div className="article-editor-footer-right">
          <button
            type="button"
            className="article-editor-action article-editor-action-secondary"
            onClick={() => save(false)}
            disabled={!canSave}
          >
            {saving === 'draft' && <Loader2 size={14} className="article-editor-spin" />}
            {tt('存草稿', 'Save draft')}
          </button>
          <button
            type="button"
            className="article-editor-action article-editor-action-primary"
            onClick={() => save(true)}
            disabled={!canSave}
          >
            {saving === 'publish' && <Loader2 size={14} className="article-editor-spin" />}
            {tt('发布', 'Publish')}
          </button>
        </div>
      </div>
    </div>
  );
}
