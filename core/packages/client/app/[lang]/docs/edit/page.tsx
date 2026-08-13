'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { Bold, ChevronLeft, FileDown, FileText, Heading2, Italic, List, ListOrdered, Quote, Redo2, Share2, Undo2 } from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import AppLink from '@/components/AppLink';
import { CollaborativeSharePanel } from '@/components/collaboration/CollaborativeSharePanel';
import WcaAuth from '@/components/WcaAuth';
import { T, tr } from '@/i18n/tr';
import { websocketApiUrl } from '@/lib/api-base';
import { getSessionToken, getWcaToken, useAuthUser } from '@/lib/auth-store';
import { fetchDocument, updateDocumentTitle, type DocumentDetails } from '@/lib/document-api';
import { exportDocumentDocx, exportDocumentPdf } from '@/lib/document-export';
import './editor.css';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
type EditorSession = { ydoc: Y.Doc; provider: HocuspocusProvider };

function websocketUrl(): string {
  return websocketApiUrl('/v1/documents/realtime');
}

function ToolbarButton({ active, disabled, label, onClick, children }: {
  active?: boolean; disabled?: boolean; label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" className={`doc-tool${active ? ' is-active' : ''}`} aria-label={label} title={label}
      aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>
  );
}

function CollaborativeEditor({ session, details, title, onError }: {
  session: EditorSession; details: DocumentDetails; title: string; onError: (message: string) => void;
}) {
  const user = useAuthUser();
  const readOnly = details.document.role === 'viewer';
  const [exporting, setExporting] = useState<'docx' | 'pdf' | ''>('');
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: session.ydoc }),
      CollaborationCaret.configure({
        provider: session.provider,
        user: { name: user?.name || user?.wcaId || tr({ zh: '协作者', en: 'Collaborator' }), color: 'var(--primary)' },
      }),
    ],
  }, [session, readOnly, user?.name, user?.wcaId]);

  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);
  if (!editor) return <p className="doc-editor-loading"><T zh="正在打开编辑器…" en="Opening editor…" /></p>;

  const exportFile = async (format: 'docx' | 'pdf') => {
    setExporting(format);
    onError('');
    try {
      if (format === 'docx') await exportDocumentDocx(title, editor.getJSON());
      else await exportDocumentPdf(title, editor.getJSON());
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : tr({ zh: '导出失败', en: 'Export failed' }));
    } finally {
      setExporting('');
    }
  };

  return (
    <>
      <div className="doc-toolbar" aria-label={tr({ zh: '格式工具栏', en: 'Formatting toolbar' })}>
        <ToolbarButton label={tr({ zh: '撤销', en: 'Undo' })} disabled={readOnly || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={17} /></ToolbarButton>
        <ToolbarButton label={tr({ zh: '重做', en: 'Redo' })} disabled={readOnly || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={17} /></ToolbarButton>
        <span className="doc-tool-separator" />
        <ToolbarButton label={tr({ zh: '粗体', en: 'Bold' })} active={editor.isActive('bold')} disabled={readOnly} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={17} /></ToolbarButton>
        <ToolbarButton label={tr({ zh: '斜体', en: 'Italic' })} active={editor.isActive('italic')} disabled={readOnly} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={17} /></ToolbarButton>
        <ToolbarButton label={tr({ zh: '二级标题', en: 'Heading 2' })} active={editor.isActive('heading', { level: 2 })} disabled={readOnly} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={17} /></ToolbarButton>
        <ToolbarButton label={tr({ zh: '项目符号列表', en: 'Bullet list' })} active={editor.isActive('bulletList')} disabled={readOnly} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={17} /></ToolbarButton>
        <ToolbarButton label={tr({ zh: '编号列表', en: 'Numbered list' })} active={editor.isActive('orderedList')} disabled={readOnly} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={17} /></ToolbarButton>
        <ToolbarButton label={tr({ zh: '引用', en: 'Quote' })} active={editor.isActive('blockquote')} disabled={readOnly} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={17} /></ToolbarButton>
        <span className="doc-tool-separator" />
        <button type="button" className="doc-tool doc-export-tool" disabled={Boolean(exporting)}
          onClick={() => void exportFile('docx')} title={tr({ zh: '导出 Word 文档', en: 'Export Word document' })}>
          <FileText size={16} /><span>{exporting === 'docx' ? <T zh="生成中" en="Exporting" /> : 'Word'}</span>
        </button>
        <button type="button" className="doc-tool doc-export-tool" disabled={Boolean(exporting)}
          onClick={() => void exportFile('pdf')} title={tr({ zh: '导出 PDF', en: 'Export PDF' })}>
          <FileDown size={16} /><span>{exporting === 'pdf' ? <T zh="生成中" en="Exporting" /> : 'PDF'}</span>
        </button>
        {readOnly && <span className="doc-readonly"><T zh="只读" en="Read only" /></span>}
      </div>
      <EditorContent editor={editor} className="doc-editor" />
    </>
  );
}

export default function DocumentEditorPage() {
  const [id] = useQueryState('id', parseAsString.withDefault(''));
  const user = useAuthUser();
  const [details, setDetails] = useState<DocumentDetails | null>(null);
  const [session, setSession] = useState<EditorSession | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [peopleOnline, setPeopleOnline] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id || !user) return;
    try {
      const next = await fetchDocument(id);
      if (next.document.kind !== 'document') throw new Error(tr({ zh: '这不是协作文档。', en: 'This resource is not a document.' }));
      setDetails(next); setTitle(next.document.title); setError('');
    }
    catch (cause) { setError((cause as Error).message); }
  }, [id, user]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!id || !details || !user) return;
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: websocketUrl(), name: `document.${id}`, document: ydoc,
      token: getSessionToken() || getWcaToken(),
      onStatus: ({ status: nextStatus }) => setStatus(nextStatus),
      onAuthenticationFailed: ({ reason }) => setError(reason || tr({ zh: '文档认证失败', en: 'Document authentication failed' })),
      onAwarenessChange: ({ states }) => {
        const names = states.map((state) => typeof state.user === 'object' && state.user && typeof state.user.name === 'string' ? state.user.name : '')
          .filter((name, index, all) => name && all.indexOf(name) === index);
        setPeopleOnline(names);
      },
    });
    setSession({ ydoc, provider });
    return () => { provider.destroy(); ydoc.destroy(); setSession(null); setPeopleOnline([]); };
  }, [id, details?.document.role, user]);

  const saveTitle = async () => {
    const cleaned = title.trim();
    if (!details?.canManage || !cleaned || cleaned === details.document.title) {
      if (!cleaned && details) setTitle(details.document.title);
      return;
    }
    try { await updateDocumentTitle(details.document.id, cleaned); setDetails({ ...details, document: { ...details.document, title: cleaned } }); }
    catch (cause) { setError((cause as Error).message); }
  };

  if (!id) return <main className="doc-workspace"><p className="docs-error"><T zh="缺少文档 ID。" en="Missing document ID." /></p></main>;
  return (
    <main className="doc-workspace">
      <header className="doc-topbar">
        <AppLink href="/docs" prefetch={false} className="doc-back" aria-label={tr({ zh: '返回文档列表', en: 'Back to documents' })}><ChevronLeft size={20} /></AppLink>
        <input className="doc-title-input" value={title} readOnly={!details?.canManage} onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void saveTitle()} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          aria-label={tr({ zh: '文档标题', en: 'Document title' })} />
        <div className={`doc-sync is-${status}`}><span aria-hidden="true" />
          {status === 'connected' ? <T zh="已同步" en="Synced" /> : status === 'connecting' ? <T zh="连接中" en="Connecting" /> : <T zh="离线，等待重连" en="Offline, retrying" />}
        </div>
        {peopleOnline.length > 0 && <span className="doc-presence" title={peopleOnline.join(', ')}>{peopleOnline.length}<T zh=" 人在线" en=" online" /></span>}
        {details?.canManage && <button type="button" className="docs-button" onClick={() => setShareOpen(true)}><Share2 size={16} /><T zh="共享" en="Share" /></button>}
        <WcaAuth />
      </header>
      {error && <p className="doc-page-error" role="alert">{error}</p>}
      {!user && !details && <div className="doc-auth-needed"><T zh="请先登录，再打开共享给你的文档。" en="Sign in to open a document shared with you." /></div>}
      {user && !details && !error && <p className="doc-editor-loading"><T zh="正在加载文档…" en="Loading document…" /></p>}
      {details && session && <CollaborativeEditor session={session} details={details} title={title} onError={setError} />}
      {shareOpen && details && <CollaborativeSharePanel id={id} kind="document" details={details} reload={load} close={() => setShareOpen(false)} />}
    </main>
  );
}
