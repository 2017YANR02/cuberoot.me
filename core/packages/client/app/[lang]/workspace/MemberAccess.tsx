'use client';

import { ErrorNotice, Form, useResource, useWorkspace } from '@app-foundation/workspace-ui';
import { useT } from '@/hooks/useT';
import { WorkspaceButton as Button } from './WorkspaceControls';

type AccessStatus = { status: 'none' | 'pending' | 'enabled' | 'rejected' };
type MemberRequest = { id: string; userId: string; name: string };

export function MemberAccessRequest() {
  const t = useT();
  const {api} = useWorkspace();
  const resource = useResource<AccessStatus>('member-request');
  const status = resource.data?.status;
  return <>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    <div aria-live="polite">
      {resource.loading && <p>{t('正在获取员工权限…', 'Checking employee access…')}</p>}
      {!resource.loading && status === 'enabled' && <p>{t('员工权限已开通', 'Employee access enabled')}</p>}
      {!resource.loading && status === 'pending' && <p>{t('已提交，等待审批', 'Submitted and awaiting review')}</p>}
      {!resource.loading && status === 'rejected' && <p>{t('申请未获批准', 'Request declined')}</p>}
    </div>
    {status === 'pending' && <Button variant="secondary" disabled={resource.loading} onClick={resource.reload}>{t('刷新状态', 'Refresh status')}</Button>}
    {!resource.loading && !resource.error && (status === 'none' || status === 'rejected') && <Form submit={async () => {
      await api<AccessStatus>('member-request', {});
      resource.reload();
    }}>
      <button className="staff-start-action" type="submit">{status === 'rejected' ? t('重新申请', 'Request again') : t('申请员工权限', 'Request employee access')}</button>
    </Form>}
  </>;
}

export function MemberAccessApprovals({onReviewed}: {onReviewed: () => void}) {
  const t = useT();
  const {api, formatName = (name: string) => name} = useWorkspace();
  const resource = useResource<{requests: MemberRequest[]}>('member-requests');
  return <section className="staff-feed">
    <div className="staff-actions">
      <h2>{t('员工权限申请', 'Employee access requests')}</h2>
      <Button action="reload" variant="secondary" disabled={resource.loading} onClick={resource.reload}>{t('刷新申请', 'Refresh requests')}</Button>
    </div>
    <ErrorNotice error={resource.error} />
    {resource.loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {!resource.loading && !resource.error && resource.data?.requests.length === 0 && <p className="staff-muted">{t('暂无待审批申请', 'No requests awaiting review')}</p>}
    {resource.data?.requests.map(request => <article key={request.id} className="workspace-member-row">
      <div><h3>{formatName(request.name)}</h3><p className="staff-muted">CubeRoot ID · {request.userId}</p></div>
      <Form submit={async (_, decision) => {
        await api('member-request-decision', {id: request.id, decision});
        resource.reload();
        onReviewed();
      }}>
        <div className="staff-actions">
          <Button type="submit" value="approved" disabled={resource.loading}>{t('批准', 'Approve')}</Button>
          <Button type="submit" value="rejected" variant="secondary" disabled={resource.loading}>{t('拒绝', 'Decline')}</Button>
        </div>
      </Form>
    </article>)}
  </section>;
}
