'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { ChevronLeft, Share2 } from 'lucide-react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import AppLink from '@/components/AppLink';
import { CollaborativeSharePanel } from '@/components/collaboration/CollaborativeSharePanel';
import WcaAuth from '@/components/WcaAuth';
import { T, tr } from '@/i18n/tr';
import { websocketApiUrl } from '@/lib/api-base';
import { getSessionToken, getWcaToken, useAuthUser } from '@/lib/auth-store';
import { fetchDocument, markDocumentSeen, updateDocumentSubscription, updateDocumentTitle, type DocumentDetails } from '@/lib/document-api';
import { CollaborativeDocumentEditor, type DocumentEditorSession } from './CollaborativeDocumentEditor';
import './editor.css';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
type EditorSession = DocumentEditorSession;

function websocketUrl(): string {
  return websocketApiUrl('/v1/documents/realtime');
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
    void markDocumentSeen(id).catch(() => undefined);
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

  const changeSubscription = async (subscribed: boolean) => {
    if (!details) return;
    try {
      const next = await updateDocumentSubscription(details.document.id, subscribed);
      setDetails({ ...details, subscription: next });
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    }
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
        {details?.canManage && <button type="button" className="docs-button" onClick={() => setShareOpen(true)}><Share2 size={16} /><span><T zh="共享" en="Share" /></span></button>}
        <WcaAuth />
      </header>
      {error && <p className="doc-page-error" role="alert">{error}</p>}
      {!user && !details && <div className="doc-auth-needed"><T zh="请先登录，再打开共享给你的文档。" en="Sign in to open a document shared with you." /></div>}
      {user && !details && !error && <p className="doc-editor-loading"><T zh="正在加载文档…" en="Loading document…" /></p>}
      {details && session && <CollaborativeDocumentEditor session={session} details={details} title={title} onError={setError}
        onShare={() => setShareOpen(true)} onSubscriptionChange={changeSubscription} />}
      {shareOpen && details && <CollaborativeSharePanel id={id} kind="document" details={details} reload={load} close={() => setShareOpen(false)} />}
    </main>
  );
}
