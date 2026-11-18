'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ErrorNotice, Field, useResource, RequestError } from '@app-foundation/workspace-ui';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';
import { WorkspaceButton as Button, WorkspaceDialog } from './WorkspaceControls';

const ContractDrafts = dynamic(() => import('./ContractDrafts'));

type Revision = { version: number; filename: string; mime: string; createdAt: number };
type Contract = Revision & { id: string; userId: number; title: string; name: string };
type Member = { userId: number; name: string };
async function request(action: string, init?: RequestInit) {
  const response = await sessionFetch(apiUrl(`/v1/workspace/${action}`), {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60000), headers: authHeaders(!!init?.body), ...init,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new RequestError(data.error || '合同服务暂不可用 / Contracts unavailable', response.status);
  }
  return response;
}
const asError = (error: unknown) => error instanceof RequestError ? error : new RequestError('操作失败，请重试 / Request failed; try again', 0);

export default function Contracts() {
  const t = useT();
  const resource = useResource<{ contracts: Contract[]; members: Member[]; canManage: boolean }>('contracts');
  const [editing, setEditing] = useState<Contract | 'new' | null>(null);
  const [viewing, setViewing] = useState<Contract | null>(null);
  return <>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    {resource.data?.canManage && <ContractDrafts members={resource.data.members} onUpload={() => setEditing('new')} onPublished={resource.reload} />}
    {resource.loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {resource.data?.contracts.length === 0 && <p className="staff-empty">{t('暂无合同', 'No contracts yet')}</p>}
    <div className="staff-feed">{resource.data?.contracts.map(contract => <article className="workspace-member-row" key={contract.id}>
      <div><h2>{contract.title}</h2><p className="staff-muted">{contract.name} · v{contract.version} · {new Date(contract.createdAt * 1000).toISOString().slice(0,10)}</p></div>
      <div className="staff-actions"><Button variant="secondary" onClick={() => setViewing(contract)}>{t('查看合同', 'View contract')}</Button>
        {resource.data?.canManage && <Button action="edit" onClick={() => setEditing(contract)}>{t('上传新版本', 'Upload revision')}</Button>}</div>
    </article>)}</div>
    {editing && <WorkspaceDialog title={editing === 'new' ? t('上传合同', 'Upload contract') : t('上传新版本', 'Upload revision')} onClose={() => setEditing(null)}>
      <Upload contract={editing === 'new' ? undefined : editing} members={resource.data!.members} onSaved={() => { setEditing(null); resource.reload(); }} />
    </WorkspaceDialog>}
    {viewing && <WorkspaceDialog wide title={viewing.title} onClose={() => setViewing(null)}><ContractViewer contract={viewing} /></WorkspaceDialog>}
  </>;
}
function Upload({contract, members, onSaved}: {contract?: Contract; members: Member[]; onSaved: () => void}) {
  const t = useT();
  const [error, setError] = useState<RequestError | null>(null);
  const [busy, setBusy] = useState(false);
  return <form className="staff-form" aria-busy={busy} onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    const file = data.get('file') as File;
    if (!file.size || file.size > 5 * 1024 * 1024) { setError(new RequestError(t('文件不能为空或超过 5 MB', 'File must be nonempty and at most 5 MB'), 400)); return; }
    setBusy(true); setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
      await request('contract-upload', {method: 'POST', body: JSON.stringify({id: contract?.id, version: contract?.version ?? 0, userId: Number(data.get('userId')), title: data.get('title'), filename: file.name, base64})});
      onSaved();
    } catch (failure) { setError(asError(failure)); } finally { setBusy(false); }
  }}>
    <Field label={t('归属员工', 'Employee')}><select name="userId" required defaultValue={contract?.userId ?? ''} disabled={busy || !!contract}>{!contract && <option value="">{t('选择员工', 'Choose employee')}</option>}{members.map(member => <option key={member.userId} value={member.userId}>{member.name} · {member.userId}</option>)}</select></Field>
    {contract && <input type="hidden" name="userId" value={contract.userId} />}
    <Field label={t('合同名称', 'Contract title')}><input name="title" required maxLength={120} defaultValue={contract?.title} readOnly={!!contract} disabled={busy} /></Field>
    <Field label={t('合同文件（PDF / DOCX，最多 5 MB）', 'Contract file (PDF / DOCX, up to 5 MB)')}><input name="file" type="file" accept=".pdf,.docx" required disabled={busy} /></Field>
    <ErrorNotice error={error ?? undefined} />
    <div className="staff-actions"><Button type="submit" action="save" iconOnly={false} disabled={busy}>{busy ? t('正在上传…', 'Uploading…') : t('保存', 'Save')}</Button></div>
  </form>;
}
function ContractViewer({contract}: {contract: Contract}) {
  const t = useT();
  const resource = useResource<{versions: Revision[]}>(`contract-versions?id=${encodeURIComponent(contract.id)}`);
  const [version, setVersion] = useState(contract.version);
  const [preview, setPreview] = useState<{url?: string; text?: string} | null>(null);
  const [error, setError] = useState<RequestError | null>(null);
  const [busy, setBusy] = useState(false);
  const revision = resource.data?.versions.find(item => item.version === version);
  useEffect(() => {
    if (!revision) return;
    const abort = new AbortController(); let url: string | undefined;
    setPreview(null); setError(null); setBusy(true);
    const query = `id=${encodeURIComponent(contract.id)}&version=${version}`;
    void (async () => {
      try {
        if (revision.mime === 'application/pdf') {
          const response = await request(`contract-file?${query}`, {signal: abort.signal});
          const file = await response.blob(); if (abort.signal.aborted) return;
          url = URL.createObjectURL(file); setPreview({url});
        } else {
          const response = await request(`contract-preview?${query}`, {signal: abort.signal});
          const data = await response.json(); if (!abort.signal.aborted) setPreview({text: data.text});
        }
      } catch (failure) { if (!abort.signal.aborted) setError(asError(failure)); }
      finally { if (!abort.signal.aborted) setBusy(false); }
    })();
    return () => { abort.abort(); if (url) URL.revokeObjectURL(url); };
  }, [contract.id, version, revision]);
  return <>
    <div className="staff-actions workspace-toolbar">
      <Field label={t('版本', 'Version')}><select value={version} onChange={event => setVersion(Number(event.target.value))} disabled={busy}>{resource.data?.versions.map(item => <option key={item.version} value={item.version}>v{item.version} · {new Date(item.createdAt * 1000).toISOString().slice(0,10)}</option>)}</select></Field>
      <Button variant="secondary" disabled={busy || !revision} onClick={async () => {
        setBusy(true); setError(null);
        try {
          const file = await (await request(`contract-file?id=${encodeURIComponent(contract.id)}&version=${version}`)).blob();
          const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = revision!.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (failure) { setError(asError(failure)); } finally { setBusy(false); }
      }}>{t('下载原文件', 'Download original')}</Button>
    </div>
    <ErrorNotice error={resource.error ?? error ?? undefined} retry={resource.reload} />
    {(resource.loading || busy) && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {preview?.url && <iframe title={contract.title} src={preview.url} style={{width: '100%', height: '65vh', border: 0}} />}
    {preview?.text !== undefined && <><p className="staff-muted">{t('文本预览，原始排版请下载 DOCX 查看。', 'Text preview. Download the DOCX for the original formatting.')}</p><div style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{preview.text}</div></>}
  </>;
}
