'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, BookOpen, Building2, CalendarDays, ChevronLeft, ChevronRight, GraduationCap, Pause, Play } from '@app-foundation/icons/lucide';
import type { PlatformHomeSlide } from '@cuberoot/shared/platform';
import { useT } from '@/hooks/useT';
import AppLink from '@/components/AppLink';
import { homeContentHref, homeContentKey, homeContentLabels, homeSectionLabels, homepageCatalogSlide, loadHomepageSlides, safeHomepageCover } from '@/lib/platform-homepage';
import { loadPlatformResource } from '@/lib/platform-gateway';
import { courseCatalogDetails, firstPlatformTrialLessonId } from '@/lib/platform-course-catalog';
import { commerceRecord } from '@/lib/platform-commerce-format';
import { platformCourseLessonSection } from '@/lib/platform-routes';
import { platformTrialLessonIds } from '@cuberoot/shared/platform';
import type { PlatformEntity } from '@/lib/platform-types';
import { PlatformCourseLabels } from './PlatformCourseCatalog';

const ICONS = { course: BookOpen, teacher: GraduationCap, organization: Building2, event: CalendarDays };
const NO_EXCLUSIONS: ReadonlySet<string> = new Set();

export function PlatformHomepageCarousel({ excludedCourseIds = NO_EXCLUSIONS }: { excludedCourseIds?: ReadonlySet<string> }) {
  const t = useT();
  const [sourceSlides, setSourceSlides] = useState<PlatformHomeSlide[]>([]);
  const [catalogFallback, setCatalogFallback] = useState<PlatformHomeSlide[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [courseDetails, setCourseDetails] = useState<Record<string, PlatformEntity>>({});
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void loadHomepageSlides(controller.signal).then(items => { if (!controller.signal.aborted) setSourceSlides(items); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const filtered = useMemo(() => sourceSlides.filter(item => item.type !== 'course' || !excludedCourseIds.has(item.id)), [sourceSlides, excludedCourseIds]);
  const needsFallback = sourceSlides.some(item => item.type === 'course' && excludedCourseIds.has(item.id)) && !filtered.some(item => item.type === 'course');
  useEffect(() => {
    setCatalogFallback([]);
    if (!needsFallback) return;
    const controller = new AbortController();
    void loadPlatformResource('courses', { params: {}, page: 1, pageSize: 60, signal: controller.signal }).then(({ items }) => {
      if (!controller.signal.aborted) setCatalogFallback(items.filter(item => item.status === 'published' && !excludedCourseIds.has(item.id)).slice(0, 3).map(homepageCatalogSlide));
    }).catch(() => {});
    return () => controller.abort();
  }, [needsFallback, excludedCourseIds]);
  const slides = useMemo(() => [...filtered, ...(needsFallback ? catalogFallback.filter(item => !excludedCourseIds.has(item.id)) : [])], [filtered, needsFallback, catalogFallback, excludedCourseIds]);
  useEffect(() => { setIndex(0); }, [slides]);
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => { if (reduced?.matches) setPlaying(false); };
    const visibility = () => setVisible(!document.hidden);
    update(); visibility();
    reduced?.addEventListener('change', update);
    document.addEventListener('visibilitychange', visibility);
    return () => { reduced?.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (slides.length < 2 || !playing || hovered || focused || !visible) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % slides.length), 8000);
    return () => window.clearInterval(timer);
  }, [slides.length, playing, hovered, focused, visible]);

  const active = slides[index] ?? slides[0];
  const activeCourseId = active?.type === 'course' ? active.id : undefined;
  const course = activeCourseId ? courseDetails[activeCourseId] : undefined;
  useEffect(() => {
    if (!activeCourseId || course) return;
    const controller = new AbortController();
    void loadPlatformResource('courses', { params: { id: activeCourseId }, signal: controller.signal }).then(result => {
      if (!controller.signal.aborted && result.items[0]) setCourseDetails(prev => ({ ...prev, [activeCourseId]: result.items[0]! }));
    }).catch(() => {});
    return () => controller.abort();
  }, [activeCourseId, course]);
  if (!active) return null;
  const count = slides.length;
  const choose = (next: number) => { setPlaying(false); setIndex((next + count) % count); };
  const cover = safeHomepageCover(active.coverUrl);
  const title = t(active.titleZh || active.titleEn, active.titleEn || active.titleZh);
  const summary = t(active.summaryZh || active.summaryEn, active.summaryEn || active.summaryZh);
  const label = homeSectionLabels[active.section];
  const contentLabel = homeContentLabels[active.type];
  const Icon = ICONS[active.type];
  const data = course?.data;
  const details = course && courseCatalogDetails(course);
  const presentation = commerceRecord(data?.presentation);
  const lessons = Array.isArray(data?.lessons) ? data.lessons.map(commerceRecord) : [];
  const trialIds = platformTrialLessonIds(presentation);
  const previews = lessons.filter(lesson => typeof lesson.id === 'string' && lesson.accessScope === 'public' && platformCourseLessonSection(lesson, trialIds) === 'trial');
  const introductionCount = lessons.filter(lesson => platformCourseLessonSection(lesson, trialIds) === 'introduction').length;
  const duration = lessons.length && lessons.every(lesson => typeof lesson.durationSeconds === 'number' && Number.isFinite(lesson.durationSeconds) && lesson.durationSeconds > 0)
    ? Math.ceil(lessons.reduce((sum, lesson) => sum + Number(lesson.durationSeconds), 0) / 60) : null;
  const highlights = Array.isArray(presentation.highlights) ? presentation.highlights.filter((item): item is string => typeof item === 'string' && !!item.trim()) : [];
  const audience = details ? t(details.audience.zh, details.audience.en) : '';
  const target = details ? t(details.target.zh, details.target.en) : '';
  const trialId = course ? firstPlatformTrialLessonId(course) : undefined;
  const action = trialId ? t('免费试听', 'Free preview') : active.type === 'course' ? t('了解课程', 'Explore course') : active.type === 'teacher' ? t('认识讲师', 'Meet instructor')
    : active.type === 'organization' ? t('了解机构', 'Explore school') : t('查看活动', 'View event');

  return <section className="platform-home-carousel" aria-label={t('学习空间推荐', 'Learning space recommendations')} aria-roledescription={t('轮播', 'carousel')}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onKeyDown={event => { if (count > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); choose(index + (event.key === 'ArrowRight' ? 1 : -1)); } }}>
    <div className="platform-teacher-feature platform-carousel-slide"
      onTouchStart={event => { const point = event.touches[0]; if (point) { touch.current = { x: point.clientX, y: point.clientY }; setPlaying(false); } }}
      onTouchEnd={event => {
        const start = touch.current, end = event.changedTouches[0]; touch.current = null;
        if (!start || !end || count < 2) return;
        const dx = end.clientX - start.x, dy = end.clientY - start.y;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) choose(index + (dx < 0 ? 1 : -1));
      }} onTouchCancel={() => { touch.current = null; }}>
      <div className="platform-carousel-media">
        <Icon className="platform-carousel-placeholder" aria-hidden="true" strokeWidth={1} />
        {cover && <Image key={homeContentKey(active)} className="platform-feature-photo" src={cover} fill sizes="(max-width: 700px) 100vw, 580px" alt="" unoptimized={!cover.startsWith('/')} loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
      </div>
      <div className="platform-feature-copy">
        <span className="platform-feature-caption">{t(label.zh, label.en)}{active.section === 'featured' ? ` · ${t(contentLabel.zh, contentLabel.en)}` : ''}</span>
        <h2>{title}</h2>
        {active.instructorNames && <small className="platform-carousel-instructors">{active.instructorNames}</small>}
        {summary && <p className="platform-carousel-summary">{summary}</p>}
        {details && <>
          <PlatformCourseLabels details={details} />
          {audience && <p>{t('适合人群', 'Suitable for')} · {audience}</p>}
          {target && <p>{t('目标水平', 'Target level')} · {target}</p>}
          {!target && highlights[0] && <p>{t('课程亮点', 'Course highlight')}：{highlights[0]}</p>}
          <p className="platform-carousel-course-meta">{[lessons.length ? t(`${introductionCount} 节引言 + ${lessons.length - introductionCount} 节正式课`, `${introductionCount} introductions + ${lessons.length - introductionCount} core lessons`) : details.lessonCount != null ? t(`${details.lessonCount} 课时`, `${details.lessonCount} lessons`) : null, duration != null ? t(`共 ${duration} 分钟`, `${duration} minutes`) : null, previews.length ? t(`含 ${previews.length} 节免费试听`, `Includes ${previews.length} free previews`) : lessons.length ? t('未设置免费试听', 'No free previews') : null].filter(Boolean).join(' · ')}</p>
        </>}
        <AppLink className="platform-button" href={trialId ? `${homeContentHref(active)}/sections/core?lesson=${encodeURIComponent(trialId)}` : homeContentHref(active)} prefetch={false}>{action}<ArrowRight aria-hidden /></AppLink>
      </div>
      {count > 1 && <div className="platform-carousel-arrows">
        <button type="button" className="platform-button" aria-label={t('上一张', 'Previous slide')} onClick={() => choose(index - 1)}><ChevronLeft aria-hidden /></button>
        <button type="button" className="platform-button" aria-label={t('下一张', 'Next slide')} onClick={() => choose(index + 1)}><ChevronRight aria-hidden /></button>
      </div>}
    </div>
    {count > 1 && <div className="platform-carousel-controls">
      <div className="platform-carousel-dots" aria-label={t('选择推荐内容', 'Choose recommendation')}>
        {slides.map((item, i) => <button className="platform-carousel-dot" key={homeContentKey(item)} type="button" aria-label={`${i + 1}. ${t(item.titleZh || item.titleEn, item.titleEn || item.titleZh)}`}
          aria-current={i === index ? 'true' : undefined} onClick={() => choose(i)}><span /></button>)}
      </div>
      <button type="button" className="platform-carousel-play" aria-label={playing ? t('暂停轮播', 'Pause slideshow') : t('播放轮播', 'Play slideshow')} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
    </div>}
  </section>;
}
