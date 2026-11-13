'use client';

import { text, field } from './PlatformFormDefinitions';
import { DomainForm, ActionButton } from './PlatformForm';
import { type CommonProps } from './PlatformActionTypes';

export function PlatformPayoutManager({ definition, entities = [], busy, runAction }: CommonProps) {
  return (
    <div className="platform-domain-stack">
      <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{
        title: text('生成结算单', 'Generate payout'),
        action: 'admin-payout-generate',
        fields: [field('instructorId', '讲师 ID', 'Instructor ID', { required: true }), field('currency', '币种', 'Currency', { required: true, pattern: '[A-Z]{3}', defaultValue: 'CNY' })],
      }} />
      {entities.map((entity) => entity.status === 'draft' ? (
        <section key={entity.id} className="platform-domain-actions">
          <h2>{entity.title}</h2>
          <ActionButton action="admin-payout-approve" label={entity.data?.payoutMode === 'wechat' ? text('审核并转账', 'Approve and transfer') : undefined} resourceId={entity.id} confirm={entity.data?.payoutMode === 'wechat' ? undefined : text('批准这张结算单吗？', 'Approve this payout?')} busy={busy} runAction={runAction} />
        </section>
      ) : entity.data?.payoutMode === 'wechat' && ['approved', 'processing', 'failed'].includes(entity.status || '') ? (<section key={entity.id} className="platform-domain-actions"><h2>{entity.title}</h2><ActionButton action="admin-payout-refresh" resourceId={entity.id} busy={busy} runAction={runAction} /></section>) : entity.status === 'approved' || entity.status === 'processing' ? (
        <DomainForm key={entity.id} definition={definition} entity={entity} resourceId={entity.id} busy={busy} runAction={runAction} spec={{
          title: text(`登记付款：${entity.title}`, `Record payment: ${entity.title}`),
          action: 'admin-payout',
          fields: [field('providerReference', '付款凭证编号', 'Provider reference', { required: true, maxLength: 240 })],
        }} />
      ) : null)}
    </div>
  );
}
