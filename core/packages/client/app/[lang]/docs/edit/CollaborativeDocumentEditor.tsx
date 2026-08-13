'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bell, BellOff, Bold, Check, CheckSquare, Clock3,
  Highlighter, Image as ImageIcon, Italic, Link2, List, ListOrdered, MessageSquare,
  MessageSquarePlus, PanelRight, Pilcrow, Printer, Quote, Redo2, Search,
  Strikethrough, Table2, Underline as UnderlineIcon, Undo2,
} from 'lucide-react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import type { ProsemirrorBinding } from 'y-prosemirror';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { T, tr, useLang, type Lang } from '@/i18n/tr';
import { useAuthUser, useOwnerKey } from '@/lib/auth-store';
import {
  countDocumentText, createDocumentAnchor, mapValues, nextDocumentRecordId,
  resolveDocumentAnchor, sortByCreatedAt, type DocumentActivity, type DocumentComment,
  type DocumentMode, type DocumentSuggestion,
} from '@/lib/document-collaboration';
import type { DocumentDetails } from '@/lib/document-api';
import { exportDocumentDocx, exportDocumentPdf } from '@/lib/document-export';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

export type DocumentEditorSession = { ydoc: Y.Doc; provider: HocuspocusProvider };
type SideTab = 'comments' | 'suggestions' | 'activity';
type MenuName = 'file' | 'edit' | 'view' | 'insert' | 'format' | 'tools' | 'help';

function mappingFor(editor: Editor): ProsemirrorBinding['mapping'] | null {
  const syncPlugin = editor.state.plugins.find((plugin) => (plugin as { key?: string }).key?.startsWith('y-sync$'));
  const syncState = syncPlugin?.getState(editor.state) as { binding?: ProsemirrorBinding } | undefined;
  return syncState?.binding?.mapping ?? null;
}

function editorRanges(editor: Editor, query: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  if (!query) return ranges;
  editor.state.doc.descendants((node, position) => {
    if (!node.isText || !node.text) return;
    let offset = 0;
    while (offset <= node.text.length - query.length) {
      const index = node.text.indexOf(query, offset);
      if (index < 0) break;
      ranges.push({ from: position + index, to: position + index + query.length });
      offset = index + Math.max(1, query.length);
    }
  });
  return ranges;
}

function Tool({ label, disabled, active, onClick, children }: {
  label: string; disabled?: boolean; active?: boolean; onClick: () => void; children: ReactNode;
}) {
  return <button type="button" className={`doc-tool${active ? ' is-active' : ''}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
}

function MenuItem({ disabled, shortcut, onSelect, children }: {
  disabled?: boolean; shortcut?: string; onSelect: () => void; children: ReactNode;
}) {
  return <button type="button" className="doc-menu-item" disabled={disabled} onClick={onSelect}><span>{children}</span>{shortcut && <kbd>{shortcut}</kbd>}</button>;
}

function stamp(value: number, lang: Lang): string {
  return new Intl.DateTimeFormat({ zh: 'zh-CN', en: 'en-US' }[lang], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value);
}

export function CollaborativeDocumentEditor({ session, details, title, onError, onShare, onSubscriptionChange }: {
  session: DocumentEditorSession;
  details: DocumentDetails;
  title: string;
  onError: (message: string) => void;
  onShare: () => void;
  onSubscriptionChange: (subscribed: boolean) => Promise<void>;
}) {
  const user = useAuthUser();
  const lang = useLang();
  const ownerKey = useOwnerKey();
  const readOnly = details.document.role === 'viewer';
  const authorName = user?.name || user?.wcaId || tr({ zh: '协作者', en: 'Collaborator' });
  const [mode, setMode] = useState<DocumentMode>(readOnly ? 'view' : 'edit');
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [sideTab, setSideTab] = useState<SideTab>('comments');
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [suggestions, setSuggestions] = useState<DocumentSuggestion[]>([]);
  const [activities, setActivities] = useState<DocumentActivity[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [replacement, setReplacement] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyingTo, setReplyingTo] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [zoom, setZoom] = useState(100);
  const [widePage, setWidePage] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  usePanelClamp(Boolean(openMenu), menuRef);
  usePopoverDismiss(Boolean(openMenu), () => setOpenMenu(null), menuRef);

  const commentMap = useMemo(() => session.ydoc.getMap<DocumentComment>('documentComments'), [session]);
  const suggestionMap = useMemo(() => session.ydoc.getMap<DocumentSuggestion>('documentSuggestions'), [session]);
  const activityArray = useMemo(() => session.ydoc.getArray<DocumentActivity>('documentActivity'), [session]);

  const addActivity = useCallback((kind: DocumentActivity['kind'], summary: string) => {
    if (readOnly) return;
    activityArray.push([{ id: nextDocumentRecordId('activity'), authorKey: ownerKey, authorName, kind, summary, createdAt: Date.now() }]);
  }, [activityArray, authorName, ownerKey, readOnly]);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ undoRedo: false, link: { openOnClick: false, autolink: true } }),
      Highlight, Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: tr({ zh: '开始输入，或从工具栏插入内容…', en: 'Start typing, or insert content from the toolbar…' }) }),
      Subscript, Superscript, TableKit, TaskList, TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }), TextStyleKit,
      Collaboration.configure({ document: session.ydoc }),
      CollaborationCaret.configure({ provider: session.provider, user: { name: authorName, color: 'var(--primary)' } }),
    ],
  }, [session, readOnly, authorName]);

  useEffect(() => { editor?.setEditable(!readOnly && mode === 'edit'); }, [editor, mode, readOnly]);
  useEffect(() => {
    const refreshComments = () => setComments(sortByCreatedAt(mapValues(commentMap)));
    const refreshSuggestions = () => setSuggestions(sortByCreatedAt(mapValues(suggestionMap)));
    const refreshActivities = () => setActivities(sortByCreatedAt(activityArray.toArray()));
    refreshComments(); refreshSuggestions(); refreshActivities();
    commentMap.observe(refreshComments); suggestionMap.observe(refreshSuggestions); activityArray.observe(refreshActivities);
    return () => { commentMap.unobserve(refreshComments); suggestionMap.unobserve(refreshSuggestions); activityArray.unobserve(refreshActivities); };
  }, [activityArray, commentMap, suggestionMap]);
  useEffect(() => {
    if (!editor || readOnly) return;
    const onUpdate = () => {
      if (!editor.isFocused || mode !== 'edit') return;
      if (editTimer.current) clearTimeout(editTimer.current);
      editTimer.current = setTimeout(() => addActivity('edit', tr({ zh: '编辑了文档', en: 'Edited the document' })), 1800);
    };
    editor.on('update', onUpdate);
    return () => { editor.off('update', onUpdate); if (editTimer.current) clearTimeout(editTimer.current); };
  }, [addActivity, editor, mode, readOnly]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'h') { event.preventDefault(); setSearchOpen(true); }
      if (event.shiftKey && event.key.toLowerCase() === 'c') { event.preventDefault(); setStatsOpen(true); }
      if (event.altKey && event.key.toLowerCase() === 'm' && !readOnly) { event.preventDefault(); setSideTab('comments'); setSideOpen(true); }
      if (event.key === '/') { event.preventDefault(); setShortcutsOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);

  if (!editor) return <p className="doc-editor-loading"><T zh="正在打开编辑器…" en="Opening editor…" /></p>;
  const canEdit = !readOnly && mode === 'edit';
  const subscribed = details.subscription?.subscribed ?? false;
  const openComments = comments.filter((item) => !item.resolvedAt);
  const openSuggestions = suggestions.filter((item) => item.status === 'open');
  const selectedText = () => editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ');
  const openSide = (tab: SideTab) => { setSideTab(tab); setSideOpen(true); };
  const closeThen = (action: () => void) => () => { setOpenMenu(null); action(); };

  const download = async (format: 'docx' | 'pdf') => {
    setExporting(true); onError('');
    try { if (format === 'docx') await exportDocumentDocx(title, editor.getJSON()); else await exportDocumentPdf(title, editor.getJSON()); }
    catch (cause) { onError(cause instanceof Error ? cause.message : tr({ zh: '导出失败', en: 'Export failed' })); }
    finally { setExporting(false); }
  };
  const setLink = () => {
    const href = window.prompt(tr({ zh: '输入链接地址', en: 'Enter link URL' }), editor.getAttributes('link').href || 'https://');
    if (href === null) return;
    if (href.trim()) editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
    else editor.chain().focus().extendMarkRange('link').unsetLink().run();
  };
  const insertImage = () => {
    const src = window.prompt(tr({ zh: '输入图片地址', en: 'Enter image URL' }), 'https://');
    if (src?.trim()) editor.chain().focus().setImage({ src: src.trim() }).run();
  };
  const findNext = () => {
    const ranges = editorRanges(editor, searchText);
    const range = ranges.find((item) => item.from >= editor.state.selection.to) ?? ranges[0];
    if (range) editor.chain().focus().setTextSelection(range).run();
  };
  const replaceCurrent = () => {
    if (!canEdit || !searchText) return;
    if (selectedText() !== searchText) return findNext();
    editor.chain().focus().insertContent(replaceText).run(); findNext();
  };
  const replaceAll = () => {
    if (!canEdit || !searchText) return;
    const transaction = editor.state.tr;
    for (const range of editorRanges(editor, searchText).reverse()) transaction.insertText(replaceText, range.from, range.to);
    editor.view.dispatch(transaction);
  };
  const addComment = () => {
    const body = commentBody.trim(); if (!body || readOnly) return;
    const { from, to } = editor.state.selection; const mapping = mappingFor(editor); const quote = selectedText();
    const anchor = mapping && to > from ? createDocumentAnchor(session.ydoc.getXmlFragment('default'), mapping, from, to, quote) : null;
    const item: DocumentComment = { id: nextDocumentRecordId('comment'), authorKey: ownerKey, authorName, body, createdAt: Date.now(), resolvedAt: null, anchor, replies: [] };
    commentMap.set(item.id, item); addActivity('comment', tr({ zh: '添加了批注', en: 'Added a comment' })); setCommentBody('');
  };
  const reply = (comment: DocumentComment) => {
    const body = replyBody.trim(); if (!body || readOnly) return;
    commentMap.set(comment.id, { ...comment, replies: [...comment.replies, { id: nextDocumentRecordId('reply'), authorKey: ownerKey, authorName, body, createdAt: Date.now() }] });
    addActivity('reply', tr({ zh: '回复了批注', en: 'Replied to a comment' })); setReplyBody(''); setReplyingTo('');
  };
  const focusComment = (comment: DocumentComment) => {
    const mapping = mappingFor(editor); if (!comment.anchor || !mapping) return;
    const range = resolveDocumentAnchor(session.ydoc, session.ydoc.getXmlFragment('default'), mapping, comment.anchor);
    if (range) editor.chain().focus().setTextSelection(range).run();
  };
  const resolveComment = (comment: DocumentComment) => {
    if (readOnly) return; commentMap.set(comment.id, { ...comment, resolvedAt: Date.now() });
    addActivity('resolve', tr({ zh: '解决了批注', en: 'Resolved a comment' }));
  };
  const addSuggestion = () => {
    if (readOnly || !replacement.trim() && editor.state.selection.empty) return;
    const { from, to } = editor.state.selection; const mapping = mappingFor(editor); if (!mapping) return;
    const beforeText = selectedText(); const anchor = createDocumentAnchor(session.ydoc.getXmlFragment('default'), mapping, from, to, beforeText); if (!anchor) return;
    const item: DocumentSuggestion = {
      id: nextDocumentRecordId('suggestion'), authorKey: ownerKey, authorName, anchor, beforeText, replacement,
      summary: beforeText ? tr({ zh: `将“${beforeText.slice(0, 32)}”改为“${replacement.slice(0, 32)}”`, en: `Replace “${beforeText.slice(0, 32)}” with “${replacement.slice(0, 32)}”` }) : tr({ zh: `插入“${replacement.slice(0, 48)}”`, en: `Insert “${replacement.slice(0, 48)}”` }),
      createdAt: Date.now(), status: 'open',
    };
    suggestionMap.set(item.id, item); addActivity('suggestion', tr({ zh: '提出了修改建议', en: 'Proposed a change' })); setReplacement('');
  };
  const decideSuggestion = (item: DocumentSuggestion, accept: boolean) => {
    if (readOnly) return;
    if (accept) {
      const mapping = mappingFor(editor); const range = mapping ? resolveDocumentAnchor(session.ydoc, session.ydoc.getXmlFragment('default'), mapping, item.anchor) : null;
      if (!range) return onError(tr({ zh: '建议对应的位置已经不存在，请重新创建建议。', en: 'The suggested range no longer exists. Create a new suggestion.' }));
      if (editor.state.doc.textBetween(range.from, range.to, ' ') !== item.beforeText) return onError(tr({ zh: '原文已被其他人修改，为避免覆盖，本建议未应用。', en: 'The source text changed, so this suggestion was not applied.' }));
      if (item.replacement) editor.chain().focus().setTextSelection(range).insertContent(item.replacement).run(); else editor.chain().deleteRange(range).run();
    }
    suggestionMap.set(item.id, { ...item, status: accept ? 'accepted' : 'rejected' });
    addActivity(accept ? 'accept' : 'reject', accept ? tr({ zh: '接受了修改建议', en: 'Accepted a suggestion' }) : tr({ zh: '拒绝了修改建议', en: 'Rejected a suggestion' }));
  };

  const menuContent: Record<MenuName, ReactNode> = {
    file: <><AppLink href="/docs" prefetch={false} className="doc-menu-item"><span><T zh="打开文档列表" en="Open document list" /></span></AppLink>{details.canManage && <MenuItem onSelect={closeThen(onShare)}><T zh="共享" en="Share" /></MenuItem>}<div className="doc-menu-separator" /><MenuItem disabled={exporting} onSelect={closeThen(() => void download('docx'))}><T zh="下载 Word 文档" en="Download Word document" /></MenuItem><MenuItem disabled={exporting} onSelect={closeThen(() => void download('pdf'))}><T zh="下载 PDF" en="Download PDF" /></MenuItem><MenuItem shortcut="Ctrl+P" onSelect={closeThen(() => window.print())}><T zh="打印" en="Print" /></MenuItem></>,
    edit: <><MenuItem shortcut="Ctrl+Z" disabled={!canEdit || !editor.can().undo()} onSelect={closeThen(() => editor.chain().focus().undo().run())}><T zh="撤销" en="Undo" /></MenuItem><MenuItem shortcut="Ctrl+Y" disabled={!canEdit || !editor.can().redo()} onSelect={closeThen(() => editor.chain().focus().redo().run())}><T zh="重做" en="Redo" /></MenuItem><div className="doc-menu-separator" /><MenuItem shortcut="Ctrl+X" disabled={!canEdit} onSelect={closeThen(() => document.execCommand('cut'))}><T zh="剪切" en="Cut" /></MenuItem><MenuItem shortcut="Ctrl+C" onSelect={closeThen(() => document.execCommand('copy'))}><T zh="复制" en="Copy" /></MenuItem><MenuItem shortcut="Ctrl+A" onSelect={closeThen(() => editor.chain().focus().selectAll().run())}><T zh="全选" en="Select all" /></MenuItem><MenuItem shortcut="Ctrl+H" onSelect={closeThen(() => setSearchOpen(true))}><T zh="查找和替换" en="Find and replace" /></MenuItem></>,
    view: <><MenuItem disabled={readOnly} onSelect={closeThen(() => setMode('edit'))}>{mode === 'edit' && <Check size={14} />}<T zh="编辑模式" en="Editing mode" /></MenuItem><MenuItem disabled={readOnly} onSelect={closeThen(() => { setMode('suggest'); openSide('suggestions'); })}>{mode === 'suggest' && <Check size={14} />}<T zh="建议模式" en="Suggesting mode" /></MenuItem><MenuItem onSelect={closeThen(() => setMode('view'))}>{mode === 'view' && <Check size={14} />}<T zh="查看模式" en="Viewing mode" /></MenuItem><div className="doc-menu-separator" /><MenuItem onSelect={closeThen(() => openSide('comments'))}><T zh="批注" en="Comments" /></MenuItem><MenuItem onSelect={closeThen(() => openSide('activity'))}><T zh="修改记录" en="Activity" /></MenuItem><MenuItem onSelect={closeThen(() => setWidePage((value) => !value))}>{widePage && <Check size={14} />}<T zh="宽页面" en="Wide page" /></MenuItem><MenuItem onSelect={closeThen(() => document.fullscreenElement ? void document.exitFullscreen() : void document.querySelector('.doc-workspace')?.requestFullscreen())}><T zh="全屏" en="Full screen" /></MenuItem></>,
    insert: <><MenuItem disabled={!canEdit} onSelect={closeThen(setLink)}><T zh="链接" en="Link" /></MenuItem><MenuItem disabled={!canEdit} onSelect={closeThen(insertImage)}><T zh="图片" en="Image" /></MenuItem><MenuItem disabled={!canEdit} onSelect={closeThen(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}><T zh="3×3 表格" en="3×3 table" /></MenuItem><MenuItem disabled={!canEdit} onSelect={closeThen(() => editor.chain().focus().setHorizontalRule().run())}><T zh="分隔线" en="Horizontal line" /></MenuItem><MenuItem disabled={readOnly} shortcut="Ctrl+Alt+M" onSelect={closeThen(() => openSide('comments'))}><T zh="批注" en="Comment" /></MenuItem><MenuItem disabled={!canEdit} onSelect={closeThen(() => editor.chain().focus().toggleTaskList().run())}><T zh="任务清单" en="Checklist" /></MenuItem></>,
    format: <><MenuItem disabled={!canEdit} onSelect={closeThen(() => editor.chain().focus().setParagraph().run())}><T zh="普通文本" en="Normal text" /></MenuItem>{([1, 2, 3] as const).map((level) => <MenuItem key={level} disabled={!canEdit} onSelect={closeThen(() => editor.chain().focus().toggleHeading({ level }).run())}>{tr({ zh: `标题 ${level}`, en: `Heading ${level}` })}</MenuItem>)}<div className="doc-menu-separator" /><MenuItem disabled={!canEdit} shortcut="Ctrl+B" onSelect={closeThen(() => editor.chain().focus().toggleBold().run())}><T zh="粗体" en="Bold" /></MenuItem><MenuItem disabled={!canEdit} shortcut="Ctrl+I" onSelect={closeThen(() => editor.chain().focus().toggleItalic().run())}><T zh="斜体" en="Italic" /></MenuItem><MenuItem disabled={!canEdit} shortcut="Ctrl+U" onSelect={closeThen(() => editor.chain().focus().toggleUnderline().run())}><T zh="下划线" en="Underline" /></MenuItem><MenuItem disabled={!canEdit} onSelect={closeThen(() => editor.chain().focus().toggleStrike().run())}><T zh="删除线" en="Strikethrough" /></MenuItem><MenuItem disabled={!canEdit} onSelect={closeThen(() => editor.chain().focus().toggleSubscript().run())}><T zh="下标" en="Subscript" /></MenuItem><MenuItem disabled={!canEdit} onSelect={closeThen(() => editor.chain().focus().toggleSuperscript().run())}><T zh="上标" en="Superscript" /></MenuItem><MenuItem disabled={!canEdit} onSelect={closeThen(() => editor.chain().focus().toggleHighlight().run())}><T zh="高亮" en="Highlight" /></MenuItem><div className="doc-menu-separator" /><MenuItem disabled={!canEdit} onSelect={closeThen(() => editor.chain().focus().unsetAllMarks().clearNodes().run())}><T zh="清除格式" en="Clear formatting" /></MenuItem></>,
    tools: <><MenuItem shortcut="Ctrl+Shift+C" onSelect={closeThen(() => setStatsOpen(true))}><T zh="字数统计" en="Word count" /></MenuItem><MenuItem disabled={readOnly} onSelect={closeThen(() => { setMode('suggest'); openSide('suggestions'); })}><T zh="提出修改建议" en="Propose a change" /></MenuItem><MenuItem onSelect={closeThen(() => void onSubscriptionChange(!subscribed))}>{subscribed ? <T zh="取消关注修改" en="Stop following changes" /> : <T zh="关注修改" en="Follow changes" />}</MenuItem></>,
    help: <><MenuItem shortcut="Ctrl+/" onSelect={closeThen(() => setShortcutsOpen(true))}><T zh="键盘快捷键" en="Keyboard shortcuts" /></MenuItem><AppLink href="/docs" prefetch={false} className="doc-menu-item"><span><T zh="文档帮助" en="Documents help" /></span></AppLink></>,
  };
  const menuLabels: Record<MenuName, ReactNode> = { file: <T zh="文件" en="File" />, edit: <T zh="编辑" en="Edit" />, view: <T zh="查看" en="View" />, insert: <T zh="插入" en="Insert" />, format: <T zh="格式" en="Format" />, tools: <T zh="工具" en="Tools" />, help: <T zh="帮助" en="Help" /> };

  return <>
    <div className="doc-commandbar">
      <nav className="doc-menubar" aria-label={tr({ zh: '文档菜单', en: 'Document menus' })}>
        {(Object.keys(menuLabels) as MenuName[]).map((name) => <div className="doc-menu-wrap" key={name}><button type="button" className={`doc-menu-trigger${openMenu === name ? ' is-open' : ''}`} aria-expanded={openMenu === name} onClick={() => setOpenMenu((current) => current === name ? null : name)}>{menuLabels[name]}</button>{openMenu === name && <div ref={menuRef} className="doc-menu-panel">{menuContent[name]}</div>}</div>)}
      </nav>
      <div className="doc-command-actions"><button type="button" className="doc-follow-button" onClick={() => void onSubscriptionChange(!subscribed)}>{subscribed ? <Bell size={16} /> : <BellOff size={16} />}{subscribed ? <T zh="已关注" en="Following" /> : <T zh="关注修改" en="Follow" />}</button><select className="doc-mode-select" value={mode} disabled={readOnly} onChange={(event) => { const next = event.target.value as DocumentMode; setMode(next); if (next === 'suggest') openSide('suggestions'); }} aria-label={tr({ zh: '编辑模式', en: 'Editing mode' })}><option value="edit">{tr({ zh: '编辑', en: 'Editing' })}</option><option value="suggest">{tr({ zh: '建议', en: 'Suggesting' })}</option><option value="view">{tr({ zh: '查看', en: 'Viewing' })}</option></select></div>
    </div>
    <div className="doc-toolbar" aria-label={tr({ zh: '格式工具栏', en: 'Formatting toolbar' })}>
      <Tool label={tr({ zh: '打印', en: 'Print' })} onClick={() => window.print()}><Printer size={17} /></Tool><Tool label={tr({ zh: '撤销', en: 'Undo' })} disabled={!canEdit || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={17} /></Tool><Tool label={tr({ zh: '重做', en: 'Redo' })} disabled={!canEdit || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={17} /></Tool><span className="doc-tool-separator" />
      <select className="doc-toolbar-select doc-zoom-select" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label={tr({ zh: '缩放', en: 'Zoom' })}>{[80, 100, 120, 140].map((value) => <option key={value}>{value}</option>)}</select>
      <select className="doc-toolbar-select" disabled={!canEdit} value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'} onChange={(event) => event.target.value === 'p' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(event.target.value.slice(1)) as 1 | 2 | 3 }).run()} aria-label={tr({ zh: '段落样式', en: 'Paragraph style' })}><option value="p">{tr({ zh: '普通文本', en: 'Normal text' })}</option><option value="h1">{tr({ zh: '标题 1', en: 'Heading 1' })}</option><option value="h2">{tr({ zh: '标题 2', en: 'Heading 2' })}</option><option value="h3">{tr({ zh: '标题 3', en: 'Heading 3' })}</option></select><span className="doc-tool-separator" />
      <select className="doc-toolbar-select doc-font-select" disabled={!canEdit} value={editor.getAttributes('textStyle').fontFamily || ''} onChange={(event) => event.target.value ? editor.chain().focus().setFontFamily(event.target.value).run() : editor.chain().focus().unsetFontFamily().run()} aria-label={tr({ zh: '字体', en: 'Font' })}><option value="">{tr({ zh: '默认字体', en: 'Default font' })}</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="'Courier New'">Courier New</option></select>
      <select className="doc-toolbar-select doc-size-select" disabled={!canEdit} value={editor.getAttributes('textStyle').fontSize || ''} onChange={(event) => event.target.value ? editor.chain().focus().setFontSize(event.target.value).run() : editor.chain().focus().unsetFontSize().run()} aria-label={tr({ zh: '字号', en: 'Font size' })}><option value="">11</option>{[10, 12, 14, 16, 18, 24, 32].map((value) => <option key={value} value={`${value}px`}>{value}</option>)}</select>
      <label className="doc-color-tool" title={tr({ zh: '文字颜色', en: 'Text color' })}><span>A</span><input className="doc-color-input" type="color" disabled={!canEdit} value={editor.getAttributes('textStyle').color || '#111111'} onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} aria-label={tr({ zh: '文字颜色', en: 'Text color' })} /></label><span className="doc-tool-separator" />
      <Tool label={tr({ zh: '粗体', en: 'Bold' })} active={editor.isActive('bold')} disabled={!canEdit} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={17} /></Tool><Tool label={tr({ zh: '斜体', en: 'Italic' })} active={editor.isActive('italic')} disabled={!canEdit} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={17} /></Tool><Tool label={tr({ zh: '下划线', en: 'Underline' })} active={editor.isActive('underline')} disabled={!canEdit} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={17} /></Tool><Tool label={tr({ zh: '删除线', en: 'Strikethrough' })} active={editor.isActive('strike')} disabled={!canEdit} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={17} /></Tool><Tool label={tr({ zh: '高亮', en: 'Highlight' })} active={editor.isActive('highlight')} disabled={!canEdit} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter size={17} /></Tool><span className="doc-tool-separator" />
      <Tool label={tr({ zh: '链接', en: 'Link' })} disabled={!canEdit} active={editor.isActive('link')} onClick={setLink}><Link2 size={17} /></Tool><Tool label={tr({ zh: '批注', en: 'Comment' })} disabled={readOnly} onClick={() => openSide('comments')}><MessageSquarePlus size={17} /></Tool><Tool label={tr({ zh: '图片', en: 'Image' })} disabled={!canEdit} onClick={insertImage}><ImageIcon size={17} /></Tool><Tool label={tr({ zh: '表格', en: 'Table' })} disabled={!canEdit} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={17} /></Tool><span className="doc-tool-separator" />
      <Tool label={tr({ zh: '左对齐', en: 'Align left' })} disabled={!canEdit} active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={17} /></Tool><Tool label={tr({ zh: '居中', en: 'Align center' })} disabled={!canEdit} active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={17} /></Tool><Tool label={tr({ zh: '右对齐', en: 'Align right' })} disabled={!canEdit} active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={17} /></Tool><Tool label={tr({ zh: '项目符号列表', en: 'Bullet list' })} disabled={!canEdit} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={17} /></Tool><Tool label={tr({ zh: '编号列表', en: 'Numbered list' })} disabled={!canEdit} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={17} /></Tool><Tool label={tr({ zh: '任务清单', en: 'Checklist' })} disabled={!canEdit} active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}><CheckSquare size={17} /></Tool><Tool label={tr({ zh: '引用', en: 'Quote' })} disabled={!canEdit} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={17} /></Tool><span className="doc-tool-separator" /><Tool label={tr({ zh: '查找和替换', en: 'Find and replace' })} active={searchOpen} onClick={() => setSearchOpen((value) => !value)}><Search size={17} /></Tool><Tool label={tr({ zh: '协作侧栏', en: 'Collaboration sidebar' })} active={sideOpen} onClick={() => setSideOpen((value) => !value)}><PanelRight size={17} /></Tool>
    </div>
    {searchOpen && <div className="doc-searchbar"><Search size={16} /><input className="doc-search-input" value={searchText} onChange={(event) => setSearchText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') findNext(); }} placeholder={tr({ zh: '查找', en: 'Find' })} autoFocus /><input className="doc-search-input" value={replaceText} onChange={(event) => setReplaceText(event.target.value)} placeholder={tr({ zh: '替换为', en: 'Replace with' })} /><button className="doc-search-action" type="button" onClick={findNext}><T zh="下一个" en="Next" /></button><button className="doc-search-action" type="button" disabled={!canEdit} onClick={replaceCurrent}><T zh="替换" en="Replace" /></button><button className="doc-search-action" type="button" disabled={!canEdit} onClick={replaceAll}><T zh="全部替换" en="Replace all" /></button><ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭查找', en: 'Close find' })} onClick={() => setSearchOpen(false)} /></div>}
    {mode === 'suggest' && !readOnly && <p className="doc-mode-notice"><MessageSquare size={16} /><T zh="建议模式不会直接改正文。选择文字或放置光标后，在建议侧栏提交替换内容。" en="Suggesting mode does not edit directly. Select text or place the cursor, then submit a replacement in the sidebar." /></p>}
    <div className={`doc-canvas-row${sideOpen ? ' has-sidebar' : ''}${widePage ? ' is-wide' : ''}`}><EditorContent editor={editor} className="doc-editor" style={{ '--doc-zoom': zoom / 100 } as CSSProperties} />{sideOpen && <aside className="doc-sidebar">
      <div className="doc-side-head"><div className="doc-side-tabs" role="tablist"><button className="doc-side-tab" type="button" role="tab" aria-label={tr({ zh: '批注', en: 'Comments' })} aria-selected={sideTab === 'comments'} onClick={() => setSideTab('comments')}><MessageSquare size={16} /><span>{openComments.length}</span></button><button className="doc-side-tab" type="button" role="tab" aria-label={tr({ zh: '建议', en: 'Suggestions' })} aria-selected={sideTab === 'suggestions'} onClick={() => setSideTab('suggestions')}><Pilcrow size={16} /><span>{openSuggestions.length}</span></button><button className="doc-side-tab" type="button" role="tab" aria-label={tr({ zh: '修改记录', en: 'Activity' })} aria-selected={sideTab === 'activity'} onClick={() => setSideTab('activity')}><Clock3 size={16} /></button></div><ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭侧栏', en: 'Close sidebar' })} onClick={() => setSideOpen(false)} /></div>
      {sideTab === 'comments' && <div className="doc-side-content"><h2><T zh="批注" en="Comments" /></h2>{!readOnly && <div className="doc-side-composer">{selectedText() && <blockquote>{selectedText().slice(0, 160)}</blockquote>}<textarea className="doc-comment-input" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder={tr({ zh: '添加批注', en: 'Add a comment' })} /><button className="doc-comment-submit" type="button" disabled={!commentBody.trim()} onClick={addComment}><T zh="批注" en="Comment" /></button></div>}{!openComments.length && <p className="doc-side-empty"><T zh="没有未解决的批注。" en="No unresolved comments." /></p>}{openComments.map((comment) => <article className="doc-comment" key={comment.id}><button type="button" className="doc-comment-focus" disabled={!comment.anchor} onClick={() => focusComment(comment)}><strong>{comment.authorName}</strong><time>{stamp(comment.createdAt, lang)}</time>{comment.anchor?.quote && <blockquote>{comment.anchor.quote}</blockquote>}</button><p>{comment.body}</p>{comment.replies.map((item) => <div className="doc-reply" key={item.id}><strong>{item.authorName}</strong><time>{stamp(item.createdAt, lang)}</time><p>{item.body}</p></div>)}{!readOnly && <div className="doc-comment-actions"><button className="doc-comment-action" type="button" onClick={() => setReplyingTo(comment.id)}><T zh="回复" en="Reply" /></button><button className="doc-comment-action" type="button" onClick={() => resolveComment(comment)}><T zh="解决" en="Resolve" /></button></div>}{replyingTo === comment.id && <div className="doc-reply-composer"><textarea className="doc-comment-input" value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder={tr({ zh: '回复批注', en: 'Reply to comment' })} /><button className="doc-comment-submit" type="button" disabled={!replyBody.trim()} onClick={() => reply(comment)}><T zh="发送" en="Send" /></button></div>}</article>)}</div>}
      {sideTab === 'suggestions' && <div className="doc-side-content"><h2><T zh="修改建议" en="Suggestions" /></h2>{!readOnly && <div className="doc-side-composer"><p className="doc-composer-hint"><T zh="选择文字可建议替换；只放置光标可建议插入。" en="Select text to suggest a replacement, or place the cursor to suggest an insertion." /></p>{selectedText() && <blockquote>{selectedText().slice(0, 160)}</blockquote>}<textarea className="doc-comment-input" value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder={tr({ zh: '建议的新内容；留空可建议删除所选文字', en: 'Suggested replacement; leave empty to suggest deleting the selection' })} /><button className="doc-comment-submit" type="button" disabled={!replacement.trim() && editor.state.selection.empty} onClick={addSuggestion}><T zh="提交建议" en="Submit suggestion" /></button></div>}{!openSuggestions.length && <p className="doc-side-empty"><T zh="没有待处理的建议。" en="No open suggestions." /></p>}{openSuggestions.map((item) => <article className="doc-suggestion" key={item.id}><strong>{item.authorName}</strong><time>{stamp(item.createdAt, lang)}</time>{item.beforeText && <p className="doc-suggestion-before">− {item.beforeText}</p>}{item.replacement && <p className="doc-suggestion-after">+ {item.replacement}</p>}{!readOnly && <div className="doc-suggestion-actions"><button className="doc-suggestion-action" type="button" onClick={() => decideSuggestion(item, false)}><T zh="拒绝" en="Reject" /></button><button className="doc-suggestion-action" type="button" onClick={() => decideSuggestion(item, true)}><T zh="接受" en="Accept" /></button></div>}</article>)}</div>}
      {sideTab === 'activity' && <div className="doc-side-content"><h2><T zh="修改记录" en="Activity" /></h2>{!activities.length && <p className="doc-side-empty"><T zh="还没有协作记录。" en="No collaboration activity yet." /></p>}<ol className="doc-activity-list">{activities.slice(0, 100).map((item) => <li key={item.id}><span /><div><strong>{item.authorName}</strong><p>{item.summary}</p><time>{stamp(item.createdAt, lang)}</time></div></li>)}</ol></div>}
    </aside>}</div>
    {statsOpen && <div className="doc-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setStatsOpen(false); }}><section className="doc-dialog" role="dialog" aria-modal="true"><ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={() => setStatsOpen(false)} /><h2><T zh="字数统计" en="Word count" /></h2><dl><div><dt><T zh="字词" en="Words" /></dt><dd>{countDocumentText(editor.getText()).words}</dd></div><div><dt><T zh="字符" en="Characters" /></dt><dd>{countDocumentText(editor.getText()).characters}</dd></div></dl></section></div>}
    {shortcutsOpen && <div className="doc-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShortcutsOpen(false); }}><section className="doc-dialog" role="dialog" aria-modal="true"><ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={() => setShortcutsOpen(false)} /><h2><T zh="键盘快捷键" en="Keyboard shortcuts" /></h2><dl><div><dt><T zh="查找和替换" en="Find and replace" /></dt><dd>Ctrl+H</dd></div><div><dt><T zh="添加批注" en="Add comment" /></dt><dd>Ctrl+Alt+M</dd></div><div><dt><T zh="字数统计" en="Word count" /></dt><dd>Ctrl+Shift+C</dd></div></dl></section></div>}
  </>;
}
