'use client';

import { useEffect, useState, type ReactNode } from 'react';
import BoolToggle from '@/components/BoolToggle';
import { useT } from '@/hooks/useT';
import { approveCompetitionOrderRefund, listCompetitionOrderRefunds, refreshCompetitionOrderRefund, rejectCompetitionOrderRefund, requestCompetitionOrderRefund, type CompetitionRefund } from '@/lib/online-competition-api';
import type { PlatformEntity } from '@/lib/platform-types';
import { PlatformState } from './PlatformState';
import { PlatformPurchaseForm } from './PlatformPurchaseForm';
import { PlatformFavoriteButton } from './PlatformFavoriteButton';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { type FieldSpec, type CommonProps } from './PlatformActionTypes';
import { text, field } from './PlatformFormDefinitions';
import { DomainForm, ActionButton } from './PlatformForm';
import { PlatformShippingAddressManager } from './PlatformShippingAddressManager';
import { PlatformMembershipCatalog } from './PlatformMembershipCatalog';

function PlatformOrderRefunds({ entity, orderId, admin = false, manualFallback, onSaved }: { entity?: PlatformEntity; orderId: string; admin?: boolean; manualFallback?: ReactNode; onSaved?: () => void }) {
  const t = useT();
  const [items, setItems] = useState<CompetitionRefund[]>([]);
  const [reason, setReason] = useState('');
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [confirmedId, setConfirmedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const rawItems = Array.isArray(entity?.data?.items) ? entity.data.items : [];
  const competitionOrder = rawItems.length > 0 && rawItems.every(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const item = raw as Record<string, unknown>;
    return item.sellableType === 'event_ticket' && !!item.snapshot && typeof item.snapshot === 'object' && 'competition' in item.snapshot;
  });
  const enabled = !!orderId && !!entity?.data && Number(entity.data.totalAmountMinor) > 0 && (admin || competitionOrder);
  const status = typeof entity?.data?.status === 'string' ? entity.data.status : entity?.status;
  const shouldPoll = items.some(item => item.status === 'requested' || item.status === 'pending' || (item.status === 'failed' && !!item.approvedAt));
  useEffect(() => { if (status !== 'refunded' && items.some(item => item.status === 'succeeded')) onSaved?.(); }, [items, onSaved, status]);
  useEffect(() => {
    setItems([]); setError(''); setConfirmedId(''); setReason('');
  }, [orderId]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    const refresh = async () => {
      try { const result = await listCompetitionOrderRefunds(orderId); if (active) { setItems(result.items); setError(''); } }
      catch (error) { if (active) setError(error instanceof Error ? error.message : t('退款状态加载失败。', 'Could not load refund status.')); }
      finally { if (active) setLoading(false); }
    };
    void refresh();
    const interval = shouldPoll ? window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 10000) : undefined;
    return () => { active = false; window.clearInterval(interval); };
  }, [enabled, orderId, revision, shouldPoll, t]);
  if (!enabled) return null;
  const activeRefund = items.some(item => item.approvedAt || ['requested', 'pending', 'succeeded', 'chargeback'].includes(item.status));
  const canRequest = competitionOrder && !loading && !error && !activeRefund && Number(entity?.data?.totalAmountMinor ?? 0) > 0 && ['paid', 'partially_fulfilled', 'fulfilled'].includes(status ?? '');
  async function act(action: () => Promise<CompetitionRefund>) {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await action(); setItems(current => [result, ...current.filter(item => item.id !== result.id)]); setConfirmedId(''); setRevision(value => value + 1); }
    catch (error) { setError(error instanceof Error ? error.message : t('退款操作未完成，请重试。', 'Could not complete the refund action. Try again.')); }
    finally { setBusy(false); }
  }
  const labels: Record<string, string> = { requested: t('等待平台审核', 'Awaiting platform review'), pending: t('支付渠道处理中', 'Payment provider processing'), succeeded: t('退款成功', 'Refund completed'), failed: t('退款异常，需平台处理', 'Refund issue: platform review required'), cancelled: t('退款申请已拒绝', 'Refund request declined'), chargeback: t('支付争议处理中', 'Payment dispute in progress') };
  return <section className="platform-domain-actions"><h2>{t('退款', 'Refunds')}</h2>
    {loading ? <p role="status" className="platform-domain-note"><LoadingIndicator>{t('正在查询退款状态…', 'Loading refund status…')}</LoadingIndicator></p> : null}
    {items.map(item => <div key={item.id} className="platform-domain-stack"><p><strong>{labels[item.status] ?? t('等待确认', 'Awaiting confirmation')}</strong> {new Intl.NumberFormat(undefined, { style: 'currency', currency: item.currency }).format(Number(item.amountMinor) / 100)}</p><p className="platform-domain-note">{item.reasonCode}</p>{item.rejectionReason ? <p>{t('拒绝原因：', 'Declined because: ')}{item.rejectionReason}</p> : null}
      {item.approvedAt && item.status !== 'succeeded' ? <p className="platform-domain-note">{t('已批准的退款正在核对支付渠道结果。收到成功结果前，不视为退款完成。', 'The approved refund is being reconciled with the payment provider. It is complete only after success is confirmed.')}</p> : null}
      {item.failureCode ? <p className="platform-domain-note">{t('渠道暂未确认完成，平台将继续查询。', 'Provider completion is not confirmed; the platform will continue checking.')}</p> : null}
      {admin && (item.status === 'requested' || (item.approvedAt && item.status !== 'succeeded' && item.status !== 'chargeback')) ? <>
        <BoolToggle value={confirmedId === item.id} onChange={value => setConfirmedId(value ? item.id : '')} label={t('确认按赛事退款政策原路退还上述全额', 'Confirm the full original-payment refund under the competition policy')} />
        <div className="platform-write-actions"><button type="button" className="platform-button" disabled={busy || confirmedId !== item.id} onClick={() => { void act(() => approveCompetitionOrderRefund(item.id)); }}>{item.approvedAt ? t('继续原路退款', 'Retry original refund') : t('批准并实际退款', 'Approve and issue refund')}</button>{item.approvedAt ? <button type="button" className="platform-button" disabled={busy} onClick={() => { void act(() => refreshCompetitionOrderRefund(item.id)); }}>{t('查询支付渠道', 'Check payment provider')}</button> : null}</div>
        {!item.approvedAt ? <><label>{t('拒绝原因', 'Reason for declining')}<input className="platform-field-control" maxLength={64} value={rejectReasons[item.id] ?? ''} onChange={event => setRejectReasons(current => ({ ...current, [item.id]: event.target.value }))} /></label><button type="button" className="platform-button" disabled={busy || !rejectReasons[item.id]?.trim()} onClick={() => { void act(() => rejectCompetitionOrderRefund(item.id, rejectReasons[item.id].trim())); }}>{t('拒绝退款申请', 'Decline refund request')}</button></> : null}
      </> : null}
    </div>)}
    {canRequest ? <><p className="platform-domain-note">{t('提交全额退款申请，由 CubeRoot 按赛事退款政策审核。', 'Request a full refund for CubeRoot to review under the competition refund policy.')}</p><label>{t('退款原因', 'Refund reason')}<input className="platform-field-control" value={reason} maxLength={64} onChange={event => setReason(event.target.value)} /></label><button type="button" className="platform-button" disabled={busy || !reason.trim()} onClick={() => { void act(() => requestCompetitionOrderRefund(orderId, reason.trim())); }}>{t('申请全额退款', 'Request full refund')}</button></> : null}
    {error ? <p role="alert">{error}</p> : null}<button type="button" className="platform-button" disabled={busy || loading} onClick={() => { setError(''); setRevision(value => value + 1); }}>{t('刷新退款状态', 'Refresh refund status')}</button>
    {admin && !loading && !error && !activeRefund ? manualFallback : null}
  </section>;
}

export function PlatformCommerceActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  const t = useT();
  const [addresses, setAddresses] = useState<PlatformEntity[]>([]);
  if (definition.id === 'membership' || definition.id === 'me-membership') return <PlatformMembershipCatalog {...props} />;
  if (definition.id === 'product-detail') {
    const physical = entity?.data?.productType === 'physical';
    return (
      <div className="platform-domain-stack">
        {physical ? <PlatformShippingAddressManager {...props} onAddresses={setAddresses} /> : null}
        {physical && addresses.length === 0 ? <p className="platform-domain-note">{t('请先保存收货地址，再创建实物商品订单。', 'Save a shipping address before creating a physical-product order.')}</p> : (
          <PlatformPurchaseForm entity={entity} kind="product_variant" addresses={addresses} busy={busy} runAction={runAction} />
        )}
        <section className="platform-domain-actions">
          <h2>{t('稍后购买', 'Save for later')}</h2>
          <PlatformFavoriteButton definition={definition} targetType="product" entityId={entity?.id} />
        </section>
      </div>
    );
  }
  if (definition.id !== 'order-detail') return null;
  return <>{entity?.status === 'pending_payment' && <section className="platform-domain-actions"><ActionButton action="cancel-order" resourceId={entity.id} secondary confirm={text('确定取消这笔未支付订单吗？', 'Cancel this unpaid order?')} busy={busy} runAction={runAction} /></section>}<PlatformOrderRefunds key={params.id} entity={entity} orderId={params.id} onSaved={props.onSaved} /></>;
}

function fulfillmentProgress(item: Record<string, unknown>) {
  const raw = item.fulfillment && typeof item.fulfillment === 'object' && !Array.isArray(item.fulfillment)
    ? item.fulfillment as Record<string, unknown>
    : {};
  return {
    shipped: Number(raw.shippedQuantity ?? 0),
    delivered: Number(raw.deliveredQuantity ?? 0),
    returned: Number(raw.returnedQuantity ?? 0),
  };
}

function shipmentFields(max: number): FieldSpec[] {
  return [
    field('quantity', '数量', 'Quantity', { kind: 'number', required: true, min: 1, max, step: 1, defaultValue: max }),
    field('externalReference', '外部操作编号', 'External reference', { required: true, maxLength: 240 }),
    field('carrier', '承运商', 'Carrier', { maxLength: 120 }),
    field('trackingNumber', '物流单号', 'Tracking number', { maxLength: 200 }),
    field('note', '履约备注', 'Fulfillment note', { kind: 'textarea', rows: 3, maxLength: 1000 }),
  ];
}

export function PlatformAdminOrderActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  const t = useT();
  const orderId = params.id;
  const status = typeof entity?.data?.status === 'string' ? entity.data.status : entity?.status;
  const rawItems = Array.isArray(entity?.data?.items) ? entity.data.items : [];
  const items = rawItems.flatMap((raw) => raw && typeof raw === 'object' && !Array.isArray(raw) ? [raw as Record<string, unknown>] : []);
  const canFulfill = status === 'paid' || status === 'partially_fulfilled';
  const canReturn = status === 'partially_refunded' || status === 'refunded';
  const canRefund = ['paid', 'partially_fulfilled', 'fulfilled'].includes(status ?? '');
  return (
    <div className="platform-domain-stack">
      <PlatformOrderRefunds key={orderId} entity={entity} orderId={orderId} admin onSaved={props.onSaved} manualFallback={canRefund ? <DomainForm definition={definition} entity={entity} resourceId={orderId} busy={busy} runAction={runAction} spec={{
        title: text('登记已完成的全额退款', 'Record a completed full refund'),
        action: 'admin-refund',
        fields: [
          field('reasonCode', '退款原因代码', 'Reason code', { required: true, maxLength: 64 }),
          field('providerRefundId', '支付渠道退款编号', 'Provider refund ID', { required: true, maxLength: 200 }),
          field('evidenceReference', '已完成退款的凭证说明', 'Evidence of completed refund', { required: true, maxLength: 240 }),
        ],
      }} /> : null} />
      <section className="platform-domain-actions">
        <h2>{t('逐项履约', 'Item fulfillment')}</h2>
        {items.length === 0 ? <PlatformState kind="empty" /> : (
          <div className="platform-domain-stack">
            {items.map((item, index) => {
              const itemId = typeof item.id === 'string' ? item.id : '';
              const quantity = Number(item.quantity ?? 0);
              const progress = fulfillmentProgress(item);
              const shipment = item.fulfillmentType === 'shipment';
              const shippable = Math.max(0, quantity - progress.shipped);
              const deliverable = Math.max(0, progress.shipped - progress.delivered);
              const returnable = Math.max(0, progress.shipped - progress.returned);
              return (
                <div className="platform-course-editor-item" key={itemId || String(index)}>
                  <h3>{t('订单项目', 'Order item')} {index + 1}</h3>
                  <p className="platform-domain-note">{shipment
                    ? t(`共 ${quantity}，已发 ${progress.shipped}，已送达 ${progress.delivered}，已退回 ${progress.returned}`, `${quantity} total, ${progress.shipped} shipped, ${progress.delivered} delivered, ${progress.returned} returned`)
                    : t('数字权益在支付成功后自动发放，无需物流操作。', 'Digital entitlement is granted after successful payment and does not require shipment actions.')}</p>
                  {shipment && canFulfill && shippable > 0 ? <DomainForm definition={definition} resourceId={orderId} busy={busy} runAction={runAction} spec={{ title: text('登记发货', 'Record shipment'), action: 'admin-ship-order-item', payloadBase: { itemId }, fields: shipmentFields(shippable) }} /> : null}
                  {shipment && canFulfill && deliverable > 0 ? <DomainForm definition={definition} resourceId={orderId} busy={busy} runAction={runAction} spec={{ title: text('确认送达', 'Confirm delivery'), action: 'admin-deliver-order-item', payloadBase: { itemId }, fields: shipmentFields(deliverable) }} /> : null}
                  {shipment && canReturn && returnable > 0 ? <DomainForm definition={definition} resourceId={orderId} busy={busy} runAction={runAction} spec={{ title: text('确认退货并入库', 'Confirm return and restock'), action: 'admin-return-order-item', payloadBase: { itemId }, fields: shipmentFields(returnable) }} /> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
