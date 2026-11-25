'use client';

import { competitionHref } from '@/lib/competition-links';
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import AppLink from '@/components/AppLink';
import { VisualCube } from '@/components/VisualCube';
import { useT } from '@/hooks/useT';
import { nextQuery, useIsAdmin } from '@/lib/auth-store';
import { courseLessonAccess } from '@/lib/platform-course-catalog';
import { loadPlatformLessonMedia, platformMediaBrowserUrl, PlatformPermissionError, type PlatformLessonMedia } from '@/lib/platform-gateway';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import { PLATFORM_COURSE_SECTIONS, platformCourseLessonSection, platformCourseSectionsIncludedBy } from '@/lib/platform-routes';
import { platformTrialLessonIds } from '@cuberoot/shared/platform';
import { PlatformQrLanding } from './PlatformQrLanding';
import { PlatformLessonCoverEditor } from './PlatformLessonCoverEditor';
import { PlatformClassroom } from './PlatformClassroom';
import { PlatformCourseDetail } from './PlatformCourseDetail';
import { PlatformLearningPath, PlatformCertificate } from './PlatformLearningWorkspace';
import { PlatformCommerceContent } from './PlatformCommerceContent';
import { LessonVideoPlayer } from '@/components/video/LessonVideoPlayer';
import { InstructorApplicationDetails } from './PlatformInstructorApplication';

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

function LessonMedia({ lessonId, courseSlug, autoContinue, onAutoContinueChange, onNext, onPrevious, autoPlay, startTime, posterOverride, onVideoElement }: {
  lessonId: string;
  courseSlug?: string;
  startTime?: number;
  autoContinue?: boolean;
  onAutoContinueChange?: (enabled: boolean) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  autoPlay?: boolean;
  posterOverride?: string;
  onVideoElement?: (element: HTMLVideoElement | null) => void;
}) {
  const t = useT();
  const [media, setMedia] = useState<PlatformLessonMedia | null>(null);
  const [error, setError] = useState<Error | null>(null);
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
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason)));
      });
    return () => controller.abort();
  }, [lessonId, reload]);
  const onError = (event: SyntheticEvent<HTMLMediaElement>) => {
    resume.current = { time: event.currentTarget.currentTime, playing: !event.currentTarget.paused };
    // Renew authorization only after expiry; unsupported codecs must not cause a retry loop.
    if (media && Date.parse(media.expiresAt) <= Date.now() && !refreshing.current) {
      refreshing.current = true;
      setReload(value => value + 1);
    } else setError(new Error(t('播放失败，请重新加载后再试。', 'Playback failed. Reload and try again.')));
  };
  const onLoadedMetadata = (event: SyntheticEvent<HTMLMediaElement>) => {
    const element = event.currentTarget;
    if (resume.current.time > 0) element.currentTime = resume.current.time;
    if (resume.current.playing) void element.play().catch(() => { /* Native play control remains available. */ });
  };
  if (error instanceof PlatformPermissionError && error.status === 403) {
    return <div className="platform-locked-media">
      <div className="platform-locked-media-visual" aria-hidden="true">
        {courseSlug === 'yan-ruimin-3x3-beginner'
          ? <img src="/images/ruimin/gallery/photo-03.webp" alt="" />
          : <VisualCube view="iso" size={240} local alt="" />}
      </div>
      <AppLink className="platform-locked-media-action" href="/platform/account/invites" prefetch={false}>
        {t('兑换课程', 'Redeem course')}
      </AppLink>
    </div>;
  }
  if (error instanceof PlatformPermissionError) {
    const href = `/account${nextQuery(`${window.location.pathname}${window.location.search}`)}`;
    return <div className="platform-domain-note">
      <p>{t('请先登录，再继续观看这个课时。', 'Sign in to continue watching this lesson.')}</p>
      <AppLink className="platform-action-link" href={href} prefetch={false}>
        {t('前往登录', 'Go to sign in')}
      </AppLink>
    </div>;
  }
  if (error) return <div className="platform-domain-note">
    <p>{t('课时媒体暂时无法加载：', 'Lesson media could not be loaded: ')}{error.message}</p>
    <button type="button" className="platform-action-link" onClick={() => setReload(value => value + 1)}>{t('重新加载播放器', 'Reload player')}</button>
  </div>;
  if (!media) return <p className="platform-domain-note">{t('正在取得课时媒体访问权限。', 'Requesting lesson media access.')}</p>;
  if (media.mimeType.startsWith('video/')) return <LessonVideoPlayer src={platformMediaBrowserUrl(media.accessUrl)} poster={posterOverride ?? (media.posterUrl ? platformMediaBrowserUrl(media.posterUrl) : undefined)} onError={onError} onLoadedMetadata={onLoadedMetadata}
    lessonId={lessonId} mediaId={media.mediaId} mimeType={media.mimeType} startTime={startTime}
    autoContinue={autoContinue} onAutoContinueChange={onAutoContinueChange} onNext={onNext} onPrevious={onPrevious} autoPlay={autoPlay} onVideoElement={onVideoElement} />;
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
              {competitionId ? <AppLink href={competitionHref(competitionId)} prefetch={false}>{t('查看比赛与报名', 'View competition and entry')}</AppLink> : null}
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

function ClassroomLessonStage({ title, courseId, lessonId, courseSlug, canEditCover, startTime, autoContinue, onAutoContinueChange, autoPlay, onPrevious, onNext, onVideoElement }: {
  title: string;
  courseId: string;
  lessonId: string;
  courseSlug?: string;
  canEditCover: boolean;
  startTime?: number;
  autoContinue?: boolean;
  onAutoContinueChange?: (enabled: boolean) => void;
  autoPlay?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onVideoElement?: (video: HTMLVideoElement | null) => void;
}) {
  const [posterOverride, setPosterOverride] = useState<string>();
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const attachVideo = useCallback((element: HTMLVideoElement | null) => { setVideoElement(element); onVideoElement?.(element); }, [onVideoElement]);
  return <section className="platform-classroom-stage" aria-label={title}>
    <div className="platform-classroom-stage-heading">
      <h2 aria-live="polite">{title}</h2>
      {canEditCover ? <PlatformLessonCoverEditor
        scope="admin"
        courseId={courseId}
        lessonId={lessonId}
        currentVideo
        videoElement={videoElement}
        onCoverUpdated={(posterUrl) => { if (posterUrl) setPosterOverride(posterUrl); }}
      /> : null}
    </div>
    <div className="platform-classroom-player"><LessonMedia
      lessonId={lessonId}
      courseSlug={courseSlug}
      startTime={startTime}
      autoContinue={autoContinue}
      onAutoContinueChange={onAutoContinueChange}
      autoPlay={autoPlay}
      onPrevious={onPrevious}
      onNext={onNext}
      posterOverride={posterOverride}
      onVideoElement={attachVideo}
    /></div>
  </section>;
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
  const isAdmin = useIsAdmin();
  const [autoContinue, setAutoContinue] = useState(false);
  const [autoPlayLessonId, setAutoPlayLessonId] = useState<string | null>(null);
  if (['product-detail', 'event-detail', 'news-detail', 'admin', 'admin-event-analytics'].includes(definition.id)) return <PlatformCommerceContent definition={definition} entity={entity} />;
  if (!entity?.data) return null;
  const data = entity.data;
  const english = t('zh', 'en') === 'en';

  if (definition.id === 'admin-application') {
    return <InstructorApplicationDetails entity={entity} admin />;
  }

  const selectedSection = PLATFORM_COURSE_SECTIONS.find(section => definition.id === `course-section-${section.slug}`);
  if (definition.id === 'course-detail' || selectedSection) {
    const lessons = Array.isArray(data.lessons) ? data.lessons.map(raw => {
      const lesson = record(raw);
      const titleZh = string(lesson?.titleZh);
      // Keep existing lesson data readable after the introduction label change.
      return lesson && titleZh ? { ...lesson, titleZh: titleZh.replace(/^先导课/, PLATFORM_COURSE_SECTIONS[0].title.zh) } : raw;
    }) : [];
    if (selectedSection) {
      const { canWatch } = courseLessonAccess(data);
      const trialLessonIds = platformTrialLessonIds(data.presentation);
      // Invalid or stale query IDs fall back to the first lesson in this section.
      const sectionLessons = platformCourseSectionsIncludedBy(selectedSection.slug).flatMap(section => lessons.flatMap(raw => {
        const lesson = record(raw);
        const id = string(lesson?.id) ?? string(lesson?.slug);
        if (!lesson || !id || platformCourseLessonSection(lesson, trialLessonIds) !== section.slug) return [];
        return [{
          id,
          title: sectionLessonTitle(localized(lesson, 'title', english) ?? t('未命名课时', 'Untitled lesson'), section),
          locked: !canWatch(id, lesson.accessScope),
        }];
      }));
      const active = sectionLessons.find(lesson => lesson.id === selectedLessonId)
        ?? sectionLessons.find(lesson => !lesson.locked)
        ?? sectionLessons[0];
      if (!active) return <p className="platform-domain-note">{t('暂无课时。', 'No lessons yet.')}</p>;
      if (active.locked) return <div className="platform-domain-note">
        <p>{t('这个课时需要解锁。', 'This lesson requires access.')}</p>
        <AppLink className="platform-button" href={`/platform/courses/${encodeURIComponent(entity.id)}`} prefetch={false}>
          {t('查看课程与解锁方式', 'View course and access options')}
        </AppLink>
      </div>;
      return <PlatformClassroom key={active.id} courseId={entity.id} lessonId={active.id}
        lessons={sectionLessons.map(item => ({ id: item.id, titleZh: item.title, titleEn: item.title, locked: item.locked }))}
        startTime={lessonStartTime} onSelectLesson={onSelectLesson ? id=>{setAutoPlayLessonId(null);onSelectLesson(id);} : undefined}
        renderMedia={mediaProps=><ClassroomLessonStage {...mediaProps} title={active.title} courseId={entity.id} courseSlug={string(data.slug)??undefined}
          canEditCover={isAdmin} autoContinue={autoContinue} onAutoContinueChange={setAutoContinue} autoPlay={autoPlayLessonId===active.id}
          onNext={mediaProps.onNext ? () => {
            const activeIndex = sectionLessons.findIndex(item => item.id === active.id);
            const next = sectionLessons.slice(activeIndex + 1).find(item => !item.locked);
            if (!next) return;
            setAutoPlayLessonId(next.id);
            onSelectLesson?.(next.id);
          } : undefined} />} />;
    }
    return <PlatformCourseDetail course={entity} lessons={lessons.flatMap(item => {
      const lesson = record(item);
      return lesson ? [lesson] : [];
    })} />;
  }

  if (definition.id === 'course-lesson') {
    return <PlatformClassroom key={entity.id} courseId={params.id} lessonId={entity.id} startTime={lessonStartTime}
      renderMedia={mediaProps=><ClassroomLessonStage {...mediaProps} title={entity.title} courseId={params.id} canEditCover={isAdmin} />} />;
  }
  if (definition.id === 'path-detail') return <PlatformLearningPath entity={entity} />;

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

  if (definition.id === 'certificate') return <PlatformCertificate entity={entity} code={params.code} />;

  if (definition.id === 'qr') {
    return <PlatformQrLanding entity={entity} previewRedirect={previewRedirect} />;
  }

  void params;
  return null;
}
