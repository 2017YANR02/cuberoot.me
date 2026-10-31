'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { FilePlus2, FileText, Sheet, Upload } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import WcaAuth from '@/components/WcaAuth';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { T, tr, useLang } from '@/i18n/tr';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { createDocument, fetchDocuments, importDocument, type CollaborativeDocument, type DocumentKind } from '@/lib/document-api';
import './docs.css';

const loadSpreadsheetImport = () => import('@/lib/spreadsheet-export');

export default function DocumentsPage() {
  const lang = useLang();
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<'all' | DocumentKind>('all');
  const [newKind, setNewKind] = useState<DocumentKind>('document');
  const [result, setResult] = useState<{ user: typeof user; documents: CollaborativeDocument[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError('');
    if (!user) { setLoading(false); return; }
    setLoading(true);
    void fetchDocuments('all').then((documents) => {
      if (!cancelled) setResult({ user, documents });
    }).catch((cause: Error) => {
      if (!cancelled) setError(cause.message);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  const openCreated = (id: string, kind: DocumentKind) => {
    window.location.assign(`${lang === 'zh' ? '/zh' : ''}/${kind === 'spreadsheet' ? 'sheets' : 'docs'}/edit?id=${encodeURIComponent(id)}`);
  };
  const createBlank = async () => {
    setWorking(true); setError('');
    try {
      const title = newKind === 'spreadsheet' ? tr({ zh: '无标题表格', en: 'Untitled spreadsheet' }) : tr({ zh: '无标题文档', en: 'Untitled document' });
      openCreated((await createDocument(title, newKind)).id, newKind);
    } catch (cause) { setError((cause as Error).message); setWorking(false); }
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setWorking(true); setError('');
    try {
      if (/\.docx$/i.test(file.name)) {
        openCreated((await importDocument(file)).id, 'document');
      } else if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        const { parseSpreadsheetFile } = await loadSpreadsheetImport();
        const sheets = await parseSpreadsheetFile(file);
        const title = file.name.replace(/\.(xlsx|xls|csv)$/i, '') || tr({ zh: '导入的表格', en: 'Imported spreadsheet' });
        openCreated((await createDocument(title, 'spreadsheet', { sheets })).id, 'spreadsheet');
      } else {
        throw new Error(tr({ zh: '请选择 Word、Excel 或 CSV 文件。', en: 'Choose a Word, Excel, or CSV file.' }));
      }
    } catch (cause) { setError((cause as Error).message); setWorking(false); }
  };
  const documents = result?.user === user ? result?.documents ?? [] : [];
  const visibleDocuments = documents.filter((doc) => filter === 'all' || doc.kind === filter);
  const dateFormat = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return <main className="docs-page">
    <header>
      <BackHome />
      <div className="docs-header">
        <h1><T zh="协作文档" en="Collaborative docs" /></h1>
        <div className="docs-header-actions">
          {isAdmin && <>
            <select className="docs-button" aria-label={tr({ zh: '新建类型', en: 'New file type' })} value={newKind} onChange={(event) => setNewKind(event.target.value as DocumentKind)} disabled={working}>
              <option value="document">{tr({ zh: '文档', en: 'Document' })}</option>
              <option value="spreadsheet">{tr({ zh: '表格', en: 'Spreadsheet' })}</option>
            </select>
            <button type="button" className="docs-button" onClick={() => void createBlank()} disabled={working}><FilePlus2 size={17} aria-hidden="true" /><T zh="新建" en="New" /></button>
            <button type="button" className="docs-button docs-button-primary" onClick={() => inputRef.current?.click()} disabled={working}><Upload size={17} aria-hidden="true" /><T zh="导入" en="Import" /></button>
            <input ref={inputRef} type="file" accept=".docx,.xlsx,.xls,.csv" hidden onChange={importFile} />
          </>}
          <WcaAuth />
        </div>
      </div>
    </header>
    {user && <div className="docs-header-actions docs-filters" role="group" aria-label={tr({ zh: '文件类型', en: 'File type' })}>
      {(['all', 'document', 'spreadsheet'] as const).map((kind) => <button key={kind} type="button" className={`docs-button${filter === kind ? ' docs-button-primary' : ''}`} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>
        {kind === 'all' ? <T zh="全部" en="All" /> : kind === 'document' ? <T zh="文档" en="Documents" /> : <T zh="表格" en="Spreadsheets" />}
      </button>)}
    </div>}
    {error && <p className="docs-error" role="alert">{error}</p>}
    {!user && !loading && <div className="docs-empty">
      <p><T zh="登录后查看你的文档和表格。" en="Sign in to view your documents and spreadsheets." /></p>
      <AppLink href="/account?next=/docs" prefetch={false} className="docs-text-link"><T zh="去登录" en="Sign in" /></AppLink>
    </div>}
    {user && loading && <p className="docs-muted"><LoadingIndicator><T zh="正在加载…" en="Loading…" /></LoadingIndicator></p>}
    {user && !loading && !error && visibleDocuments.length === 0 && <div className="docs-empty">
      <FileText size={28} aria-hidden="true" />
      <p><T zh="暂无文件。" en="No files yet." /></p>
    </div>}
    {user && !loading && !error && visibleDocuments.length > 0 && <div className="docs-list">
      {visibleDocuments.map((doc) => <AppLink key={doc.id} href={`/${doc.kind === 'spreadsheet' ? 'sheets' : 'docs'}/edit?id=${encodeURIComponent(doc.id)}`} prefetch={false} className="docs-row">
        <span role="img" aria-label={doc.kind === 'spreadsheet' ? tr({ zh: '表格', en: 'Spreadsheet' }) : tr({ zh: '文档', en: 'Document' })}>
          {doc.kind === 'spreadsheet' ? <Sheet size={21} aria-hidden="true" /> : <FileText size={21} aria-hidden="true" />}
        </span>
        <span className="docs-row-main"><strong>{doc.title}</strong><span>{dateFormat.format(new Date(doc.updatedAt))}</span></span>
        <span className="docs-role">{tr({ zh: doc.role === 'owner' ? '所有者' : doc.role === 'editor' ? '可编辑' : '只读', en: doc.role === 'owner' ? 'Owner' : doc.role === 'editor' ? 'Editor' : 'Viewer' })}</span>
      </AppLink>)}
    </div>}
  </main>;
}
