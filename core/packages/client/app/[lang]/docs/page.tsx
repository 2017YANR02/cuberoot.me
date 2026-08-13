'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { FilePlus2, FileText, Upload } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import WcaAuth from '@/components/WcaAuth';
import { T, tr, useLang } from '@/i18n/tr';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import {
  createDocument,
  fetchDocuments,
  importDocument,
  type CollaborativeDocument,
} from '@/lib/document-api';
import './docs.css';

function localDate(value: string, lang: 'en' | 'zh'): string {
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export default function DocumentsPage() {
  const lang = useLang();
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<CollaborativeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setDocuments(await fetchDocuments());
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const openCreated = (id: string) => {
    window.location.assign(`${lang === 'zh' ? '/zh' : ''}/docs/edit?id=${encodeURIComponent(id)}`);
  };

  const createBlank = async () => {
    setWorking(true);
    setError('');
    try {
      openCreated((await createDocument(tr({ zh: '无标题文档', en: 'Untitled document' }))).id);
    } catch (cause) {
      setError((cause as Error).message);
      setWorking(false);
    }
  };

  const importDocx = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setWorking(true);
    setError('');
    try {
      openCreated((await importDocument(file)).id);
    } catch (cause) {
      setError((cause as Error).message);
      setWorking(false);
    }
  };

  return (
    <main className="docs-page">
      <BackHome />
      <header className="docs-header">
        <div>
          <h1><T zh="协作文档" en="Collaborative docs" /></h1>
          <p><T zh="这里只显示你拥有或别人共享给你的文档。" en="Only documents you own or that others share with you appear here." /></p>
        </div>
        <div className="docs-header-actions">
          {isAdmin && (
            <>
              <button type="button" className="docs-button" onClick={createBlank} disabled={working}>
                <FilePlus2 size={17} aria-hidden="true" />
                <T zh="新建" en="New" />
              </button>
              <button type="button" className="docs-button docs-button-primary" onClick={() => inputRef.current?.click()} disabled={working}>
                <Upload size={17} aria-hidden="true" />
                <T zh="导入 Word" en="Import Word" />
              </button>
              <input ref={inputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={importDocx} />
            </>
          )}
          <WcaAuth />
        </div>
      </header>

      {error && <p className="docs-error" role="alert">{error}</p>}
      {!user && !loading && (
        <div className="docs-empty">
          <p><T zh="登录后才能查看别人与你共享的文档。" en="Sign in to see documents shared with you." /></p>
          <AppLink href="/account?next=/docs" prefetch={false} className="docs-text-link">
            <T zh="去登录" en="Sign in" />
          </AppLink>
        </div>
      )}
      {user && loading && <p className="docs-muted"><T zh="正在加载…" en="Loading…" /></p>}
      {user && !loading && documents.length === 0 && !error && (
        <div className="docs-empty">
          <FileText size={28} aria-hidden="true" />
          <p>{isAdmin
            ? <T zh="新建空白文档，或导入一个 .docx 文件。" en="Create a blank document or import a .docx file." />
            : <T zh="还没有与你共享的文档。" en="No documents have been shared with you yet." />}
          </p>
        </div>
      )}
      {documents.length > 0 && (
        <div className="docs-list">
          {documents.map((doc) => (
            <AppLink key={doc.id} href={`/docs/edit?id=${doc.id}`} prefetch={false} className="docs-row">
              <FileText size={21} aria-hidden="true" />
              <span className="docs-row-main">
                <strong>{doc.title}</strong>
                <span>{localDate(doc.updatedAt, lang)}</span>
              </span>
              <span className="docs-role">{tr({
                zh: doc.role === 'owner' ? '所有者' : doc.role === 'editor' ? '可编辑' : '只读',
                en: doc.role === 'owner' ? 'Owner' : doc.role === 'editor' ? 'Editor' : 'Viewer',
              })}</span>
            </AppLink>
          ))}
        </div>
      )}
    </main>
  );
}
