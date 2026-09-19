'use client';

// 新手功能引导（Element Highlighting Tooltip Tour，Driver.js / Intro.js 风格）。
//
// 触发后直接从第 1 步开始高亮，无欢迎页。共 12 步，每步标题与描述文案固定。
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

export const ONBOARDING_GUIDE_KEY = 'cuberoot_guided';

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

export function isOnboardingGuided(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_GUIDE_KEY) === 'true';
  } catch {
    return true;
  }
}

export function markOnboardingGuided(): void {
  try {
    window.localStorage.setItem(ONBOARDING_GUIDE_KEY, 'true');
  } catch {
    /* 隐私模式下 localStorage 不可用：本次会话不再打扰即可 */
  }
}

interface Props {
  open: boolean;
  lang: 'zh' | 'en';
  onClose: () => void;
}

interface TargetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const HIGHLIGHT_PAD = 6;
const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 360;

export default function OnboardingGuideModal({ open, lang, onClose }: Props) {
  const total = ONBOARDING_STEPS.length;
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);

  // 每次打开都直接从第 1 步开始。
  useEffect(() => {
    if (open) setStep(0);
  }, [open ]);

  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, total - 1));
  }, [total]);

  const goPrev = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const current = ONBOARDING_STEPS[step];

  // 读取目标元素视口坐标；找不到 / 过小（懒加载未挂载等）时返回 null，
  // 调用方回退为底部居中卡片。
  const measure = useCallback(() => {
    if (typeof window === 'undefined') return;
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const tour = ONBOARDING_STEPS[step]?.tour;
    if (!tour) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${tour}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width < 8 || r.height < 8) {
      setRect(null);
      return;
    }
    setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
  }, [step]);

  // 切换步骤：先把目标滚入可视区，再（分多次）测量，兼容 smooth 滚动动画
  // 与懒加载挂件的延迟挂载。
  useEffect(() => {
    if (!open) return;
    const tour = ONBOARDING_STEPS[step]?.tour;
    if (tour) {
      const el = document.querySelector(`[data-tour="${tour}"]`);
      try {
        (el as HTMLElement | null)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      } catch {
        /* 旧浏览器忽略平滑滚动 */
      }
    }
    measure();
    let raf = 0;
    raf = requestAnimationFrame(measure);
    const t1 = window.setTimeout(measure, 350);
    const t2 = window.setTimeout(measure, 800);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
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
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, goNext, goPrev]);

  const tooltipLayout = useMemo(() => {
    if (!rect || viewport.w === 0) return null;
    const width = Math.min(TOOLTIP_WIDTH, Math.max(280, viewport.w - 16));
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
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const hasTarget = Boolean(current.tour && rect && tooltipLayout);

  const cardShell =
    'relative w-full overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--popover)] text-[var(--foreground)] shadow-[0_24px_60px_rgba(0,0,0,0.25)] outline-none';

  const renderCardBody = (autoFocusNext: boolean) => (
    <>
      {/* 顶栏：进度 + 关闭 */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-5 py-3">
        <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
          {t(`第 ${step + 1} 步 / 共 ${total} 步`, `Step ${step + 1} of ${total}`)}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('跳过并关闭', 'Skip and close')}
          className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* 进度条 */}
      <div
        className="h-1 w-full bg-[var(--muted)]"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step + 1}
      >
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-200"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-6">
        {/* 步骤圆点（可点击跳转） */}
        <div className="mb-4 flex items-center justify-center gap-1.5" role="group" aria-label={t('步骤导航', 'Step navigation')}>
          {ONBOARDING_STEPS.map((s, i) => (
            <button
              key={s.tour + i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={t(`跳到第 ${i + 1} 步`, `Go to step ${i + 1}`)}
              aria-current={i === step ? 'step' : undefined}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? 'w-6 bg-[var(--accent)]'
                  : i < step
                    ? 'w-1.5 bg-[var(--accent)] opacity-50'
                    : 'w-1.5 bg-[var(--border-strong)]'
              }`}
            />
          ))}
        </div>

        {/* 步骤内容：固定标题 + 描述 */}
        <div className="flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <StepIcon size={28} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold leading-snug">
            {t(current.title.zh, current.title.en)}
          </h2>
          <p className="mt-2 min-h-[3.5rem] text-sm leading-relaxed text-[var(--muted-foreground)]">
            {t(current.body.zh, current.body.en)}
          </p>
        </div>

        {/* 操作区：上一步 / 跳过导览 / 下一步·完成 */}
        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={isFirst}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--card)] px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-default)]"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {t('上一步', 'Back')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {t('跳过导览', 'Skip tour')}
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={onClose}
              autoFocus={autoFocusNext}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-foreground)] transition-[filter] hover:brightness-110"
            >
              {t('完成', 'Done')}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              autoFocus={autoFocusNext}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-foreground)] transition-[filter] hover:brightness-110"
            >
              {t('下一步', 'Next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </>
  );

  // 目标未渲染：优雅回退为屏幕下方居中卡片，避免报错。
  if (!hasTarget || !rect || !tooltipLayout) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black/55 backdrop-blur-[2px]" role="presentation">
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={t(current.title.zh, current.title.en)}
          className={`${cardShell} fixed bottom-6 left-1/2 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2`}
        >
          {renderCardBody(true)}
        </div>
      </div>
    );
  }

  // 四块遮罩（中间留出高亮缺口）+ 高亮描边 + 吸附气泡。
  // 四块遮罩而非整屏遮罩，是为了让目标保持明亮并拦截误触跳转。
  const hx = rect.x - HIGHLIGHT_PAD;
  const hy = rect.y - HIGHLIGHT_PAD;
  const hw = rect.w + HIGHLIGHT_PAD * 2;
  const hh = rect.h + HIGHLIGHT_PAD * 2;
  const mask = 'fixed bg-black/55 transition-all duration-300';
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
    <div className="fixed inset-0 z-[1000]" role="presentation">
      {/* 上 / 下 / 左 / 右四块半透明遮罩 */}
      <div className={mask} style={{ left: 0, right: 0, top: 0, height: Math.max(0, hy) }} onClick={(e) => e.stopPropagation()} />
      <div
        className={mask}
        style={{ left: 0, right: 0, top: hy + hh, bottom: 0 }}
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className={mask}
        style={{ left: 0, width: Math.max(0, hx), top: hy, height: hh }}
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className={mask}
        style={{ left: hx + hw, right: 0, top: hy, height: hh }}
        onClick={(e) => e.stopPropagation()}
      />
      {/* 高亮缺口上的透明点击拦截层：展示目标但阻止巡游中误触跳转 */}
      <div
        className="fixed bg-transparent"
        style={{ left: hx, top: hy, width: hw, height: hh }}
        onClick={(e) => e.stopPropagation()}
        aria-hidden="true"
      />
      {/* 高亮描边框 */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-xl border-2 border-[var(--accent)] shadow-[0_0_0_3px_rgba(255,255,255,0.65),0_0_24px_rgba(0,0,0,0.35)] transition-all duration-300"
        style={{ left: hx, top: hy, width: hw, height: hh }}
      />

      {/* 吸附气泡：定位在目标正下方（空间不足时翻到上方），小箭头指向目标 */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t(current.title.zh, current.title.en)}
        className={`${cardShell} fixed`}
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          aria-hidden="true"
          className="absolute h-3.5 w-3.5 rotate-45 border-[var(--border-default)] bg-[var(--popover)]"
          style={
            tooltipLayout.placement === 'below'
              ? {
                  top: -7,
                  left: tooltipLayout.arrowLeft - 7,
                  borderLeftWidth: 1,
                  borderTopWidth: 1,
                }
              : {
                  bottom: -7,
                  left: tooltipLayout.arrowLeft - 7,
                  borderRightWidth: 1,
                  borderBottomWidth: 1,
                }
          }
        />
        {renderCardBody(false)}
      </div>
    </div>
  );
}
