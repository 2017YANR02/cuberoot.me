'use client';

import './onboarding-guide.css';
import { useT } from '@/hooks/useT';
import { TEXTS } from '@/lib/landing-sections';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Blocks, Box, ChevronLeft, ChevronRight, Film, Menu, Search, Timer, X, type LucideIcon,
} from '@app-foundation/icons/lucide';

type Copy = { zh: string; en: string };
interface Step {
  selector: string;
  Icon: LucideIcon;
  title: Copy;
  body: Copy;
}

const navigation = { zh: '网站导航', en: 'Site navigation' };
const steps: Step[] = [
  { selector: '.home-navigation-desktop', Icon: Menu, title: navigation,
    body: { zh: '悬停展开训练、学习等栏目的快捷入口，点击栏目查看总览。', en: 'Hover over a section such as Training or Learn for shortcuts, or select it to see the overview.' } },
  { selector: ':root[data-embedded-search-button] .home-navigation-toggle', Icon: Menu, title: navigation,
    body: { zh: '在「工具」页打开菜单查找功能，从底部切换到「计时」或「我的」。', en: 'Open the menu in Tools to browse features. Use the bottom bar to switch to Timer or Account.' } },
  { selector: ':root:not([data-embedded-search-button]) .home-navigation-toggle', Icon: Menu, title: navigation,
    body: { zh: '打开菜单，按训练、学习等栏目查找功能。', en: 'Open the menu to find features by section, such as Training or Learn.' } },
  { selector: '.landing-page > .landing-search .landing-search-controls', Icon: Search, title: { zh: '全站搜索', en: 'Site search' },
    body: { zh: '搜索功能、选手或比赛，直接打开对应结果。', en: 'Search for a tool, competitor or competition and open it from the results.' } },
  { selector: '.hero-grids a#card-timer', Icon: Timer, title: TEXTS.timer,
    body: { zh: '记录每次还原的用时，回看练习成绩。', en: 'Time your solves and review your practice results.' } },
  { selector: '.hero-grids a#card-algdb', Icon: Blocks, title: TEXTS.algdb,
    body: { zh: '按情况查找公式，播放动画查看每一步转动。', en: 'Find algorithms by case and play an animation to see each turn.' } },
  { selector: '.hero-grids a#card-sim', Icon: Box, title: TEXTS.sim,
    body: { zh: '在屏幕上转动魔方，观察每一步如何改变块的位置。', en: 'Turn a virtual puzzle to see how each move changes the positions of its pieces.' } },
  { selector: '.hero-grids a#card-recon', Icon: Film, title: TEXTS.recon,
    body: { zh: '按选手或成绩查找比赛复盘，查看一次还原的步骤。', en: 'Browse competition reconstructions and follow a solve move by move.' } },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function OnboardingGuideModal({ open, onClose }: Props) {
  return open ? <Tour onClose={onClose} /> : null;
}

function Tour({ onClose }: Pick<Props, 'onClose'>) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const bounds = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [selected, select] = useState(0);
  const [visible, setVisible] = useState<number[]>([]);
  const [layout, setLayout] = useState({ x: 0, y: 0, w: 0, h: 0, left: 0, top: 0, maxHeight: 0, radius: '0px' });
  const lastTarget = useRef<Element | null>(null);
  const active = visible.includes(selected) ? selected : visible.find(index => index >= selected) ?? visible.at(-1);
  const step = visible.indexOf(active ?? -1);
  const total = visible.length;
  const goPrev = () => select(visible[Math.max(0, step - 1)]);
  const goNext = () => select(visible[Math.min(total - 1, step + 1)]);

  useLayoutEffect(() => {
    const layer = dialog.current!;
    layer.showModal();
    return () => layer.close();
  }, []);

  useLayoutEffect(() => {
    const area = bounds.current!;
    const page = document.querySelector('.landing-page')!;
    const measure = () => {
      const entries = steps.flatMap(({ selector }, index) => {
        const target = page.querySelector<HTMLElement>(selector);
        return target && target.getClientRects().length && getComputedStyle(target).visibility === 'visible'
          ? [{ index, target }] : [];
      });
      const indices = entries.map(entry => entry.index);
      setVisible(prev => prev.length === indices.length && prev.every((id, i) => id === indices[i]) ? prev : indices);
      const entry = entries.find(item => item.index >= selected) ?? entries.at(-1);
      if (!entry) return;
      const target = entry.target;
      const available = area.getBoundingClientRect();
      let r = target.getBoundingClientRect();
      if (target !== lastTarget.current) {
        const firstTarget = lastTarget.current === null;
        lastTarget.current = target;
        const inView = r.top >= available.top && r.bottom <= available.bottom;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({
          block: inView ? 'nearest' : available.height < 480 ? 'start' : 'center',
          inline: 'nearest',
          behavior: firstTarget || reduceMotion ? 'instant' : 'smooth',
        });
        r = target.getBoundingClientRect();
      }
      const width = panel.current?.offsetWidth ?? Math.min(360, available.width);
      const naturalHeight = (panel.current?.scrollHeight ?? 0) + 2;
      const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
      const below = r.bottom + 12;
      const roomBelow = available.bottom - below;
      const roomAbove = r.top - 12 - available.top;
      const placeBelow = roomBelow >= naturalHeight || roomBelow >= roomAbove;
      const room = placeBelow ? roomBelow : roomAbove;
      const maxHeight = Math.min(available.height, room >= 100 ? room : available.height);
      const height = Math.min(naturalHeight, maxHeight);
      const top = placeBelow ? below : r.top - height - 12;
      const x = clamp(r.left, 0, window.innerWidth);
      const y = clamp(r.top, 0, available.bottom);
      const next = { x, y, maxHeight, w: Math.max(0, Math.min(r.right, window.innerWidth) - x),
        h: Math.max(0, Math.min(r.bottom, available.bottom) - y), radius: getComputedStyle(target).borderRadius,
        left: clamp(r.left + (r.width - width) / 2, available.left, available.right - width),
        top: clamp(top, available.top, available.bottom - height) };
      setLayout(prev => prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
        && prev.maxHeight === next.maxHeight && prev.left === next.left && prev.top === next.top && prev.radius === next.radius ? prev : next);
    };
    measure();
    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(area);
    observer.observe(page);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [selected, active]);

  const current = active === undefined ? undefined : steps[active];
  const StepIcon = current?.Icon ?? Menu;
  const isFirst = step === 0;
  const isLast = step === total - 1;
  const { x, y, w, h } = layout;
  const maskStyle: CSSProperties = { clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x}px ${y}px, ${x + w}px ${y}px, ${x + w}px ${y + h}px, ${x}px ${y + h}px, ${x}px ${y}px)` };
  return (
    <dialog ref={dialog} className="onboarding-guide-layer" aria-label={t('新手指南', 'Beginner guide')}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' && !isFirst) goPrev();
        if (event.key === 'ArrowRight' && !isLast) goNext();
      }}>
      <div className="onboarding-guide-mask" style={maskStyle} aria-hidden="true" onClick={onClose} />
      <div className="onboarding-guide-highlight" aria-hidden="true"
        style={{ left: x, top: y, width: w, height: h, borderRadius: layout.radius }} />
      <div ref={bounds} className="onboarding-guide-bounds">
        {current && <div ref={panel} className="onboarding-guide-card" data-site-surface="popover"
          style={{ left: layout.left, top: layout.top, maxHeight: layout.maxHeight || undefined }}>
          <div className="onboarding-guide-heading">
            <span className="onboarding-guide-icon"><StepIcon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
            <span className="onboarding-guide-count">{t('新手指南', 'Beginner guide')} <span>{step + 1} / {total}</span></span>
            <button type="button" onClick={onClose} className="onboarding-guide-button onboarding-guide-close" aria-label={t('关闭导览', 'Close tour')}><X size={18} aria-hidden="true" /></button>
          </div>
          <div className="onboarding-guide-copy" aria-live="polite" aria-atomic="true">
            <div key={active} className="onboarding-guide-step-copy">
              <h2>{t(current.title.zh, current.title.en)}</h2>
              <p>{t(current.body.zh, current.body.en)}</p>
            </div>
          </div>
          <div className="onboarding-guide-progress" role="progressbar" aria-label={t('导览进度', 'Tour progress')} aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}>
            <span style={{ width: ((step + 1) / total) * 100 + '%' }} />
          </div>
          <div className="onboarding-guide-actions">
            <button type="button" onClick={onClose} className="onboarding-guide-button onboarding-guide-skip">{t('跳过', 'Skip')}</button>
            <div className="onboarding-guide-navigation">
              {!isFirst && <button type="button" onClick={goPrev} className="onboarding-guide-button onboarding-guide-back" aria-label={t('上一步', 'Previous step')}><ChevronLeft size={17} aria-hidden="true" /></button>}
              <button type="button" onClick={isLast ? onClose : goNext} className="onboarding-guide-button onboarding-guide-next">
                {isLast ? t('完成', 'Done') : t('下一步', 'Next')}
                {!isLast && <ChevronRight size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>}
      </div>
    </dialog>
  );
}
