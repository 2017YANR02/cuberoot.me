'use client';

import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { loadPlatformLessonMedia, type PlatformLessonMedia } from '@/lib/platform-gateway';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function string(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function localized(item: Record<string, unknown>, stem: string, english: boolean): string | null {
  return string(item[english ? `${stem}En` : `${stem}Zh`])
    ?? string(item[english ? `${stem}Zh` : `${stem}En`])
    ?? string(item[stem]);
}

function readableJson(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object') return null;
  const values: string[] = [];
  const visit = (current: unknown) => {
    if (typeof current === 'string' && current.trim()) values.push(current.trim());
    else if (Array.isArray(current)) current.forEach(visit);
    else if (current && typeof current === 'object') Object.values(current as Record<string, unknown>).forEach(visit);
  };
  visit(value);
  return values.length ? values.join('\n\n') : null;
}

function DomainList({ title, items, href }: {
  title: string;
  items: unknown[];
  href?: (item: Record<string, unknown>) => string | null;
}) {
  const t = useT();
  if (!items.length) return <p className="platform-domain-note">{t('当前没有可展示的内容。', 'There is no content to display yet.')}</p>;
  const english = t('zh', 'en') === 'en';
  return (
    <section className="platform-domain-content">
      <h2>{title}</h2>
      <div className="platform-detail-list">
        {items.map((raw, index) => {
          const item = record(raw) ?? {};
          const id = string(item.id) ?? string(item.slug) ?? String(index + 1);
          const label = localized(item, 'title', english) ?? string(item.name) ?? string(item.label) ?? string(item.code) ?? id;
          const detail = localized(item, 'summary', english) ?? string(item.status) ?? string(item.sku);
          const target = href?.(item) ?? null;
          return (
            <div key={id}>
              <strong>{target ? <AppLink href={target} prefetch={false}>{label}</AppLink> : label}</strong>
              {detail ? <span>{detail}</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LessonMedia({ lessonId }: { lessonId: string }) {
  const t = useT();
  const [media, setMedia] = useState<PlatformLessonMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void loadPlatformLessonMedia(lessonId, controller.signal)
      .then(setMedia)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [lessonId]);
  if (error) return <p className="platform-domain-note">{t('课时媒体暂时无法加载：', 'Lesson media could not be loaded: ')}{error}</p>;
  if (!media) return <p className="platform-domain-note">{t('正在取得课时媒体访问权限。', 'Requesting lesson media access.')}</p>;
  if (media.mimeType.startsWith('video/')) return <video className="platform-lesson-media" controls preload="metadata" src={media.accessUrl} />;
  if (media.mimeType.startsWith('audio/')) return <audio className="platform-lesson-media" controls preload="metadata" src={media.accessUrl} />;
  return <a className="platform-action-link" href={media.accessUrl} target="_blank" rel="noreferrer">{t('打开课时媒体', 'Open lesson media')}</a>;
}

function OrderItems({ items }: { items: unknown[] }) {
  const t = useT();
  const english = t('zh', 'en') === 'en';
  if (!items.length) return <p className="platform-domain-note">{t('订单没有项目。', 'This order has no items.')}</p>;
  return (
    <section className="platform-domain-content">
      <h2>{t('订单项目与履约', 'Order items and fulfillment')}</h2>
      <div className="platform-detail-list">
        {items.map((raw, index) => {
          const item = record(raw) ?? {};
          const snapshot = record(item.snapshot) ?? {};
          const fulfillment = record(item.fulfillment) ?? {};
          const events = Array.isArray(fulfillment.events) ? fulfillment.events : [];
          const label = localized(snapshot, 'title', english) ?? localized(snapshot, 'name', english) ?? string(snapshot.sku) ?? string(item.sellableType) ?? t('订单项目', 'Order item');
          const quantity = Number(item.quantity ?? 0);
          const shipped = Number(fulfillment.shippedQuantity ?? 0);
          const delivered = Number(fulfillment.deliveredQuantity ?? 0);
          const returned = Number(fulfillment.returnedQuantity ?? 0);
          return (
            <div key={string(item.id) ?? String(index)}>
              <strong>{label}</strong>
              <span>{item.fulfillmentType === 'shipment'
                ? t(`共 ${quantity}，已发 ${shipped}，已送达 ${delivered}，已退回 ${returned}`, `${quantity} total, ${shipped} shipped, ${delivered} delivered, ${returned} returned`)
                : t(`数量 ${quantity}，支付成功后自动发放`, `Quantity ${quantity}, granted automatically after payment`)}</span>
              {events.map((eventRaw, eventIndex) => {
                const event = record(eventRaw) ?? {};
                const type = string(event.type) ?? t('履约', 'Fulfillment');
                const reference = string(event.externalReference);
                const details = [string(event.carrier), string(event.trackingNumber), string(event.note)].filter((value): value is string => Boolean(value));
                return <span key={string(event.id) ?? String(eventIndex)}>{type} {Number(event.quantity ?? 0)}{reference ? ` #${reference}` : ''}{details.length ? ` — ${details.join(' / ')}` : ''}</span>;
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PlatformDomainContent({ definition, entity, params }: {
  definition: PlatformRouteDefinition;
  entity?: PlatformEntity;
  params: Record<string, string>;
}) {
  const t = useT();
  if (!entity?.data) return null;
  const data = entity.data;
  const english = t('zh', 'en') === 'en';

  if (definition.id === 'course-detail') {
    const lessons = Array.isArray(data.lessons) ? data.lessons : [];
    const instructors = Array.isArray(data.instructors) ? data.instructors : [];
    return (
      <div className="platform-domain-stack">
        <DomainList
          title={t('课程课时', 'Course lessons')}
          items={lessons}
          href={(item) => {
            const lessonId = string(item.id) ?? string(item.slug);
            return lessonId ? `/platform/courses/${encodeURIComponent(entity.id)}/learn/${encodeURIComponent(lessonId)}` : null;
          }}
        />
        <DomainList title={t('授课讲师', 'Instructors')} items={instructors} href={(item) => {
          const teacherId = string(item.teacherEntryId) ?? string(item.id);
          return teacherId ? `/platform/teachers/${encodeURIComponent(teacherId)}` : null;
        }} />
      </div>
    );
  }

  if (definition.id === 'course-lesson') {
    const body = readableJson(data[english ? 'bodyEn' : 'bodyZh']) ?? readableJson(data[english ? 'bodyZh' : 'bodyEn']);
    const mediaId = string(data.mediaId);
    return body || mediaId ? (
      <section className="platform-domain-content platform-prose">
        <h2>{t('课时内容', 'Lesson content')}</h2>
        {body ? body.split('\n\n').map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>) : null}
        {mediaId ? <LessonMedia lessonId={entity.id} /> : null}
      </section>
    ) : null;
  }

  if (definition.id === 'path-detail') {
    return <DomainList title={t('路径内容', 'Path contents')} items={Array.isArray(data.items) ? data.items : []} href={(item) => {
      const courseId = string(item.courseId) ?? (item.itemType === 'course' ? string(item.itemId) : null);
      return courseId ? `/platform/courses/${encodeURIComponent(courseId)}` : null;
    }} />;
  }

  if (definition.id === 'event-detail') {
    return <DomainList title={t('活动票种', 'Ticket types')} items={Array.isArray(data.tickets) ? data.tickets : []} />;
  }

  if (definition.id === 'product-detail') {
    return <DomainList title={t('商品规格', 'Product variants')} items={Array.isArray(data.variants) ? data.variants : []} />;
  }

  if (definition.id === 'news-detail') {
    const body = readableJson(data[english ? 'bodyEn' : 'bodyZh']) ?? readableJson(data[english ? 'bodyZh' : 'bodyEn']);
    return body ? <section className="platform-domain-content platform-prose"><h2>{t('资讯正文', 'Article')}</h2>{body.split('\n\n').map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}</section> : null;
  }

  if (definition.id === 'order-detail' || definition.id === 'admin-order') {
    const lines = Array.isArray(data.items) ? data.items : Array.isArray(data.lines) ? data.lines : [];
    const payments = Array.isArray(data.paymentAttempts) ? data.paymentAttempts : [];
    const refunds = Array.isArray(data.refunds) ? data.refunds : [];
    return (
      <div className="platform-domain-stack">
        <OrderItems items={lines} />
        {payments.length ? <DomainList title={t('支付记录', 'Payment attempts')} items={payments} /> : null}
        {refunds.length ? <DomainList title={t('退款记录', 'Refunds')} items={refunds} /> : null}
      </div>
    );
  }

  if (definition.id === 'certificate') {
    const recipient = string(data.recipientName) ?? string(data.displayName);
    const course = localized(data, 'courseTitle', english);
    if (!recipient && !course) return null;
    return <section className="platform-domain-content"><h2>{t('验证结果', 'Verification result')}</h2><dl>{recipient ? <div><dt>{t('获得者', 'Recipient')}</dt><dd>{recipient}</dd></div> : null}{course ? <div><dt>{t('课程', 'Course')}</dt><dd>{course}</dd></div> : null}</dl></section>;
  }

  if (definition.id === 'qr') {
    const target = string(data.targetValue) ?? string(data.target);
    return target ? <section className="platform-domain-content"><h2>{t('二维码目标', 'QR destination')}</h2><p>{target}</p></section> : null;
  }

  void params;
  return null;
}
