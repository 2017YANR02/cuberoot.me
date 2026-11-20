'use client';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { ErrorNotice, RequestError, useResource } from '@app-foundation/workspace-ui';
import { Download } from '@app-foundation/icons/lucide';
import { parseAsString, useQueryState } from 'nuqs';
import PageBackLink from '@/components/PageBackLink';
import { useT } from '@/hooks/useT';
import { authActions, useAuthUser } from '@/lib/auth-store';
import { renderDocxPreview } from '@/lib/docx-preview';
import { CONTRACT_LIST_HREF } from '@/lib/contract-reader-route';
import { WorkspaceButton as Button } from './WorkspaceControls';
import WorkspaceHost from './WorkspaceHost';
import { asContractError, requestContract, type Contract, type Revision } from './contract-api';
import './contract-reader.css';

const ContractDraftPage = dynamic(() => import('./ContractDraftPage'));
const revisionDate = ({createdAt}: Revision) => new Date(createdAt * 1000).toISOString().slice(0, 10);

export default function ContractDetail() {
  const t = useT();
  const user = useAuthUser();
  if (user) return <Suspense fallback={<ContractReaderToolbar title={t('合同详情', 'Contract details')} />}>
    <WorkspaceHost key={user.uid ?? user.wcaId}>
      <ContractScreen />
    </WorkspaceHost>
  </Suspense>;
  return <main className="staff-workspace contract-reader">
    <ContractReaderToolbar title={t('合同详情', 'Contract details')} />
    <div className="contract-reader-status">
      <Button onClick={() => authActions.login()}>{t('登录 CubeRoot', 'Sign in to CubeRoot')}</Button>
    </div>
  </main>;
}

function ContractScreen() {
  const [draftId] = useQueryState('draft', parseAsString);
  return draftId ? <ContractDraftPage key={draftId} id={draftId} /> : <main className="staff-workspace contract-reader">
    <SelectedContract />
  </main>;
}

function ContractReaderToolbar({title, children}: {title: string; children?: ReactNode}) {
  const t = useT();
  return <header className="contract-reader-toolbar">
    <div className="contract-reader-heading page-back-heading">
      <PageBackLink fallback={CONTRACT_LIST_HREF} aria-label={t('返回合同列表', 'Back to contracts')} />
      <h1>{title}</h1>
    </div>
    {children}
  </header>;
}

function SelectedContract() {
  const t = useT();
  const [id] = useQueryState('id', parseAsString.withDefault(''));
  const resource = useResource<{ contracts: Contract[] }>('contracts');
  const contract = resource.error ? undefined : resource.data?.contracts.find(item => item.id === id);

  if (contract) return <ContractViewer key={contract.id} contract={contract} />;
  return <>
    <ContractReaderToolbar title={t('合同详情', 'Contract details')} />
    <div className="contract-reader-status">
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
      {resource.error?.status === 401 && <Button onClick={() => authActions.login()}>{t('重新登录', 'Sign in again')}</Button>}
      {!resource.loading && !resource.error && <p role="alert">{t('合同不存在或无权访问', 'Contract unavailable')}</p>}
    </div>
  </>;
}

function ContractViewer({contract}: {contract: Contract}) {
  const t = useT();
  const resource = useResource<{versions: Revision[]}>(`contract-versions?id=${encodeURIComponent(contract.id)}`);
  const [version, setVersion] = useState(contract.version);
  const [preview, setPreview] = useState<{url?: string; html?: string} | null>(null);
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
        const response = await requestContract(`contract-file?${query}`, {signal: abort.signal});
        const file = await response.blob();
        if (abort.signal.aborted) return;
        if (revision.mime === 'application/pdf') {
          url = URL.createObjectURL(file); setPreview({url});
        } else {
          const html = await renderDocxPreview(file, 'paper');
          if (!abort.signal.aborted) setPreview({html});
        }
      } catch (failure) { if (!abort.signal.aborted) setError(asContractError(failure)); }
      finally { if (!abort.signal.aborted) setBusy(false); }
    })();
    return () => { abort.abort(); if (url) URL.revokeObjectURL(url); };
  }, [contract.id, version, revision]);
  const versions = resource.data?.versions ?? [];
  const downloadLabel = t('下载原文件', 'Download original');
  return <>
    <ContractReaderToolbar title={contract.title}>
      <div className="contract-reader-actions">
        {versions.length > 1 ? <select className="staff-input contract-reader-version" aria-label={t('版本', 'Version')} value={version} onChange={event => setVersion(Number(event.target.value))} disabled={busy}>
          {versions.map(item => <option key={item.version} value={item.version}>{revisionDate(item)}</option>)}
        </select> : revision && <time dateTime={revisionDate(revision)}>{revisionDate(revision)}</time>}
        <Button className="contract-reader-download" variant="secondary" aria-label={downloadLabel} disabled={busy || !revision} onClick={async () => {
          setBusy(true); setError(null);
          try {
            const file = await (await requestContract(`contract-file?id=${encodeURIComponent(contract.id)}&version=${version}`)).blob();
            const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = revision!.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (failure) { setError(asContractError(failure)); } finally { setBusy(false); }
        }}><Download size={16} aria-hidden="true" /><span>{downloadLabel}</span></Button>
      </div>
    </ContractReaderToolbar>
    {(resource.error || error || (resource.loading || busy) && !preview) && <div className="contract-reader-status">
      <ErrorNotice error={resource.error ?? error ?? undefined} retry={resource.reload} />
      {(resource.loading || busy) && !preview && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    </div>}
    {preview && <iframe className="contract-reader-frame" title={contract.title} src={preview.url} srcDoc={preview.html}
      sandbox={preview.html ? '' : undefined} referrerPolicy="no-referrer" />}
  </>;
}
