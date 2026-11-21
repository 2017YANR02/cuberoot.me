'use client';

import './onboarding-guide.css';
import { useT } from '@/hooks/useT';
import { TEXTS } from '@/lib/landing-sections';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Blocks, BookOpen, Box, Calendar, ChevronLeft, ChevronRight, Film, History,
  Menu, Search, Shuffle, Sigma, Timer, Trophy, X, type LucideIcon,
} from '@app-foundation/icons/lucide';

type Copy = { zh: string; en: string };
interface Step {
  selector: string;
  Icon: LucideIcon;
  title: Copy;
  body: Copy;
}

function card(id: string, title: Copy, Icon: LucideIcon, zh: string, en: string): Step {
  return { selector: `.hero-grids a#card-${id}`, title, Icon, body: { zh, en } };
}

const navigation = { zh: '网站导航', en: 'Site navigation' };
const steps: Step[] = [
  { selector: '.home-navigation-desktop', Icon: Menu, title: navigation,
    body: { zh: '将鼠标移到栏目上可展开快捷入口。点击栏目查看总览，点击 CubeRoot 标志回到首页。', en: 'Hover over a section to see its links, or select it to open the overview. Select the CubeRoot logo to return home.' } },
  { selector: ':root[data-embedded-search-button] .home-navigation-toggle', Icon: Menu, title: navigation,
    body: { zh: '在「工具」页打开这个菜单可按栏目找功能。底部可切换到「计时」或「我的」，放大镜可打开全站搜索。', en: 'Open this menu to browse Tools by section. Use the bottom bar for Timer or Account, or tap the magnifying glass to search.' } },
  { selector: ':root:not([data-embedded-search-button]) .home-navigation-toggle', Icon: Menu, title: navigation,
    body: { zh: '打开菜单，选择训练、工具等栏目，再点选功能或「总览」。点击 CubeRoot 标志回到首页。', en: 'Open the menu and choose a section such as Training or Tools. Select a link or Overview. Tap the CubeRoot logo to return home.' } },
  { selector: '.landing-page > .landing-search .landing-search-controls', Icon: Search, title: { zh: '全站搜索', en: 'Site search' },
    body: { zh: '输入功能名称、选手姓名或比赛名称，从搜索结果直达对应页面。', en: 'Search for a tool, competitor or competition and open it from the results.' } },
  card('timer', TEXTS.timer, Timer, '开始计时，保存每次还原的用时，在计时器中回看练习成绩。', 'Time a solve and review your practice results in the timer.'),
  card('algdb', TEXTS.algdb, Blocks, '按情况查找公式，播放动画查看每一步转动。', 'Find algorithms by case and play an animation to see each turn.'),
  card('sim', TEXTS.sim, Box, '在屏幕上转动魔方，观察每一步如何改变块的位置。', 'Turn a virtual puzzle to see how each move changes the positions of its pieces.'),
  card('recon', TEXTS.recon, Film, '按选手或成绩查找比赛复盘，查看一次还原的步骤。', 'Browse competition reconstructions and follow a solve move by move.'),
  card('scramble', TEXTS.scramble, Shuffle, '生成练习打乱，或输入一个打乱，查看它的解法。', 'Generate a practice scramble, or enter a scramble to find a solution.'),
  card('alg', TEXTS.alg, BookOpen, '从教程选择还原方法，跟着图示和动画分步学习。', 'Choose a solving method and follow the illustrated steps and animations.'),
  card('competitions', TEXTS.competitions, Calendar, '查找 WCA 比赛，查看比赛日期、地点和项目。', 'Find WCA competitions and check their dates, locations and events.'),
  card('wca-results', TEXTS.rankings, Trophy, '进入「成绩」后可查看 WCA 比赛成绩、排名和纪录。', 'Open Results to explore WCA competition results, rankings and records.'),
  card('wca-stats', TEXTS.statistics, Sigma, '浏览根据 WCA 比赛成绩整理的统计榜单。', 'Explore statistics compiled from WCA competition results.'),
  { selector: '.landing-widget--scrambles [data-tour="recent-scrambles"]:not([aria-hidden]) .rs-topbar', Icon: History, title: { zh: '近期打乱', en: 'Recent scrambles' },
    body: { zh: '切换项目查看近期比赛打乱，点击箭头查看完整列表。', en: 'Choose an event to see recent competition scrambles. Open the arrow for the full list.' } },
  { selector: '.landing-widget--recons .tr-head', Icon: Film, title: { zh: '首页复盘', en: 'Featured reconstructions' },
    body: { zh: '点开一条复盘查看选手的还原步骤，或用箭头浏览更多复盘。', en: 'Select a solve to see its reconstruction, or use the arrow to browse more.' } },
  { selector: '.landing-widget--comps .ongoing-comps-tabbar', Icon: Calendar, title: { zh: '比赛动态', en: 'Competition updates' },
    body: { zh: '切换标签查看近期比赛和报名动态。', en: 'Switch tabs to see recent competition and registration updates.' } },
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
      if (target !== lastTarget.current) {
        lastTarget.current = target;
        target.scrollIntoView({ block: available.height < 480 ? 'start' : 'center', inline: 'nearest', behavior: 'instant' });
      }
      const r = target.getBoundingClientRect();
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
            <h2>{t(current.title.zh, current.title.en)}</h2>
            <p>{t(current.body.zh, current.body.en)}</p>
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
