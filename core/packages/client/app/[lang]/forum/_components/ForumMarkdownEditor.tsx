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
 * uploadForumImage (base64 channel) via button / drag-drop / paste; the returned markdown image is
 * inserted at the cursor.
 *
 * Controlled value/onChange only — title, forum picker and submit stay in the page (/forum/new).
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Bold, Heading, Highlighter, Info, Image as ImageIcon, Rows3, Play, Box,
} from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import { Spinner } from '@/components/Spinner/Spinner';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { uploadForumImage } from '@/lib/forum-api';
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

export interface ForumEditorHandle {
  focus: () => void;
}

export const ForumMarkdownEditor = forwardRef<ForumEditorHandle, {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}>(function ForumMarkdownEditor({ value, onChange, placeholder }, ref) {
  const tt = useT();

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const viewRef = useRef<EditorView | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
          const img = await uploadForumImage(dataB64, mime);
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
    <div className="forum-editor" ref={rootRef}>
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
        <span className="forum-editor-tool-hint">{tt('支持 Markdown 与指令', 'Markdown + directives')}</span>
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
            <div className="forum-editor-drop-hint">{tt('松开上传图片', 'Drop to upload image')}</div>
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

      {error && <div className="forum-editor-error">{error}</div>}
    </div>
  );
});
