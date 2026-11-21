'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ErrorNotice, Field, useResource, RequestError } from '@app-foundation/workspace-ui';
import { useT } from '@/hooks/useT';
import AppLink from '@/components/AppLink';
import { CONTRACT_READER_PATH } from '@/lib/contract-reader-route';
import { WorkspaceButton as Button, WorkspaceDialog } from './WorkspaceControls';
import { asContractError, requestContract, type Contract } from './contract-api';

const ContractDrafts = dynamic(() => import('./ContractDrafts'));

type Member = { userId: number; name: string };

export default function Contracts() {
  const t = useT();
  const resource = useResource<{ contracts: Contract[]; members: Member[]; canManage: boolean }>('contracts');
  const [editing, setEditing] = useState<Contract | 'new' | null>(null);
  return <>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    {resource.data?.canManage && <ContractDrafts members={resource.data.members} onUpload={() => setEditing('new')} />}
    {resource.loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {resource.data?.contracts.length === 0 && <p className="staff-empty">{t('暂无合同', 'No contracts yet')}</p>}
    <div className="staff-feed">{resource.data?.contracts.map(contract => <article className="workspace-member-row" key={contract.id}>
      <div><h2>{contract.title}</h2><p className="staff-muted">{contract.name} · {new Date(contract.createdAt * 1000).toISOString().slice(0,10)}</p></div>
      <div className="staff-actions"><AppLink href={`${CONTRACT_READER_PATH}?id=${encodeURIComponent(contract.id)}`} prefetch={false} className="btn btn-secondary workspace-action" data-emphasis="quiet">{t('查看合同', 'View contract')}</AppLink>
        {resource.data?.canManage && <Button action="edit" onClick={() => setEditing(contract)}>{t('上传新版本', 'Upload revision')}</Button>}</div>
    </article>)}</div>
    {editing && <WorkspaceDialog title={editing === 'new' ? t('上传合同', 'Upload contract') : t('上传新版本', 'Upload revision')} onClose={() => setEditing(null)}>
      <Upload contract={editing === 'new' ? undefined : editing} members={resource.data!.members} onSaved={() => { setEditing(null); resource.reload(); }} />
    </WorkspaceDialog>}
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
      await requestContract('contract-upload', {method: 'POST', body: JSON.stringify({id: contract?.id, version: contract?.version ?? 0, userId: Number(data.get('userId')), title: data.get('title'), filename: file.name, base64})});
      onSaved();
    } catch (failure) { setError(asContractError(failure)); } finally { setBusy(false); }
  }}>
    <Field label={t('员工', 'Employee')}><select name="userId" required defaultValue={contract?.userId ?? ''} disabled={busy || !!contract}>{!contract && <option value="">{t('选择员工', 'Choose employee')}</option>}{members.map(member => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></Field>
    {contract && <input type="hidden" name="userId" value={contract.userId} />}
    <Field label={t('合同名称', 'Contract title')}><input autoComplete="off" name="title" required maxLength={120} defaultValue={contract?.title} readOnly={!!contract} disabled={busy} /></Field>
    <Field label={t('合同文件（PDF / DOCX，最多 5 MB）', 'Contract file (PDF / DOCX, up to 5 MB)')}><input name="file" type="file" accept=".pdf,.docx" required disabled={busy} /></Field>
    <ErrorNotice error={error ?? undefined} />
    <div className="staff-actions"><Button type="submit" action="save" iconOnly={false} disabled={busy}>{busy ? t('正在上传…', 'Uploading…') : t('保存', 'Save')}</Button></div>
  </form>;
}
