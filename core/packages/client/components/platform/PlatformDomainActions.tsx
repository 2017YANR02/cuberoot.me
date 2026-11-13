'use client';

import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { PlatformQrMetadataEditor } from './PlatformQrMetadataEditor';
import { PlatformPurchaseForm } from './PlatformPurchaseForm';
import { PlatformFavoriteButton } from './PlatformFavoriteButton';
import { text, option, field, ADMIN_FORMS } from './PlatformFormDefinitions';
import { DomainForm, ActionButton } from './PlatformForm';
import { PlatformCourseContentManager } from './PlatformCourseManager';
import { PlatformAdminCollectionManager } from './PlatformAdminCollectionManager';
import { PlatformRedemptionCodeManager } from './PlatformRedemptionCodeManager';
import { PlatformPayoutManager } from './PlatformPayoutManager';
import { PlatformLearningActions } from './PlatformLearningActions';
import { PlatformShippingAddressManager } from './PlatformShippingAddressManager';
import { PlatformCommerceActions, PlatformAdminOrderActions } from './PlatformOrderActions';
import { PlatformInstructorActions } from './PlatformInstructorActions';
import { type CommonProps } from './PlatformActionTypes';

export function PlatformEventActions(props: CommonProps) {
  const { definition, entity, busy, runAction } = props;
  const t = useT();
  if (definition.id !== 'event-detail') return null;
  return (
    <div className="platform-domain-stack">
      <section className="platform-domain-actions">
        <h2>{t('活动收藏', 'Event favorite')}</h2>
        <PlatformFavoriteButton definition={definition} targetType="event" entityId={entity?.id} />
      </section>
      <PlatformPurchaseForm entity={entity} kind="event_ticket" busy={busy} runAction={runAction} />
    </div>
  );
}

export function PlatformAdminActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction, entities } = props;
  const t = useT();
  if (definition.id === 'admin-order') return <PlatformAdminOrderActions {...props} />;
  if (definition.id === 'admin-invites') return <PlatformRedemptionCodeManager {...props} />;
  if (['admin-paths', 'admin-coupons', 'admin-qr-prompts'].includes(definition.id)) {
    return <PlatformAdminCollectionManager {...props} />;
  }
  if (definition.id === 'admin-payouts') return <PlatformPayoutManager {...props} />;
  const form = ADMIN_FORMS[definition.id];
  if (form) {
    if (definition.id === 'admin-qr-detail') {
      if (!entity) return null;
      return (
        <div className="platform-domain-stack">
          <PlatformQrMetadataEditor
            entity={entity}
            resourceId={entity.id}
            busy={busy}
            runAction={(id, payload) => runAction('admin-save', id, payload)}
          />
          <DomainForm definition={definition} busy={busy} runAction={runAction} resourceId={entity.id} spec={{
            title: text('复制二维码', 'Duplicate QR code'),
            action: 'qr-duplicate',
            fields: [field('code', '新编码（留空自动生成）', 'New code (leave blank to generate)', { pattern: '[a-z0-9][a-z0-9_-]{5,79}', minLength: 6, maxLength: 80 })],
          }} />
          <section className="platform-domain-actions">
            <h2>{t('可用状态', 'Availability')}</h2>
            <ActionButton
              action="qr-toggle"
              resourceId={entity.id}
              payload={{ disabled: entity.data?.status !== 'disabled' }}
              label={entity.data?.status === 'disabled' ? text('重新启用', 'Enable') : text('停用', 'Disable')}
              confirm={text('确定更新这个二维码的可用状态吗？', 'Update this QR code availability?')}
              busy={busy}
              runAction={runAction}
            />
          </section>
        </div>
      );
    }
    const editor = <DomainForm definition={definition} entity={entity} resourceId={params.id ?? params.code} busy={busy} runAction={runAction} spec={form} />;
    if (definition.id === 'admin-course') {
      return <div className="platform-domain-stack">{editor}<PlatformCourseContentManager {...props} /></div>;
    }
    if (definition.id === 'admin-teacher') {
      return (
        <div className="platform-domain-stack">
          {editor}
          <ActionButton
            action="admin-delete"
            resourceId={params.id}
            label={text('归档讲师', 'Archive instructor')}
            confirm={text('确定归档这个讲师账号吗？', 'Archive this instructor account?')}
            busy={busy}
            runAction={runAction}
          />
        </div>
      );
    }
    return editor;
  }
  if (definition.id === 'admin-application') {
    return <DomainForm definition={definition} entity={entity} resourceId={params.id} busy={busy} runAction={runAction} spec={{ title: text('审核决定', 'Review decision'), action: 'admin-review', fields: [field('decision', '审核结果', 'Decision', { kind: 'select', options: [option('approved', '通过', 'Approve'), option('rejected', '拒绝', 'Reject')] }), field('note', '审核备注', 'Review note', { kind: 'textarea', rows: 5 })] }} />;
  }
  if (definition.id === 'admin-reconcile') {
    return (
      <div className="platform-domain-stack">
        <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{
          title: text('导入渠道对账单', 'Import provider statement'),
          action: 'admin-reconcile-run',
          fields: [
            field('provider', '支付渠道', 'Payment provider', { kind: 'select', options: [option('wechat', '微信支付', 'WeChat Pay'), option('alipay', '支付宝', 'Alipay')] }),
            field('statementDate', '账单日期', 'Statement date', { kind: 'date', required: true }),
            field('records', '交易记录 JSON 数组', 'Transaction record JSON array', { kind: 'json', rows: 10, required: true, placeholder: text('[{"providerTransactionId":"…","amountMinor":100,"currency":"CNY"}]', '[{"providerTransactionId":"…","amountMinor":100,"currency":"CNY"}]') }),
          ],
        }} />
        {(entities??[]).filter(item=>!['matched','resolved'].includes(item.status??'')).map(item=><DomainForm key={item.id} definition={definition} entity={item} resourceId={item.id} busy={busy} runAction={runAction} spec={{ title:text(`处理差异：${item.data?.providerTransactionId??item.title}`,`Resolve: ${item.data?.providerTransactionId??item.title}`),action:'admin-reconcile',fields:[field('resolutionNote','处理说明','Resolution note',{kind:'textarea',rows:3,required:true,maxLength:4000})] }}/>) }
      </div>
    );
  }
  return null;
}

export function PlatformQrCertificateActions(props: CommonProps) {
  const t = useT();
  if (props.definition.resource !== 'qr' || !props.params.code) return null;
  const code = encodeURIComponent(props.params.code);
  return (
    <section className="platform-domain-actions">
      <h2>{t('二维码资源', 'QR resources')}</h2>
      <div className="platform-write-actions">
        <a className="platform-button platform-button-primary" href={apiUrl(`/v1/platform/qr/${code}/redirect`)}>{t('打开目标', 'Open target')}</a>
        <a className="platform-button" href={apiUrl(`/v1/platform/qr/${code}/svg`)}>{t('下载 SVG', 'Download SVG')}</a>
        <a className="platform-button" href={apiUrl(`/v1/platform/qr/${code}/card`)}>{t('查看卡片', 'View card')}</a>
      </div>
    </section>
  );
}

export function PlatformDomainActions(props: CommonProps) {
  if (props.definition.id === 'news-detail') return <PlatformFavoriteButton definition={props.definition} targetType="news" entityId={props.entity?.id} />;
  if (props.definition.id === 'account-shipping') return <PlatformShippingAddressManager {...props} />;
  if (props.definition.id === 'account-invites') return <PlatformLearningActions {...props} />;
  if (props.definition.id === 'event-detail') return <PlatformEventActions {...props} />;
  if (props.definition.area === 'learning') return <PlatformLearningActions {...props} />;
  if (props.definition.area === 'commerce') return <PlatformCommerceActions {...props} />;
  if (props.definition.area === 'instructor') return <PlatformInstructorActions {...props} />;
  if (props.definition.area === 'admin') return <PlatformAdminActions {...props} />;
  if (props.definition.resource === 'qr' || props.definition.resource === 'certificate') return <PlatformQrCertificateActions {...props} />;
  return null;
}

export { PlatformLearningActions } from './PlatformLearningActions';

export { PlatformShippingAddressManager } from './PlatformShippingAddressManager';

export { PlatformCommerceActions } from './PlatformOrderActions';

export { PlatformInstructorActions } from './PlatformInstructorActions';
