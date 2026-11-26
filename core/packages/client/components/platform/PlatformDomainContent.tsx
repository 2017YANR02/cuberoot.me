'use client';

import { competitionHref } from '@/lib/competition-links';
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import AppLink from '@/components/AppLink';
import { VisualCube } from '@/components/VisualCube';
import { useT } from '@/hooks/useT';
import { nextQuery, useIsAdmin } from '@/lib/auth-store';
import { persistItem } from '@/lib/safe-storage';
import { courseCatalogDetails, courseLessonAccess } from '@/lib/platform-course-catalog';
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

function LessonGate({ status, courseId, enrollmentMode, courseCover }: {
  status: 401 | 403; courseId: string; enrollmentMode?: string; courseCover?: string;
}) {
  const t = useT();
  if (status === 403) {
    const invite = enrollmentMode === 'invite';
    const href = invite ? '/platform/account/invites' : `/platform/courses/${encodeURIComponent(courseId)}${['purchase', 'free'].includes(enrollmentMode ?? '') ? '#platform-course-access' : ''}`;
    const action = invite ? t('兑换课程', 'Redeem course') : enrollmentMode === 'purchase' ? t('前往购买课程', 'Buy this course')
      : enrollmentMode === 'free' ? t('前往免费报名', 'Enroll for free') : t('查看课程与解锁方式', 'View course and access options');
    return <div className="platform-locked-media">
      <div className="platform-locked-media-visual" aria-hidden="true">{courseCover ? <img src={courseCover} alt="" /> : <VisualCube view="iso" size={240} local alt="" />}</div>
      <AppLink className="platform-locked-media-action" href={href} prefetch={false}>{action}</AppLink>
    </div>;
  }
  const href = `/account${nextQuery(`${window.location.pathname}${window.location.search}`)}`;
  return <div className="platform-domain-note">
    <p>{t('请先登录，再继续观看这个课时。', 'Sign in to continue watching this lesson.')}</p>
    <AppLink className="platform-action-link" href={href} prefetch={false}>
      {t('前往登录', 'Go to sign in')}
    </AppLink>
  </div>;
}

function LessonMedia({ lessonId, courseId, enrollmentMode, courseCover, autoContinue, onAutoContinueChange, onNext, onPrevious, autoPlay, startTime, posterOverride, onVideoElement }: {
  lessonId: string;
  courseId: string;
  enrollmentMode?: string;
  courseCover?: string;
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
  const [transitionFrame, setTransitionFrame] = useState<string>();
  const element = useRef<HTMLMediaElement | null>(null);
  const resume = useRef<{ time: number; playing: boolean; rate: number; volume: number; muted: boolean } | null>(null);
  const attachVideo = useCallback((video: HTMLVideoElement | null) => { element.current = video; onVideoElement?.(video); }, [onVideoElement]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let pending = false;
    let expires = Infinity;
    const renew = async () => {
      if (pending || controller.signal.aborted) return;
      clearTimeout(timer);
      pending = true;
      try {
        const value = await loadPlatformLessonMedia(lessonId, controller.signal);
        if (controller.signal.aborted) return;
        const player = element.current;
        if (player) resume.current ??= {
          time: player.currentTime, playing: !player.paused && !player.ended,
          rate: player.playbackRate, volume: player.volume, muted: player.muted,
        };
        if (player instanceof HTMLVideoElement && player.videoWidth && player.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            const frame = document.createElement('canvas');
            frame.width = Math.min(player.videoWidth, 640);
            frame.height = Math.round(frame.width * player.videoHeight / player.videoWidth);
            frame.getContext('2d')?.drawImage(player, 0, 0, frame.width, frame.height);
            setTransitionFrame(frame.toDataURL('image/jpeg', 0.8));
          } catch { /* The browser may restrict reading frames from a cross-origin source. */ }
        }
        setMedia(value);
        setError(null);
        expires = Date.parse(value.expiresAt);
        const delay = expires - Date.now() - 60_000;
        if (delay > 0) timer = setTimeout(() => void renew(), Math.min(delay, 2_147_483_647));
      } catch (reason) {
        if (controller.signal.aborted) return;
        if (reason instanceof PlatformPermissionError || !element.current?.src || expires <= Date.now()) {
          setError(reason instanceof Error ? reason : new Error(String(reason)));
        } else {
          timer = setTimeout(() => void renew(), 15_000);
        }
      } finally { pending = false; }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && expires - Date.now() <= 60_000) void renew();
    };
    void renew();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [lessonId, reload]);
  const onError = (event: SyntheticEvent<HTMLMediaElement>) => {
    const player = event.currentTarget;
    if (media && Date.parse(media.expiresAt) <= Date.now()) {
      if (resume.current) return;
      resume.current = { time: player.currentTime, playing: !player.paused && !player.ended, rate: player.playbackRate, volume: player.volume, muted: player.muted };
      setReload(value => value + 1);
    } else {
      setError(new Error(t('播放失败，请重新加载后再试。', 'Playback failed. Reload and try again.')));
    }
  };
  const onLoadedMetadata = (event: SyntheticEvent<HTMLMediaElement>) => {
    const player = event.currentTarget;
    const previous = resume.current;
    resume.current = null;
    if (!previous) return;
    player.currentTime = Number.isFinite(player.duration) ? Math.min(previous.time, player.duration) : previous.time;
    player.playbackRate = previous.rate;
    player.volume = previous.volume;
    player.muted = previous.muted;
    if (previous.playing) void player.play().catch(() => {});
  };
  if (error instanceof PlatformPermissionError) return <LessonGate status={error.status} courseId={courseId} enrollmentMode={enrollmentMode} courseCover={courseCover} />;
  if (error) return <div className="platform-domain-note">
    <p>{t('课时媒体暂时无法加载：', 'Lesson media could not be loaded: ')}{error.message}</p>
    <button type="button" className="platform-action-link" onClick={() => { resume.current = null; setTransitionFrame(undefined); setError(null); setMedia(null); setReload(value => value + 1); }}>{t('重新加载播放器', 'Reload player')}</button>
  </div>;
  if (!media) return <p className="platform-domain-note">{t('正在取得课时媒体访问权限。', 'Requesting lesson media access.')}</p>;
  if (media.mimeType.startsWith('video/')) return <LessonVideoPlayer src={platformMediaBrowserUrl(media.accessUrl)} poster={posterOverride ?? (media.posterUrl ? platformMediaBrowserUrl(media.posterUrl) : undefined)} onError={onError} onLoadedMetadata={onLoadedMetadata}
    lessonId={lessonId} mediaId={media.mediaId} mimeType={media.mimeType} startTime={resume.current ? 0 : startTime}
    transitionFrame={transitionFrame} onFrameReady={() => setTransitionFrame(undefined)}
    autoContinue={autoContinue} onAutoContinueChange={onAutoContinueChange} onNext={onNext} onPrevious={onPrevious} autoPlay={autoPlay && !resume.current} onVideoElement={attachVideo} />;
  if (media.mimeType.startsWith('audio/')) return <audio ref={audio => { element.current = audio; }} className="platform-lesson-media" controls preload="metadata" src={media.accessUrl} onError={onError} onLoadedMetadata={onLoadedMetadata} />;
  return <a className="platform-action-link" href={media.accessUrl} target="_blank" rel="noreferrer">{t('打开课时媒体', 'Open lesson media')}</a>;
}

function OrderItems({ items, status, learner }: { items: unknown[]; status?: string; learner: boolean }) {
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
          const paid = learner && (status === 'paid' || status === 'fulfilled');
          const courseId = item.sellableType === 'course' ? string(item.courseId) ?? string(snapshot.id) : null;
          const lessonId = string(item.learningLessonId);
          const learningHref = paid && courseId ? `/platform/courses/${encodeURIComponent(courseId)}${lessonId ? `/learn/${encodeURIComponent(lessonId)}` : ''}`
            : paid && (item.sellableType === 'platform_membership' || item.sellableType === 'course_membership') ? '/platform/account/courses' : null;
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
              {learningHref && <AppLink className="platform-button platform-button-primary" href={learningHref} prefetch={false}>
                {courseId ? t('开始学习', 'Start learning') : t('查看我的课程', 'View my courses')}
              </AppLink>}
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

function ClassroomLessonStage({ title, courseId, lessonId, enrollmentMode, hasMedia, canEditCover, startTime, autoContinue, onAutoContinueChange, autoPlay, onPrevious, onNext, onVideoElement, denied, courseCover }: {
  title: string;
  courseId: string;
  lessonId: string;
  enrollmentMode?: string;
  hasMedia: boolean;
  denied?: 401 | 403;
  courseCover?: string;
  canEditCover: boolean;
  startTime?: number;
  autoContinue?: boolean;
  onAutoContinueChange?: (enabled: boolean) => void;
  autoPlay?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onVideoElement?: (video: HTMLVideoElement | null) => void;
}) {
  const t = useT();
  const [posterOverride, setPosterOverride] = useState<string>();
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const attachVideo = useCallback((element: HTMLVideoElement | null) => { setVideoElement(element); onVideoElement?.(element); }, [onVideoElement]);
  return <section className="platform-classroom-stage" aria-label={title}>
    <div className="platform-classroom-stage-heading">
      <h2 aria-live="polite">{title}</h2>
      {canEditCover && hasMedia && !denied ? <PlatformLessonCoverEditor
        scope="admin"
        courseId={courseId}
        lessonId={lessonId}
        currentVideo
        videoElement={videoElement}
        onCoverUpdated={(posterUrl) => { if (posterUrl) setPosterOverride(posterUrl); }}
      /> : null}
    </div>
    {denied ? <div className="platform-classroom-player">
      {denied === 403 && <p>{t('这个课时需要解锁。', 'This lesson requires access.')}</p>}
      <LessonGate status={denied} courseId={courseId} enrollmentMode={enrollmentMode} courseCover={courseCover} />
    </div> : hasMedia ? <div className="platform-classroom-player"><LessonMedia
      lessonId={lessonId}
      courseId={courseId}
      enrollmentMode={enrollmentMode}
      courseCover={courseCover}
      startTime={startTime}
      autoContinue={autoContinue}
      onAutoContinueChange={onAutoContinueChange}
      autoPlay={autoPlay}
      onPrevious={onPrevious}
      onNext={onNext}
      posterOverride={posterOverride}
      onVideoElement={attachVideo}
    /></div> : null}
  </section>;
}

// Direct lesson navigation may remount the classroom. Carry autoplay in memory for that arrival.
let classroomAutoplay: { course: string; lesson: string; expires: number } | undefined;

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
  useEffect(() => {
    try { setAutoContinue(localStorage.getItem('platform.lesson.autoplay') === 'true'); } catch {}
  }, []);
  const updateAutoContinue = (enabled: boolean) => {
    setAutoContinue(enabled);
    persistItem('platform.lesson.autoplay', String(enabled));
  };
  const [autoPlayLessonId, setAutoPlayLessonId] = useState<string | null>(null);
  useEffect(() => {
    const arrival = classroomAutoplay;
    if (!arrival || arrival.course !== params.id || arrival.lesson !== params.lessonId) return;
    classroomAutoplay = undefined;
    if (arrival.expires > Date.now()) setAutoPlayLessonId(arrival.lesson);
  }, [params.id, params.lessonId]);
  const [localLessonId, setLocalLessonId] = useState<string | null>(null);
  if (['product-detail', 'event-detail', 'news-detail', 'admin', 'admin-event-analytics'].includes(definition.id)) return <PlatformCommerceContent definition={definition} entity={entity} />;
  if (!entity?.data) return null;
  const data = entity.data;
  const english = t('zh', 'en') === 'en';

  if (definition.id === 'admin-application') {
    return <InstructorApplicationDetails entity={entity} admin />;
  }

  const selectedSection = PLATFORM_COURSE_SECTIONS.find(section => definition.id === `course-section-${section.slug}`);
  const directLesson = definition.id === 'course-lesson';
  if (definition.id === 'course-detail' || selectedSection || (directLesson && Array.isArray(data.lessons))) {
    const lessons = Array.isArray(data.lessons) ? data.lessons.flatMap(raw => {
      const lesson = record(raw);
      const titleZh = string(lesson?.titleZh);
      return lesson ? [titleZh ? { ...lesson, titleZh: titleZh.replace(/^先导课/, PLATFORM_COURSE_SECTIONS[0].title.zh) } : lesson] : [];
    }) : [];
    if (!selectedSection && !directLesson) return <PlatformCourseDetail course={entity} lessons={lessons} />;

    const { canWatch, entries } = courseLessonAccess(data);
    const progress = new Map(entries.map(item => [item.id, item.status]));
    const trialLessonIds = platformTrialLessonIds(data.presentation);
    const directory = PLATFORM_COURSE_SECTIONS.flatMap(section => lessons.flatMap(lesson => {
      const id = string(lesson.id) ?? string(lesson.slug);
      if (!id || platformCourseLessonSection(lesson, trialLessonIds) !== section.slug) return [];
      const title = sectionLessonTitle(localized(lesson, 'title', english) ?? t('未命名课时', 'Untitled lesson'), section);
      return [{
        id, slug: lesson.slug, title, titleZh: title, titleEn: title, section: section.title,
        sectionId: section.slug, locked: !canWatch(id, lesson.accessScope),
        status: string(progress.get(id)) ?? undefined, durationSeconds: Number(lesson.durationSeconds) || undefined,
        trial: lesson.accessScope === 'public',
      }];
    }));
    const sectionIds = selectedSection ? platformCourseSectionsIncludedBy(selectedSection.slug).map(section => section.slug) : [];
    const defaults = selectedSection ? directory.filter(item => sectionIds.includes(item.sectionId)) : directory;
    const requested = selectedLessonId ?? localLessonId ?? (directLesson ? params.lessonId : undefined);
    const active = (requested ? directory.find(item => item.id === requested || item.slug === requested) : undefined)
      ?? (directLesson && requested ? undefined : defaults.find(item => !item.locked) ?? defaults[0]);
    if (!active) return <p className="platform-domain-note">{t('暂无课时。', 'No lessons yet.')}</p>;
    const chooseLesson = onSelectLesson ?? setLocalLessonId;
    const select = (id: string) => { classroomAutoplay = undefined; setAutoPlayLessonId(null); chooseLesson(id); };
    const next = directory.slice(directory.indexOf(active) + 1).find(item => !item.locked);
    return <PlatformClassroom key={active.id} courseId={entity.id} lessonId={active.id}
      lessons={directory} locked={active.locked} startTime={lessonStartTime} onSelectLesson={select}
      renderMedia={mediaProps => <ClassroomLessonStage {...mediaProps} title={active.title} courseId={entity.id}
        enrollmentMode={string(data.enrollmentMode) ?? undefined} courseCover={courseCatalogDetails(entity).coverUrl}
        canEditCover={isAdmin} autoContinue={autoContinue} onAutoContinueChange={updateAutoContinue}
        autoPlay={autoPlayLessonId === active.id}
        onNext={next ? () => {
          if (directLesson && onSelectLesson) classroomAutoplay = { course: params.id, lesson: next.id, expires: Date.now() + 15_000 };
          setAutoPlayLessonId(next.id);
          chooseLesson(next.id);
        } : undefined} />} />;
  }

  if (directLesson) {
    return <PlatformClassroom key={entity.id} courseId={params.id} lessonId={entity.id} startTime={lessonStartTime}
      renderMedia={mediaProps => <ClassroomLessonStage {...mediaProps} title={entity.title} courseId={params.id} canEditCover={isAdmin} />} />;
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
        <OrderItems items={lines} status={string(data.status) ?? undefined} learner={definition.id === 'order-detail'} />
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
