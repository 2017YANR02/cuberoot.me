'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { FilePlus2, Sheet, Upload } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import WcaAuth from '@/components/WcaAuth';
import { T, tr, useLang } from '@/i18n/tr';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { createDocument, fetchDocuments, type CollaborativeDocument } from '@/lib/document-api';
import { parseSpreadsheetFile } from '@/lib/spreadsheet-export';
import '../docs/docs.css';

function localDate(value: string, lang: 'en' | 'zh'): string {
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export default function SpreadsheetsPage() {
  const lang = useLang();
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<CollaborativeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true); setError('');
    try { setDocuments(await fetchDocuments('spreadsheet')); }
    catch (cause) { setError((cause as Error).message); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const openCreated = (id: string) => window.location.assign(`${lang === 'zh' ? '/zh' : ''}/sheets/edit?id=${encodeURIComponent(id)}`);
  const createBlank = async () => {
    setWorking(true); setError('');
    try { openCreated((await createDocument(tr({ zh: '无标题表格', en: 'Untitled spreadsheet' }), 'spreadsheet')).id); }
    catch (cause) { setError((cause as Error).message); setWorking(false); }
  };
  const importXlsx = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setWorking(true); setError('');
    try {
      const sheets = await parseSpreadsheetFile(file);
      const title = file.name.replace(/\.(xlsx|xls|csv)$/i, '') || tr({ zh: '导入的表格', en: 'Imported spreadsheet' });
      openCreated((await createDocument(title, 'spreadsheet', { sheets })).id);
    } catch (cause) { setError((cause as Error).message); setWorking(false); }
  };

  return <main className="docs-page">
    <BackHome />
    <header className="docs-header">
      <div><h1><T zh="协作表格" en="Collaborative sheets" /></h1><p><T zh="这里只显示你拥有或别人共享给你的表格。" en="Only spreadsheets you own or that others share with you appear here." /></p></div>
      <div className="docs-header-actions">
        {isAdmin && <>
          <button type="button" className="docs-button" onClick={() => void createBlank()} disabled={working}><FilePlus2 size={17} /><T zh="新建" en="New" /></button>
          <button type="button" className="docs-button docs-button-primary" onClick={() => inputRef.current?.click()} disabled={working}><Upload size={17} /><T zh="导入 Excel" en="Import Excel" /></button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden onChange={(event) => void importXlsx(event)} />
        </>}
        <WcaAuth />
      </div>
    </header>
    {error && <p className="docs-error" role="alert">{error}</p>}
    {!user && !loading && <div className="docs-empty"><p><T zh="登录后才能查看别人与你共享的表格。" en="Sign in to see spreadsheets shared with you." /></p><AppLink href="/account?next=/sheets" prefetch={false} className="docs-text-link"><T zh="去登录" en="Sign in" /></AppLink></div>}
    {user && loading && <p className="docs-muted"><T zh="正在加载…" en="Loading…" /></p>}
    {user && !loading && documents.length === 0 && !error && <div className="docs-empty"><Sheet size={28} /><p>{isAdmin ? <T zh="新建空白表格，或导入 Excel / CSV 文件。" en="Create a blank sheet or import an Excel / CSV file." /> : <T zh="还没有与你共享的表格。" en="No spreadsheets have been shared with you yet." />}</p></div>}
    {documents.length > 0 && <div className="docs-list">{documents.map((document) => <AppLink key={document.id} href={`/sheets/edit?id=${encodeURIComponent(document.id)}`} prefetch={false} className="docs-row"><Sheet size={20} /><span className="docs-row-main"><strong>{document.title}</strong><span>{localDate(document.updatedAt, lang)}</span></span><span className="docs-role">{document.role === 'owner' ? <T zh="所有者" en="Owner" /> : document.role === 'editor' ? <T zh="可编辑" en="Editor" /> : <T zh="只读" en="Viewer" />}</span></AppLink>)}</div>}
  </main>;
}
