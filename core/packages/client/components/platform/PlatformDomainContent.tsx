'use client';

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import AppLink from '@/components/AppLink';
import { VisualCube } from '@/components/VisualCube';
import { useT } from '@/hooks/useT';
import { loadPlatformLessonMedia, type PlatformLessonMedia } from '@/lib/platform-gateway';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import { PLATFORM_COURSE_SECTIONS } from '@/lib/platform-routes';
import { PlatformQrLanding } from './PlatformQrLanding';
import { LessonVideoPlayer } from '@/components/video/LessonVideoPlayer';

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

// Section pages: directory and video titles omit the section prefix but keep lesson numbers.
// Display only: preserve source titles and full titles outside a section context.
function sectionLessonTitle(title: string, section: typeof PLATFORM_COURSE_SECTIONS[number]): string {
  const prefixes = [section.title.zh, section.title.en, section.title.en.replace(/s$/, ''), section.title.en.replace(/ lessons$/, '')];
  for (const prefix of prefixes) {
    if (!title.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const remainder = title.slice(prefix.length).trimStart();
    if (/^\d/.test(remainder)) return remainder;
  }
  return title;
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

function DomainList({ title, items, href, showStatus = true }: {
  title: string;
  items: unknown[];
  href?: (item: Record<string, unknown>) => string | null;
  showStatus?: boolean;
}) {
  const t = useT();
  if (!items.length) return <p className="platform-domain-note">{t('当前没有可展示的内容。', 'There is no content to display yet.')}</p>;
  const english = t('zh', 'en') === 'en';
  const list = (
    <div className="platform-detail-list">
      {items.map((raw, index) => {
        const item = record(raw) ?? {};
        const id = string(item.id) ?? string(item.slug) ?? String(index + 1);
        const label = localized(item, 'title', english) ?? string(item.displayName) ?? string(item.name) ?? string(item.label) ?? string(item.code) ?? id;
        const detail = localized(item, 'summary', english) ?? (showStatus ? string(item.status) ?? string(item.sku) : null);
        const target = href?.(item) ?? null;
        return (
          <div key={id}>
            <strong>{target ? <AppLink href={target} prefetch={false}>{label}</AppLink> : label}</strong>
            {detail ? <span>{detail}</span> : null}
          </div>
        );
      })}
    </div>
  );
  return <section className="platform-domain-content"><h2>{title}</h2>{list}</section>;
}

function LessonMedia({ lessonId, autoContinue, onAutoContinueChange, onNext, onPrevious, autoPlay, startTime }: {
  lessonId: string;
  startTime?: number;
  autoContinue?: boolean;
  onAutoContinueChange?: (enabled: boolean) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  autoPlay?: boolean;
}) {
  const t = useT();
  const [media, setMedia] = useState<PlatformLessonMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const resume = useRef({ time: 0, playing: false });
  const refreshing = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setMedia(null);
    setError(null);
    void loadPlatformLessonMedia(lessonId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) { refreshing.current = false; setMedia(value); }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [lessonId, reload]);
  const onError = (event: SyntheticEvent<HTMLMediaElement>) => {
    resume.current = { time: event.currentTarget.currentTime, playing: !event.currentTarget.paused };
    // Renew authorization only after expiry; unsupported codecs must not cause a retry loop.
    if (media && Date.parse(media.expiresAt) <= Date.now() && !refreshing.current) {
      refreshing.current = true;
      setReload(value => value + 1);
    } else setError(t('播放失败，请重新加载后再试。', 'Playback failed. Reload and try again.'));
  };
  const onLoadedMetadata = (event: SyntheticEvent<HTMLMediaElement>) => {
    const element = event.currentTarget;
    if (resume.current.time > 0) element.currentTime = resume.current.time;
    if (resume.current.playing) void element.play().catch(() => { /* Native play control remains available. */ });
  };
  if (error) return <div className="platform-domain-note">
    <p>{t('课时媒体暂时无法加载：', 'Lesson media could not be loaded: ')}{error}</p>
    <button type="button" className="platform-action-link" onClick={() => setReload(value => value + 1)}>{t('重新加载播放器', 'Reload player')}</button>
  </div>;
  if (!media) return <p className="platform-domain-note">{t('正在取得课时媒体访问权限。', 'Requesting lesson media access.')}</p>;
  if (media.mimeType.startsWith('video/')) return <LessonVideoPlayer src={media.accessUrl} onError={onError} onLoadedMetadata={onLoadedMetadata}
    lessonId={lessonId} mediaId={media.mediaId} mimeType={media.mimeType} startTime={startTime}
    autoContinue={autoContinue} onAutoContinueChange={onAutoContinueChange} onNext={onNext} onPrevious={onPrevious} autoPlay={autoPlay} />;
  if (media.mimeType.startsWith('audio/')) return <audio className="platform-lesson-media" controls preload="metadata" src={media.accessUrl} onError={onError} onLoadedMetadata={onLoadedMetadata} />;
  return <a className="platform-action-link" href={media.accessUrl} target="_blank" rel="noreferrer">{t('打开课时媒体', 'Open lesson media')}</a>;
}

function OrderItems({ items, status }: { items: unknown[]; status?: string }) {
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
          const competitionId = record(snapshot.competition) && string(snapshot.eventId);
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
                : competitionId
                  ? status === 'fulfilled' ? t('报名已确认，请前往比赛查看场次和检录。', 'Your entry is confirmed. Open the competition for your session and check-in.')
                    : status === 'pending_payment' ? t('付款后确认报名，预留名额以订单有效期为准。', 'Payment confirms your entry. Your place is reserved until the order expires.')
                      : t('报名状态请在比赛页面查看。', 'Check your entry status on the competition page.')
                  : status === 'fulfilled' ? t(`数量 ${quantity}，已发放`, `Quantity ${quantity}, fulfilled`)
                    : t(`数量 ${quantity}`, `Quantity ${quantity}`)}</span>
              {competitionId ? <AppLink href={`/platform/events/online/${encodeURIComponent(competitionId)}`} prefetch={false}>{t('查看比赛与报名', 'View competition and entry')}</AppLink> : null}
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

export function PlatformDomainContent({ definition, entity, params, previewRedirect, selectedLessonId, onSelectLesson, lessonStartTime }: {
  definition: PlatformRouteDefinition;
  entity?: PlatformEntity;
  params: Record<string, string>;
  previewRedirect?: boolean;
  selectedLessonId?: string | null;
  lessonStartTime?: number;
  onSelectLesson?: (id: string) => void;
}) {
  const t = useT();
  const [autoContinue, setAutoContinue] = useState(false);
  const [autoPlayLessonId, setAutoPlayLessonId] = useState<string | null>(null);
  if (!entity?.data) return null;
  const data = entity.data;
  const english = t('zh', 'en') === 'en';

  const selectedSection = PLATFORM_COURSE_SECTIONS.find(section => definition.id === `course-section-${section.slug}`);
  if (definition.id === 'course-detail' || selectedSection) {
    const lessons = Array.isArray(data.lessons) ? data.lessons.map(raw => {
      const lesson = record(raw);
      const titleZh = string(lesson?.titleZh);
      // Keep existing lesson data readable after the introduction label change.
      return lesson && titleZh ? { ...lesson, titleZh: titleZh.replace(/^先导课/, PLATFORM_COURSE_SECTIONS[0].title.zh) } : raw;
    }) : [];
    const instructors = Array.isArray(data.instructors) ? data.instructors : [];
    // Group explicitly numbered sections only; unrelated course outlines stay unchanged.
    const sections = PLATFORM_COURSE_SECTIONS.map(section => section.title.zh);
    const grouped = sections.map(() => [] as unknown[]);
    const canGroup = lessons.length > 0 && lessons.every((lesson) => {
      const title = string(record(lesson)?.titleZh) ?? '';
      const section = sections.findIndex(prefix => title.startsWith(prefix));
      if (section < 0) return false;
      grouped[section].push(lesson);
      return true;
    });
    const lessonHref = (item: Record<string, unknown>) => {
      const lessonId = string(item.id) ?? string(item.slug);
      return lessonId ? `/platform/courses/${encodeURIComponent(entity.id)}/learn/${encodeURIComponent(lessonId)}` : null;
    };
    if (selectedSection) {
      // Invalid or stale query IDs fall back to the first lesson in this section.
      const sectionLessons = lessons.flatMap(raw => {
        const lesson = record(raw);
        const id = string(lesson?.id);
        return lesson && id && (string(lesson.titleZh) ?? '').startsWith(selectedSection.title.zh)
          ? [{ id, title: sectionLessonTitle(localized(lesson, 'title', english) ?? t('未命名课时', 'Untitled lesson'), selectedSection) }] : [];
      });
      const active = sectionLessons.find(lesson => lesson.id === selectedLessonId) ?? sectionLessons[0];
      if (!active) return <p className="platform-domain-note">{t('暂无课时。', 'No lessons yet.')}</p>;
      const activeIndex = sectionLessons.findIndex(lesson => lesson.id === active.id);
      const playLesson = (index: number) => {
        const lesson = sectionLessons[index];
        if (lesson && onSelectLesson) { setAutoPlayLessonId(lesson.id); onSelectLesson(lesson.id); }
      };
      return <div className="platform-classroom">
        <nav className="platform-classroom-directory platform-glass" aria-label={t('课时目录', 'Lesson directory')}>
          <h2>{t('课时目录', 'Lesson directory')}</h2>
          <div className="platform-classroom-lessons">{sectionLessons.map(lesson => <button
            key={lesson.id} className="platform-classroom-lesson" type="button" aria-current={lesson.id === active.id ? 'true' : undefined}
            onClick={() => { setAutoPlayLessonId(null); onSelectLesson?.(lesson.id); }}
          >{lesson.title}</button>)}</div>
        </nav>
        <section className="platform-classroom-stage" aria-label={t('课程视频', 'Lesson video')}>
          <h2 aria-live="polite">{active.title}</h2>
          <div className="platform-classroom-player"><LessonMedia key={active.id} lessonId={active.id} startTime={lessonStartTime}
            autoContinue={autoContinue} onAutoContinueChange={onSelectLesson ? setAutoContinue : undefined} autoPlay={autoPlayLessonId === active.id}
            onPrevious={onSelectLesson && activeIndex > 0 ? () => playLesson(activeIndex - 1) : undefined}
            onNext={onSelectLesson && activeIndex < sectionLessons.length - 1 ? () => playLesson(activeIndex + 1) : undefined} /></div>
        </section>
      </div>;
    }
    return (
      <div className="platform-domain-stack platform-course-outline" id="platform-course-outline">
        {canGroup ? <section className="platform-domain-content">
          <h2>{t('课程课时', 'Course lessons')}</h2>
          <div className="platform-lesson-grid">{grouped.map((items, index) => items.length > 0 ? <AppLink
            key={sections[index]}
            className="platform-lesson-card"
            href={`/platform/courses/${encodeURIComponent(entity.id)}/sections/${PLATFORM_COURSE_SECTIONS[index].slug}`} prefetch={false}
          >
            <span className={`platform-lesson-cover platform-lesson-cover-${index}`} aria-hidden="true">
              {index === 0 && data.slug === 'yan-ruimin-3x3-beginner'
                ? <img className="platform-lesson-cover-photo" src="/images/ruimin/gallery/photo-03.webp" alt="" loading="lazy" />
                : <VisualCube view={index === 1 ? 'f2l' : 'iso'} size={144} local alt="" />}
              <span className="platform-lesson-cover-number">0{index + 1}</span>
            </span>
            <span className="platform-lesson-card-title">{t(PLATFORM_COURSE_SECTIONS[index].title.zh, PLATFORM_COURSE_SECTIONS[index].title.en)}</span>
          </AppLink> : null)}</div>
        </section> : <DomainList
          title={t('课程课时', 'Course lessons')}
          items={lessons}
          href={lessonHref}
          showStatus={false}
        />}
        <DomainList title={t('授课讲师', 'Instructors')} items={instructors} href={(item) => {
          const teacherId = string(item.teacherEntryId);
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
        {mediaId ? <LessonMedia key={entity.id} lessonId={entity.id} startTime={lessonStartTime} /> : null}
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
        <OrderItems items={lines} status={string(data.status) ?? undefined} />
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
    return <PlatformQrLanding entity={entity} previewRedirect={previewRedirect} />;
  }

  void params;
  return null;
}
