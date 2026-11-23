'use client';

import { ArrowRight, CalendarDays, MapPin, Plus, Trophy } from '@app-foundation/icons/lucide';
import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { entityStatusLabel } from '@/components/teaching/TeachingUi';
import { useT } from '@/hooks/useT';
import { PLATFORM_ACTION_LABELS } from '@/lib/platform-gateway';
import { courseCatalogDetails } from '@/lib/platform-course-catalog';
import type { PlatformActionId, PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import { instructorApplicationStatus, localDetailHref } from './PlatformRouteHelpers';
import { PlatformCourseCover, PlatformCourseLabels } from './PlatformCourseCatalog';
import { ContentReviewBadge } from './PlatformContentReview';
import { commerceMoney, commerceRecord } from '@/lib/platform-commerce-format';

function EventCards({ items }: { items: PlatformEntity[] }) {
  const t = useT();
  const [onlineIds, setOnlineIds] = useState<ReadonlySet<string> | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let active = true;
    setNow(Date.now());
    void import('@/lib/online-competition-api').then(api => api.listOnlineCompetitions()).then(result => {
      if (active) setOnlineIds(new Set(result.competitions.map(competition => competition.id)));
    }).catch(() => { if (active) setOnlineIds(new Set()); });
    return () => { active = false; };
  }, []);
  return <div className="platform-event-grid">{items.map(item => {
    const data = item.data ?? {};
    const venue = commerceRecord(data.venue);
    const competition = onlineIds?.has(item.id) === true;
    const online = venue.online === true || competition;
    const location = [venue.city, venue.name, venue.address].filter(Boolean).map(String).join(' · ');
    const starts = typeof data.startsAt === 'string' ? Date.parse(data.startsAt) : NaN;
    const ends = typeof data.endsAt === 'string' ? Date.parse(data.endsAt) : NaN;
    let date = '';
    if (Number.isFinite(starts)) {
      const options = { dateStyle: 'medium', timeStyle: 'short' } as const;
      try { date = new Intl.DateTimeFormat(t('zh-CN', 'en-US'), { ...options, timeZone: typeof data.timezone === 'string' ? data.timezone : 'UTC' }).format(starts); }
      catch { date = new Intl.DateTimeFormat(t('zh-CN', 'en-US'), { ...options, timeZone: 'UTC' }).format(starts); }
    }
    const state = now && Number.isFinite(ends) && now >= ends ? t('已结束', 'Ended') : now && Number.isFinite(starts) && now >= starts ? t('进行中', 'In progress') : t('即将开始', 'Upcoming');
    const price = typeof data.fromAmountMinor === 'number' || typeof data.fromAmountMinor === 'string' ? Number(data.fromAmountMinor) : NaN;
    const href = competition ? `/platform/events/online/${encodeURIComponent(item.id)}` : `/platform/events/${encodeURIComponent(item.id)}`;
    const content = <>
      <div className="platform-event-card-banner"><span className="platform-event-card-icon">{competition ? <Trophy aria-hidden /> : <CalendarDays aria-hidden />}</span><span className="platform-status">{state}</span></div>
      <div className="platform-event-card-content"><div className="platform-event-card-tags"><span>{online ? t('线上', 'Online') : t('线下', 'In person')}</span>{typeof data.category === 'string' && data.category && <span>{data.category}</span>}</div><h2>{item.title}</h2>
        {date && <p><CalendarDays size={16} aria-hidden />{date}</p>}{(online || location) && <p><MapPin size={16} aria-hidden />{online ? t('线上活动', 'Online event') : location}</p>}
        {item.summary && <p className="platform-event-summary">{item.summary}</p>}
        <div className="platform-event-card-footer"><strong>{Number.isFinite(price) ? price === 0 ? t('免费', 'Free') : `${commerceMoney(price, String(data.currency ?? 'CNY'))} ${t('起', 'and up')}` : t('查看详情', 'View details')}</strong><ArrowRight size={18} aria-hidden /></div></div></>;
    return <article className="platform-event-card" data-site-surface="panel" key={item.id}>
      {online && onlineIds === null ? <div className="platform-event-card-link" aria-busy>{content}</div> : <AppLink href={href} className="platform-event-card-link" prefetch={false}>{content}</AppLink>}
    </article>;
  })}</div>;
}

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
    unverified: ['未认证', 'Unverified'],
    submitted: ['已提交', 'Submitted'], failed: ['失败', 'Failed'], paid: ['已付款', 'Paid'],
    unpaid: ['待付款', 'Unpaid'], refunded: ['已退款', 'Refunded'], partially_refunded: ['部分退款', 'Partially refunded'],
    paid_out: ['已结算', 'Paid out'], reconciled: ['已对账', 'Reconciled'], unresolved: ['待核对', 'Unresolved'],
    resolved: ['已处理', 'Resolved'], disabled: ['已停用', 'Disabled'], sold_out: ['已售罄', 'Sold out'],
    issued: ['已签发', 'Issued'], not_started: ['未开始', 'Not started'], unlisted: ['不公开列出', 'Unlisted'],
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
  if (definition.id === 'events') return <EventCards items={items} />;
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
  if (definition.id === 'admin-applications') return <div className="platform-entity-list platform-application-list">
    {items.map(item => {
      const href = localDetailHref(definition, item);
      const application = item.data?.application as Record<string, unknown> | undefined;
      const specialties = Array.isArray(application?.specialties) ? application.specialties.filter((value): value is string => typeof value === 'string').join(t('、', ', ')) : '';
      const submitted = typeof item.data?.createdAt === 'string' && Number.isFinite(Date.parse(item.data.createdAt)) ? new Date(item.data.createdAt).toLocaleString(t('zh-CN', 'en-US'), { dateStyle: 'medium', timeStyle: 'short' }) : '';
      const pending = item.status === 'pending';
      return <article className="platform-entity platform-application-list-row" key={item.id}>
        <div className="platform-application-list-name"><h2>{item.title}</h2>{typeof item.data?.wcaId === 'string' && item.data.wcaId && <span>WCA ID: {item.data.wcaId}</span>}</div>
        <div className="platform-application-list-info">{specialties && <p>{specialties}</p>}{submitted && <span>{t('申请时间', 'Submitted')} <time dateTime={String(item.data?.createdAt)}>{submitted}</time></span>}</div>
        <span className="platform-status platform-application-status" data-application-state={item.status}>{instructorApplicationStatus(item.status ?? '', t)}</span>
        {href && <AppLink href={href} className="platform-button" prefetch={false} aria-label={pending ? t(`审核${item.title}的申请`, `Review ${item.title}'s application`) : t(`查看${item.title}的申请`, `View ${item.title}'s application`)}>{pending ? t('审核', 'Review') : t('查看', 'View')}<ArrowRight aria-hidden /></AppLink>}
      </article>;
    })}
  </div>;
  const orderStatuses: Record<string, string> = {
    pending_payment: t('待付款', 'Awaiting payment'), paid: t('已付款', 'Paid'),
    partially_fulfilled: t('部分完成', 'Partially fulfilled'), fulfilled: t('已完成', 'Completed'),
    cancelled: t('已取消', 'Cancelled'), expired: t('已过期', 'Expired'), refunded: t('已退款', 'Refunded'),
  };
  const instructorCourses = definition.id === 'instructor-courses';
  const renderActions = (item: PlatformEntity) => quickActions.length && !(definition.id === 'admin-teachers' && item.status === 'unverified') ? (
    <div className="platform-row-actions">
      {quickActions.map((action) => (
        <button key={action} type="button" className="platform-text-button"
          disabled={actionBusy === `${action}:${item.id}`}
          onClick={() => {
            if (action === 'admin-delete' && !window.confirm(t('确定归档这条记录吗？', 'Archive this record?'))) return;
            if (action === 'delete-course' && !window.confirm(t('确定归档这门课程吗？', 'Archive this course?'))) return;
            if (action === 'cancel-order' && !window.confirm(t('确定取消这笔订单吗？', 'Cancel this order?'))) return;
            if (action === 'delete-note' && !window.confirm(t('确定删除这条笔记吗？', 'Delete this note?'))) return;
            const payload = action === 'favorite'
              ? { targetType: favoriteType(definition, item), active: definition.id !== 'account-favorites' }
              : action === 'wishlist' ? { active: definition.id !== 'account-wishlist' }
                : action === 'qr-toggle' ? { disabled: item.data?.status !== 'disabled' } : undefined;
            onAction(action, item.id, payload);
          }}>
          {actionBusy === `${action}:${item.id}` ? t('处理中…', 'Working…') : t(PLATFORM_ACTION_LABELS[action].zh, PLATFORM_ACTION_LABELS[action].en)}
        </button>
      ))}
    </div>
  ) : null;
  return (
    <div className={`platform-entity-list${learnerCourses ? ' platform-course-list' : ''}${instructorCourses ? ' platform-instructor-course-list' : ''}`}>
      {items.map((item) => {
        const href = instructorCourses ? localDetailHref(definition, item) : item.href?.startsWith('/') ? item.href : localDetailHref(definition, item);
        const title = orderContent ? String(item.data?.orderNumber ?? item.title) : item.title;
        const amount = Number(item.data?.totalAmountMinor);
        const currency = typeof item.data?.currency === 'string' ? item.data.currency : '';
        const fields = orderContent ? [
          ...(Number.isFinite(amount) && /^[A-Z]{3}$/.test(currency) ? [{ label: t('订单金额', 'Order total'), value: amount === 0 ? t('免费', 'Free') : new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100) }] : []),
          ...(typeof item.data?.createdAt === 'string' ? [{ label: t('下单时间', 'Created'), value: new Date(item.data.createdAt).toLocaleString(t('zh-CN', 'en-US')) }] : []),
        ] : entityDisplayFields(item, t);
        if (instructorCourses && href) {
          const details = courseCatalogDetails(item);
          const lessonCount = Array.isArray(item.data?.lessons)
            ? item.data.lessons.filter(lesson => lesson && typeof lesson === 'object' && (lesson as Record<string, unknown>).status !== 'archived').length
            : details.lessonCount;
          const courseFields = lessonCount !== undefined && item.data?.lessonCount == null
            ? [{ label: t('课时', 'Lessons'), value: String(lessonCount) }, ...fields] : fields;
          return <article key={item.id} className="platform-instructor-course-card" data-site-surface="panel">
            <AppLink className="platform-instructor-course-card-main" href={href} prefetch={false}>
              <PlatformCourseCover {...details} />
              <div className="platform-instructor-course-card-info">
                <div className="platform-instructor-course-card-title">
                  <h2>{title}</h2>
                  {item.status && <span className="platform-status" data-course-status={item.status}>{platformStatusLabel(item.status, t)}</span>}
                  <ContentReviewBadge entity={item} />
                </div>
                <PlatformCourseLabels details={details} />
                {item.summary && item.summary.trim() !== title.trim() && <p className="platform-course-card-summary">{item.summary}</p>}
                {courseFields.length > 0 && <dl>{courseFields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>}
                <span className="platform-instructor-course-manage-link">{t('管理课程', 'Manage course')}<ArrowRight aria-hidden /></span>
              </div>
            </AppLink>
            {item.status !== 'archived' && <div className="platform-instructor-course-card-actions">
              <AppLink className="platform-button" href={`${href}/lessons/new`} prefetch={false}>{t('新增课时', 'Add lesson')}<Plus aria-hidden /></AppLink>
            </div>}
          </article>;
        }
        return (
          <article className="platform-entity" key={item.id}>
            <div className="platform-entity-heading">
              <div>
                {item.eyebrow ? <span>{item.eyebrow}</span> : null}
                <h2>{href ? <AppLink href={href} prefetch={false}>{title}</AppLink> : title}</h2>
              </div>
              {learnerCourses && redeemedCourseIds.has(item.id) ? <span className="platform-course-redeemed">{t('已兑换', 'Redeemed')}</span> : null}
              {!learnerContent && item.status ? <span className="platform-status">{orderContent ? orderStatuses[item.status] ?? t('等待确认', 'Awaiting confirmation') : platformStatusLabel(item.status, t)}</span> : null}
              {definition.id === 'admin-courses' && <><ContentReviewBadge entity={item} />{Array.isArray(item.data?.lessons) && item.data.lessons.some(lesson => !!lesson && typeof lesson === 'object' && 'reviewStatus' in lesson && lesson.reviewStatus === 'pending') && <span className="platform-status">{t('课时待审核', 'Lessons awaiting review')}</span>}</>}
            </div>
            {item.summary ? <p>{item.summary}</p> : null}
            {fields?.length ? (
              <dl>
                {fields.map((field) => (
                  <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                ))}
              </dl>
            ) : null}
            {learnerCourses && href ? <AppLink className="platform-button" href={href} prefetch={false}>{t('查看课程', 'View course')}<ArrowRight aria-hidden /></AppLink> : null}
            {renderActions(item)}
          </article>
        );
      })}
    </div>
  );
}
