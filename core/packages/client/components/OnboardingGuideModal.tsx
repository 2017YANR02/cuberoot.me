'use client';

// 新手功能引导（Element Highlighting Tooltip Tour，Driver.js / Intro.js 风格）。
//
// 打开后直接进入第 1 步；12 步通过 getBoundingClientRect() 定位高亮与气泡。
// 位置说明：站内没有全局 SiteHeader / TopNav，首页头部就是
// `app/[lang]/LandingClient.tsx` 里的 `.landing-auth`，主导航是首页两排 hero
// 卡片（`renderCard` / `renderCardGrid`，经 `SortableCard[tourKey]` 透传
// `data-tour`），下方挂件（近期打乱 / 今日复盘 / 论坛）由外层包裹 div 提供
// `data-tour` 锚点。本组件用 `document.querySelector('[data-tour="…"]')`
// + `getBoundingClientRect()` 做高亮与气泡定位。
//
// 视觉：只复用站内 Design System 的 Tailwind 类名与 CSS 变量
// （`--popover` / `--foreground` / `--border-default` / `--muted` /
// `--muted-foreground` / `--card` / `--accent` / `--accent-foreground` /
// `--accent-soft` / `--border-strong`），不引入自定义色值。

import './onboarding-guide.css';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { useT } from '@/hooks/useT';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Blocks,
  Box,
  ChevronLeft,
  ChevronRight,
  Film,
  History,
  ListOrdered,
  MessagesSquare,
  Radio,
  ScanSearch,
  Shuffle,
  Sigma,
  Timer as TimerIcon,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react';



export interface OnboardingStep {
  Icon: LucideIcon;
  title: { zh: string; en: string };
  body: { zh: string; en: string };
  href: string;
  cta: { zh: string; en: string };
  /** 对应页面上的 data-tour 锚点。 */
  tour: string;
}

// 12 步固定文案（中文一字不改）：
// 1 计时 timer / 2 公式 formulas / 3 模拟 simulator / 4 复盘 replay /
// 5 打乱 scramble / 6 比赛 competition / 7 纪录 records / 8 排名 rankings /
// 9 统计 statistics / 10 近期打乱 recent-scrambles /
// 11 今日复盘 today-replay / 12 论坛 forum。
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    Icon: TimerIcon,
    title: { zh: '计时', en: 'Timer' },
    body: {
      zh: '魔方速拧训练，记录还原时间，自动保存你的个人最佳PB。',
      en: 'Speedcubing training that times every solve and auto-saves your personal best.',
    },
    href: '/timer',
    cta: { zh: '前往计时', en: 'Open timer' },
    tour: 'timer',
  },
  {
    Icon: Blocks,
    title: { zh: '公式', en: 'Algorithms' },
    body: {
      zh: '查阅OLL/PLL等魔方公式，搭配3D魔方动画直观学习。',
      en: 'Look up OLL/PLL and other algorithms with intuitive 3D animations.',
    },
    href: '/alg',
    cta: { zh: '前往公式', en: 'Open algorithms' },
    tour: 'formulas',
  },
  {
    Icon: Box,
    title: { zh: '模拟', en: 'Simulator' },
    body: {
      zh: '3D魔方模拟器，自由转动魔方，预览公式效果、练习观察。',
      en: 'A 3D cube simulator: turn freely, preview algorithms and practise lookahead.',
    },
    href: '/sim',
    cta: { zh: '前往模拟', en: 'Open simulator' },
    tour: 'simulator',
  },
  {
    Icon: ScanSearch,
    title: { zh: '复盘', en: 'Reconstructions' },
    body: {
      zh: '回看你的还原过程，分析拧法，找到可以优化的地方。',
      en: 'Replay your solves, analyse your turning, and find room to improve.',
    },
    href: '/recon',
    cta: { zh: '前往复盘', en: 'Open reconstructions' },
    tour: 'replay',
  },
  {
    Icon: Shuffle,
    title: { zh: '打乱', en: 'Scrambles' },
    body: {
      zh: '生成WCA官方标准打乱序列，用于日常练习和比赛模拟。',
      en: 'Generate official WCA scramble sequences for daily practice and mock comps.',
    },
    href: '/scramble',
    cta: { zh: '前往打乱', en: 'Open scrambles' },
    tour: 'scramble',
  },
  {
    Icon: Radio,
    title: { zh: '比赛', en: 'Compete' },
    body: {
      zh: '在线魔方竞速对战，和其他玩家实时PK。',
      en: 'Online speedcubing battles — race other players in real time.',
    },
    href: '/comp-sim',
    cta: { zh: '前往比赛', en: 'Open competitions' },
    tour: 'competition',
  },
  {
    Icon: Trophy,
    title: { zh: '纪录', en: 'Records' },
    body: {
      zh: '查看全部历史还原成绩，浏览每一次练习记录。',
      en: 'Browse your full solve history and every practice record.',
    },
    href: '/wca/records',
    cta: { zh: '前往纪录', en: 'Open records' },
    tour: 'records',
  },
  {
    Icon: ListOrdered,
    title: { zh: '排名', en: 'Rankings' },
    body: {
      zh: '全网玩家排行榜，看看你的水平在什么位置。',
      en: 'A network-wide leaderboard — see where you stand.',
    },
    href: '/wca/results',
    cta: { zh: '前往排名', en: 'Open rankings' },
    tour: 'rankings',
  },
  {
    Icon: Sigma,
    title: { zh: '统计', en: 'Statistics' },
    body: {
      zh: '练习数据分析，查看平均成绩，跟踪你的进步趋势。',
      en: 'Practice analytics: averages and trends that track your progress.',
    },
    href: '/wca',
    cta: { zh: '前往统计', en: 'Open statistics' },
    tour: 'statistics',
  },
  {
    Icon: History,
    title: { zh: '近期打乱', en: 'Recent scrambles' },
    body: {
      zh: '查看比赛官方打乱、历史打乱记录，直接点开就能复盘这把还原。',
      en: 'Official and historical scrambles — open any of them to reconstruct the solve.',
    },
    href: '/scramble',
    cta: { zh: '前往打乱', en: 'Open scrambles' },
    tour: 'recent-scrambles',
  },
  {
    Icon: Film,
    title: { zh: '今日复盘', en: "Today's reconstructions" },
    body: {
      zh: '浏览顶级选手的比赛复盘案例，学习高手的观察与还原思路。',
      en: 'Top solvers’ competition reconstructions — learn how the best look ahead.',
    },
    href: '/recon',
    cta: { zh: '前往复盘', en: 'Open reconstructions' },
    tour: 'today-replay',
  },
  {
    Icon: MessagesSquare,
    title: { zh: '论坛', en: 'Forum' },
    body: {
      zh: '魔方玩家交流社区，可以发帖提问、分享练习经验、讨论成绩。',
      en: 'A cubing community: ask questions, share practice tips and discuss results.',
    },
    href: '/forum',
    cta: { zh: '前往论坛', en: 'Open forum' },
    tour: 'forum',
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

interface TargetRect {
  x: number;
  y: number;
  w: number;
  h: number;
  borderRadius?: string;
}

const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 360;

export default function OnboardingGuideModal({ open, onClose }: Props) {
  const t = useT();
  const backdropProps = useModalBackdrop(onClose);
  const total = ONBOARDING_STEPS.length;
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrolledTarget = useRef<Element | null>(null);
  // 自动触发与手动重看都从第一步开始。
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, total - 1));
  }, [total]);

  const goPrev = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const current = ONBOARDING_STEPS[step];

  // 读取目标元素视口坐标；找不到 / 零尺寸 / 占位骨架（懒加载未挂载等）时
  // 返回 null，调用方回退为底部居中卡片。
  // 滚动动画中途 rect 可能短暂为负值/超视口，渲染层会再做钳制，
  // 这里保留原始值以便动画连续。
  // 关键：10/11 步（today-replay / forum）的数据是异步到达的，首帧先渲染
  // 高 320~360px 的 --loading 占位骨架，数据到后才替换为真实内容。
  // 若在占位阶段锁定 rect，高 360px 的骨架框会闪一下再跳到真实高度，
  // 遮罩缺口与描边框跟着跳 = 你看到的那条“线”与大块闪动。
  // 因此占位骨架一律视为“未就绪”，等真实内容挂载后再定位。
  const measure = useCallback(() => {
    if (typeof window === 'undefined') return;
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const tour = ONBOARDING_STEPS[step]?.tour;
    if (!tour) {
      setRect(null);
      return;
    }
    // 跳过本次渲染已卸载的旧目标：step 切换瞬间旧卡片可能已不在 DOM，
    // 此时 querySelector 会命中新目标但 getBoundingClientRect 尚未稳定，
    // 先清空旧 rect，避免旧高亮框残留成横贯细线。
    // 注：必须用 getElementById 先确认是 data-tour 宿主本身，避免命中其内部
    // 嵌套了同名 data-tour 的子元素（其 rect 更小，会导致遮罩错位闪线）。
    const el = document.querySelector(`[data-tour="${tour}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    // 占位骨架（loading / aria-busy）不是真实内容：视为未就绪。
    if (
      el.classList.contains('today-recon--loading') ||
      el.classList.contains('recent-scrambles--loading') ||
      el.getAttribute('aria-busy') === 'true'
    ) {
      setRect(null);
      return;
    }
    if (scrolledTarget.current !== el) {
      scrolledTarget.current = el;
      el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
    }
    // Card anchors live on sortable wrappers; outline the visible card itself.
    const surface = el.querySelector(':scope > .landing-card') ?? el;
    const r = surface.getBoundingClientRect();
    // 目标完全在视口外（滚动中途）时清空，避免遮罩算出负 height/width 闪线。
    if (
      r.width < 8 ||
      r.height < 8 ||
      r.bottom < 0 ||
      r.right < 0 ||
      r.top > window.innerHeight ||
      r.left > window.innerWidth
    ) {
      setRect(null);
      return;
    }
    setRect({ x: r.left, y: r.top, w: r.width, h: r.height, borderRadius: getComputedStyle(surface).borderRadius });
  }, [step]);

  // 切换步骤：先清空旧高亮（避免旧框残留闪线），再把目标滚入可视区，
  // 之后（分多次 + 占位替换后补测）测量，兼容 smooth 滚动动画、
  // 懒加载挂件的延迟挂载，以及 10/11 步异步数据到达时的骨架→内容替换。
  useEffect(() => {
    if (!open) return;
    scrolledTarget.current = null;
    setRect(null);
    const tour = ONBOARDING_STEPS[step]?.tour;
    if (tour) {
      const el = document.querySelector(`[data-tour="${tour}"]`);
      try {
        (el as HTMLElement | null)?.scrollIntoView({
          // 10→11→12 在页面底部相邻，instant 瞬切比 smooth 更稳：
          // smooth 的长滚动动画中途 rect 全程越界，高亮框反复横跳闪线。
          behavior: 'instant' as ScrollBehavior,
          block: 'center',
          inline: 'center',
        });
      } catch {
        /* 旧浏览器忽略滚动选项，回退到默认行为 */
      }
    }
    measure();
    let raf = 0;
    raf = requestAnimationFrame(measure);
    const t1 = window.setTimeout(measure, 350);
    const t2 = window.setTimeout(measure, 800);
    // 占位骨架→真实内容的替换发生在数据到达时（晚于 800ms 也可能），
    // 补一次 1.8s 测量兜住 10/11 步的异步挂载。
    const t3 = window.setTimeout(measure, 1800);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [open, step, measure]);

  // 监听窗口 resize / 任意滚动，保持高亮框与气泡定位准确。
  useEffect(() => {
    if (!open) return;
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        measure();
      });
    };
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('orientationchange', schedule);
    return () => {
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('orientationchange', schedule);
    };
  }, [open, measure]);

  // 打开期间：Esc 关闭，左右方向键切换，自动聚焦。巡游模式下不锁 body 滚动，
  // 否则 scrollIntoView 无法把目标带入可视区。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, goNext, goPrev]);

  const tooltipLayout = useMemo(() => {
    if (!rect || viewport.w === 0) return null;
    const width = Math.min(TOOLTIP_WIDTH, Math.max(0, viewport.w - 32));
    const centerX = rect.x + rect.w / 2;
    const left = Math.min(
      Math.max(8, centerX - width / 2),
      Math.max(8, viewport.w - width - 8),
    );
    const arrowLeft = Math.min(Math.max(16, centerX - left), width - 16);
    const spaceBelow = viewport.h - (rect.y + rect.h);
    // 下方空间不足（< 320px）且上方更宽敞时，气泡翻到目标上方。
    const placement: 'below' | 'above' =
      spaceBelow < 320 && rect.y > spaceBelow ? 'above' : 'below';
    return { width, left, arrowLeft, placement };
  }, [rect, viewport]);

  if (!open) return null;


  const StepIcon = current.Icon;
  const isFirst = step === 0;
  const isLast = step === total - 1;
  const hasTarget = Boolean(current.tour && rect && tooltipLayout);

  const renderCardBody = () => (
    <>
      <div className="onboarding-guide-heading">
        <span className="onboarding-guide-icon"><StepIcon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
        <span className="onboarding-guide-count">{t('新手指南', 'Beginner guide')} <span>{step + 1} / {total}</span></span>
        <button type="button" onClick={onClose} className="onboarding-guide-close" aria-label={t('关闭导览', 'Close tour')}><X size={18} aria-hidden="true" /></button>
      </div>
      <div className="onboarding-guide-copy" aria-live="polite" aria-atomic="true">
        <h2>{t(current.title.zh, current.title.en)}</h2>
        <p>{t(current.body.zh, current.body.en)}</p>
      </div>
      <div className="onboarding-guide-progress" role="progressbar" aria-label={t('导览进度', 'Tour progress')} aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}>
        <span style={{ width: ((step + 1) / total) * 100 + '%' }} />
      </div>
      <div className="onboarding-guide-actions">
        <button type="button" onClick={onClose} className="onboarding-guide-skip">{t('跳过', 'Skip')}</button>
        <div className="onboarding-guide-navigation">
          {!isFirst && <button type="button" onClick={goPrev} className="onboarding-guide-back" aria-label={t('上一步', 'Previous step')}><ChevronLeft size={17} aria-hidden="true" /></button>}
          <button type="button" onClick={isLast ? onClose : goNext} className="onboarding-guide-next">
            {isLast ? t('完成', 'Done') : t('下一步', 'Next')}
            {!isLast && <ChevronRight size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </>
  );

  // 四块遮罩（中间留出高亮缺口）+ 高亮描边 + 吸附气泡。
  // 四块遮罩而非整屏遮罩，是为了让目标保持明亮并拦截误触跳转。
  // 高亮坐标钳制到视口内：rect 在滚动动画中途可能为负值或超出视口，
  // 不钳制的话上/左遮罩 height/width 会溢出成横贯全屏的细线。
  // 顺序注意：clampedRect 必须先算出来，回退分支要用到它。
  const vw = viewport.w || (typeof window !== 'undefined' ? window.innerWidth : 0);
  const vh = viewport.h || (typeof window !== 'undefined' ? window.innerHeight : 0);
  const clampedRect: TargetRect | null =
    rect && vw > 0 && vh > 0
      ? {
          x: Math.min(Math.max(rect.x, 0), vw),
          y: Math.min(Math.max(rect.y, 0), vh),
          w: Math.max(0, Math.min(rect.w, vw - Math.min(Math.max(rect.x, 0), vw))),
          h: Math.max(0, Math.min(rect.h, vh - Math.min(Math.max(rect.y, 0), vh))),
        }
      : null;

  // 目标未渲染 / 越界（滚动中途）：优雅回退为屏幕下方居中卡片 + 整屏遮罩，
  // 不拼四块缺口遮罩，避免负 height/width 闪出横贯细线。
  if (!hasTarget || !rect || !tooltipLayout || !clampedRect) {
    return (
      <div className="onboarding-guide-layer onboarding-guide-mask" role="presentation" {...backdropProps}>
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={t(current.title.zh, current.title.en)}
          className="onboarding-guide-card onboarding-guide-fallback" data-site-surface="popover"
        >
          {renderCardBody()}
        </div>
      </div>
    );
  }

  // 能走到四块遮罩分支时 clampedRect 必存在（回退分支已拦截 null）。
  // 高亮缺口与描边框统一使用钳制坐标，遮罩 height/width 恒 ≥ 0。
  const hx = clampedRect.x;
  const hy = clampedRect.y;
  const hw = clampedRect.w;
  const hh = clampedRect.h;
  const mask = 'onboarding-guide-mask';
  const tooltipStyle: CSSProperties =
    tooltipLayout.placement === 'below'
      ? {
          top: rect.y + rect.h + TOOLTIP_GAP,
          left: tooltipLayout.left,
          width: tooltipLayout.width,
        }
      : {
          bottom: Math.max(8, viewport.h - rect.y + TOOLTIP_GAP),
          left: tooltipLayout.left,
          width: tooltipLayout.width,
        };

  return (
    <div className="onboarding-guide-layer" role="presentation" {...backdropProps}>
      {/* 上 / 下 / 左 / 右四块半透明遮罩 */}
      <div className={mask} {...backdropProps} style={{ left: 0, right: 0, top: 0, height: Math.max(0, hy) }}  />
      <div
        className={mask} {...backdropProps}
        style={{ left: 0, right: 0, top: hy + hh, bottom: 0 }}

      />
      <div
        className={mask} {...backdropProps}
        style={{ left: 0, width: Math.max(0, hx), top: hy, height: hh }}

      />
      <div
        className={mask} {...backdropProps}
        style={{ left: hx + hw, right: 0, top: hy, height: hh }}

      />
      {/* 高亮缺口上的透明点击拦截层：展示目标但阻止巡游中误触跳转 */}
      <div
        className="onboarding-guide-target"
        style={{ left: hx, top: hy, width: hw, height: hh }}

        aria-hidden="true"
      />
      {/* 高亮描边框 */}
      <div
        aria-hidden="true"
        className="onboarding-guide-highlight"
        style={{ left: hx, top: hy, width: hw, height: hh, borderRadius: rect.borderRadius }}
      />

      {/* 吸附气泡：定位在目标正下方（空间不足时翻到上方），小箭头指向目标 */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t(current.title.zh, current.title.en)}
        className="onboarding-guide-card" data-site-surface="popover"
        style={tooltipStyle}

      >
        {renderCardBody()}
      </div>
    </div>
  );
}
