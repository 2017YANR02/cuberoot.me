'use client';

import { useT } from '@/hooks/useT';
import AppLink from '@/components/AppLink';
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
import { PlatformInstructorReview } from './PlatformInstructorApplication';

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
      const entryId = entity?.data?.teacherEntryId;
      const profileLink = entryId != null ? <AppLink href={`/teachers/edit?id=${encodeURIComponent(String(entryId))}`} className="platform-button" prefetch={false}>{t('编辑统一讲师资料', 'Edit canonical teaching profile')}</AppLink> : null;
      if (entity?.status === 'unverified') return <div className="platform-domain-stack"><p>{t('历史名录资料尚未通过讲师入驻审核，不具有课程发布权限。', 'This legacy directory profile is not approved to publish courses.')}</p>{profileLink}<AppLink href="/platform/admin/teacher-applications" className="platform-button" prefetch={false}>{t('查看入驻申请', 'View admission applications')}</AppLink></div>;
      return (
        <div className="platform-domain-stack">
          {profileLink}
          {entryId == null && <p>{t('尚未关联统一讲师资料，请核对历史记录。', 'The canonical teaching profile has not yet been linked. Verify legacy records.')}</p>}
          {entryId == null && Array.isArray(entity?.data?.profiles) && entity.data.profiles.map((raw, index) => {
            if (!raw || typeof raw !== 'object') return null;
            const profile = raw as Record<string, unknown>;
            return <div key={index} className="platform-application-profile"><span>{t(String(profile.nameZh || profile.nameEn), String(profile.nameEn || profile.nameZh))}</span><ActionButton action="admin-save" resourceId={params.id} payload={{ teacherEntryId: Number(profile.id) }} label={text('确认关联资料', 'Confirm profile link')} confirm={text('确认这份历史资料属于该讲师？', 'Confirm this legacy profile belongs to the instructor?')} busy={busy} runAction={runAction} /></div>;
          })}
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
    return <PlatformInstructorReview {...props} />;
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
