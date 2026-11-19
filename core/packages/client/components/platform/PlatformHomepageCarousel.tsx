'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, BookOpen, Building2, CalendarDays, ChevronLeft, ChevronRight, GraduationCap, Pause, Play } from '@app-foundation/icons/lucide';
import type { PlatformHomeSlide } from '@cuberoot/shared/platform';
import { useT } from '@/hooks/useT';
import AppLink from '@/components/AppLink';
import { homeContentHref, homeContentKey, homeContentLabels, homeSectionLabels, loadHomepageSlides, safeHomepageCover } from '@/lib/platform-homepage';

const ICONS = { course: BookOpen, teacher: GraduationCap, organization: Building2, event: CalendarDays };

export function PlatformHomepageCarousel() {
  const t = useT();
  const [slides, setSlides] = useState<PlatformHomeSlide[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void loadHomepageSlides(controller.signal).then(items => { if (!controller.signal.aborted) setSlides(items); }).catch(() => {});
    return () => controller.abort();
  }, []);
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
  if (!active) return null;
  const count = slides.length;
  const choose = (next: number) => { setPlaying(false); setIndex((next + count) % count); };
  const cover = safeHomepageCover(active.coverUrl);
  const title = t(active.titleZh || active.titleEn, active.titleEn || active.titleZh);
  const summary = t(active.summaryZh || active.summaryEn, active.summaryEn || active.summaryZh);
  const label = homeSectionLabels[active.section];
  const contentLabel = homeContentLabels[active.type];
  const Icon = ICONS[active.type];
  const action = active.type === 'course' ? t('了解课程', 'Explore course') : active.type === 'teacher' ? t('认识讲师', 'Meet instructor')
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
      <Icon className="platform-carousel-placeholder" aria-hidden="true" strokeWidth={1} />
      {cover && <Image key={homeContentKey(active)} className="platform-feature-photo" src={cover} fill sizes="(max-width: 1160px) 100vw, 1120px" alt="" unoptimized={!cover.startsWith('/')} loading="eager" onError={event => { event.currentTarget.hidden = true; }} />}
      <span className="platform-feature-caption platform-glass">{t(label.zh, label.en)}{active.section === 'featured' ? ` · ${t(contentLabel.zh, contentLabel.en)}` : ''}</span>
      <div className="platform-feature-copy platform-glass">
        <h2>{title}</h2>
        {active.instructorNames && <small className="platform-carousel-instructors">{active.instructorNames}</small>}
        {summary && <p className="platform-carousel-summary">{summary}</p>}
        <AppLink className="platform-home-secondary" href={homeContentHref(active)} prefetch={false}>{action}<ArrowRight aria-hidden /></AppLink>
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
