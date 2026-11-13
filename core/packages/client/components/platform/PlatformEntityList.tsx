'use client';

import { ArrowRight } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { entityStatusLabel } from '@/components/teaching/TeachingUi';
import { useT } from '@/hooks/useT';
import { PLATFORM_ACTION_LABELS } from '@/lib/platform-gateway';
import type { PlatformActionId, PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import { localDetailHref } from './PlatformRouteHelpers';

function favoriteType(definition: PlatformRouteDefinition, item: PlatformEntity): 'course' | 'product' | 'event' | 'news' {
  const explicit = item.data?.targetType;
  if (explicit === 'product' || explicit === 'event' || explicit === 'news') return explicit;
  if (definition.resource === 'products') return 'product';
  if (definition.resource === 'events') return 'event';
  if (definition.resource === 'news') return 'news';
  return 'course';
}

function platformStatusLabel(status: string, t: ReturnType<typeof useT>) {
  const labels: Record<string, [string, string]> = {
    pending: ['待处理', 'Pending'], approved: ['已批准', 'Approved'], rejected: ['已拒绝', 'Rejected'],
    submitted: ['已提交', 'Submitted'], failed: ['失败', 'Failed'], paid: ['已付款', 'Paid'],
    unpaid: ['待付款', 'Unpaid'], refunded: ['已退款', 'Refunded'], partially_refunded: ['部分退款', 'Partially refunded'],
    paid_out: ['已结算', 'Paid out'], reconciled: ['已对账', 'Reconciled'], unresolved: ['待核对', 'Unresolved'],
    resolved: ['已处理', 'Resolved'], disabled: ['已停用', 'Disabled'], sold_out: ['已售罄', 'Sold out'],
    issued: ['已签发', 'Issued'], not_started: ['未开始', 'Not started'],
  };
  return labels[status] ? t(...labels[status]) : entityStatusLabel(status, t);
}

function entityDisplayFields(item: PlatformEntity, t: ReturnType<typeof useT>): { label: string; value: string }[] {
  const data = item.data ?? {};
  const fields: { label: string; value: string }[] = [];
  const currency = typeof data.currency === 'string' && /^[A-Z]{3}$/.test(data.currency) ? data.currency : 'CNY';
  const price = data.baseAmountMinor ?? data.fromAmountMinor ?? data.amountMinor;
  if (price != null && Number.isFinite(Number(price))) fields.push({ label: t('价格', 'Price'), value: new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(price) / 100) });
  const memberPrice = data.memberAmountMinor ?? data.fromMemberAmountMinor;
  if (memberPrice != null && Number.isFinite(Number(memberPrice))) fields.push({ label: t('会员价', 'Member price'), value: new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(memberPrice) / 100) });
  const labels: Record<string, string> = {
    category: t('分类', 'Category'), brand: t('品牌', 'Brand'), level: t('难度', 'Level'),
    lessonCount: t('课时', 'Lessons'), studentCount: t('学员', 'Learners'), code: t('编码', 'Code'),
    displayName: t('姓名', 'Name'), recipientName: t('获得者', 'Recipient'), email: t('邮箱', 'Email'),
    phone: t('电话', 'Phone'), scanCount: t('扫码次数', 'Scans'), points: t('积分', 'Points'),
    available: t('可用数量', 'Available'), capacity: t('名额', 'Capacity'), action: t('操作', 'Action'),
    orderNumber: t('订单号', 'Order number'), provider: t('支付渠道', 'Payment provider'),
    note: t('备注', 'Note'), resolutionNote: t('处理说明', 'Resolution'),
  };
  for (const [key, label] of Object.entries(labels)) {
    const value = data[key];
    if (typeof value === 'string' && value.trim() || typeof value === 'number') fields.push({ label, value: String(value) });
  }
  for (const [key, label] of [['startsAt', t('开始时间', 'Starts')], ['endsAt', t('结束时间', 'Ends')], ['publishedAt', t('发布日期', 'Published')], ['occurredAt', t('时间', 'Time')]] as const) {
    const raw = data[key];
    if (typeof raw === 'string' && Number.isFinite(Date.parse(raw))) fields.push({ label, value: new Date(raw).toLocaleString(t('zh-CN', 'en-US')) });
  }
  return fields;
}

export function PlatformEntityList({
  definition,
  items,
  redeemedCourseIds,
  onAction,
  actionBusy,
}: {
  definition: PlatformRouteDefinition;
  items: PlatformEntity[];
  redeemedCourseIds: ReadonlySet<string>;
  onAction: (action: PlatformActionId, id: string, payload?: Record<string, unknown>) => void;
  actionBusy: string | null;
}) {
  const t = useT();
  const baseActions = definition.kind === 'collection' || definition.kind === 'dashboard'
    ? (definition.actions ?? []).filter((action) => ['favorite', 'wishlist', 'enroll', 'cancel-order', 'delete-course', 'delete-note'].includes(action))
    : [];
  const quickActions: PlatformActionId[] = [
    ...baseActions,
    ...(definition.id === 'admin-qr' ? ['qr-toggle' as const] : []),
    ...(['admin-paths', 'admin-events', 'admin-news', 'admin-products', 'admin-teachers'].includes(definition.id) ? ['admin-delete' as const] : []),
  ];
  const learnerCourses = ['courses', 'account-courses'].includes(definition.id);
  // Course API fields and publication statuses are not learner-facing content.
  const learnerContent = learnerCourses || definition.id === 'course-lesson';
  const orderContent = definition.resource === 'orders' || definition.resource === 'admin-orders';
  const orderStatuses: Record<string, string> = {
    pending_payment: t('待付款', 'Awaiting payment'), paid: t('已付款', 'Paid'),
    partially_fulfilled: t('部分完成', 'Partially fulfilled'), fulfilled: t('已完成', 'Completed'),
    cancelled: t('已取消', 'Cancelled'), expired: t('已过期', 'Expired'), refunded: t('已退款', 'Refunded'),
  };
  return (
    <div className={`platform-entity-list${learnerCourses ? ' platform-course-list' : ''}`}>
      {items.map((item) => {
        const href = item.href?.startsWith('/') ? item.href : localDetailHref(definition, item);
        const title = orderContent ? String(item.data?.orderNumber ?? item.title) : item.title;
        const amount = Number(item.data?.totalAmountMinor);
        const currency = typeof item.data?.currency === 'string' ? item.data.currency : '';
        const fields = orderContent ? [
          ...(Number.isFinite(amount) && /^[A-Z]{3}$/.test(currency) ? [{ label: t('订单金额', 'Order total'), value: amount === 0 ? t('免费', 'Free') : new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100) }] : []),
          ...(typeof item.data?.createdAt === 'string' ? [{ label: t('下单时间', 'Created'), value: new Date(item.data.createdAt).toLocaleString(t('zh-CN', 'en-US')) }] : []),
        ] : entityDisplayFields(item, t);
        return (
          <article className="platform-entity" key={item.id}>
            <div className="platform-entity-heading">
              <div>
                {item.eyebrow ? <span>{item.eyebrow}</span> : null}
                <h2>{href ? <AppLink href={href} prefetch={false}>{title}</AppLink> : title}</h2>
              </div>
              {learnerCourses && redeemedCourseIds.has(item.id) ? <span className="platform-course-redeemed">{t('已兑换', 'Redeemed')}</span> : null}
              {!learnerContent && item.status ? <span className="platform-status">{orderContent ? orderStatuses[item.status] ?? t('等待确认', 'Awaiting confirmation') : platformStatusLabel(item.status, t)}</span> : null}
            </div>
            {item.summary ? <p>{item.summary}</p> : null}
            {fields?.length ? (
              <dl>
                {fields.map((field) => (
                  <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                ))}
              </dl>
            ) : null}
            {learnerCourses && href ? <AppLink className="platform-home-secondary" href={href} prefetch={false}>{t('查看课程', 'View course')}<ArrowRight aria-hidden /></AppLink> : null}
            {quickActions.length ? (
              <div className="platform-row-actions">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="platform-text-button"
                    disabled={actionBusy === `${action}:${item.id}`}
                    onClick={() => {
                      if (action === 'admin-delete' && !window.confirm(t('确定归档这条记录吗？', 'Archive this record?'))) return;
                      if (action === 'delete-course' && !window.confirm(t('确定归档这门课程吗？', 'Archive this course?'))) return;
                      if (action === 'cancel-order' && !window.confirm(t('确定取消这笔订单吗？', 'Cancel this order?'))) return;
                      if (action === 'delete-note' && !window.confirm(t('确定删除这条笔记吗？', 'Delete this note?'))) return;
                      const payload = action === 'favorite'
                        ? { targetType: favoriteType(definition, item), active: definition.id !== 'account-favorites' }
                        : action === 'wishlist'
                          ? { active: definition.id !== 'account-wishlist' }
                          : action === 'qr-toggle'
                            ? { disabled: item.data?.status !== 'disabled' }
                            : undefined;
                      onAction(action, item.id, payload);
                    }}
                  >
                    {actionBusy === `${action}:${item.id}` ? t('处理中…', 'Working…') : t(PLATFORM_ACTION_LABELS[action].zh, PLATFORM_ACTION_LABELS[action].en)}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
