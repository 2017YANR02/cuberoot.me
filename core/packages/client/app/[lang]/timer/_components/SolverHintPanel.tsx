'use client';

/**
 * SolverHintPanel — 计时器「解法提示」面板(替代旧 StageSolverModal 弹层)。
 *
 * 同一份内容,两套形态:
 *  · 桌面 (≥1024px):收成主区右侧的常驻可折叠竖栏。展开态记进 localStorage
 *    (默认展开;只有用户手动收起过 '0' 才保持收起)。展开会 next/dynamic 拉 StageSolver
 *    并建池 —— 默认的「标准 · 十字」只下 pt_cross(gz 50KB),XCross 及以上才补 20MB
 *    大表(见 rust-cross-client 的两段式加载)。
 *  · 手机 / 平板 (<1024px):pill 是顶栏那组控件的最后一件(人数 / 项目 / 打乱来源之后),
 *    点开 = 全屏浮层。原先是就地展开,但 pill 本就贴在底栏上方,展开出来的内容整块落在
 *    首屏之外、页面又不跟着滚,点下去屏幕毫无变化 —— 看上去就是「没反应」(issue #49)。
 *    浮层开合走 URL(?hints=1,history push),所以安卓返回键 / 手势返回能关掉它。
 *    浮层 portal 到 body:顶栏是 z-index:41 的层叠上下文,留在里面它的 z-index:62 只在
 *    那一层内部有效,会被外面 z-index:61 的底部抽屉盖住。
 *  · 桌面也可以要全屏:右栏头部的 ⤢ 打开同一个浮层(窄栏里 3D 魔方 + 解法列表被迫上下叠,
 *    全屏才摊得开)。此时右栏内容卸载,避免两份 StageSolver 各解一遍同一条打乱。
 *  · 换题(上/下一条打乱)在两套形态里都能用:右栏形态下计时区还露着,归主区的键盘 +
 *    径向手势;全屏浮层盖住了主区,于是键盘走 SoloView 的 hintsOnly 分支放行,手势由
 *    这里的 useScrambleSwipe 接管(横划一下,方向同径向手势:右 = 下一个)。
 *
 * 引擎/动画仍复用 components/StageSolver(analyzer 主面板同款),首次展开才 next/dynamic
 * 拉表;收起后再展开复用站内共享池(getRustCrossPool 单例),不重拉。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useQueryState, parseAsBoolean } from 'nuqs';
import { ChevronRight, X } from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import StepSolve from './StepSolve';
import { persistItem } from '@/lib/safe-storage';
import { prefetchXCrossTableWhenIdle } from '@/lib/rust-cross-tables';
import { tr } from '@/i18n/tr';

const StageSolver = dynamic(() => import('@/components/StageSolver'), {
  ssr: false,
  loading: () => (
    <div className="solver-panel-loading">
      <Spinner size={16} label={tr({ zh: '加载中', en: 'Loading' })} />
    </div>
  ),
});

const LS_KEY = 'timer.solverHints.panelOpen';
/** 桌面形态选择:'1' = 全屏,其余 = 右栏。用户自己选的,下次进来保持。 */
const LS_FULL = 'timer.solverHints.full';

/** URL param owning the full-screen sheet. Shared by SoloView (which folds
 *  it into `anyModalOpen` so Space/Escape don't reach the timer behind it). */
export const HINTS_PARAM = 'hints';

/** 一个词就够 —— pill 挤在顶栏那排控件里,「解法提示」四个字白占宽度。 */
const PANEL_TITLE = { zh: '解法', en: 'Solve' };

interface Props {
  scramble: string;
  isZh: boolean;
  resultsPanelOpen?: boolean;
  onOpen?: () => void;
}

/** 换题回调。右栏形态下换题归主区(计时面板的径向手势 + 键盘),全屏浮层把整屏盖住了,
 *  这两件事得由浮层自己接过来:横划手势在这儿,键盘在 SoloView 的 hintsOnlyRef 分支。 */
interface ScrambleNav {
  onPrevScramble?: () => void;
  onNextScramble?: () => void;
}

/** 横划手势的判据:横向位移下限,以及「必须明显横向」的横/竖比 —— 浮层内容是竖向滚动的,
 *  比值太松会把斜着的滚动当成换题。方向沿用计时面板的径向手势:右 = 下一个,左 = 上一个。 */
const SWIPE_MIN_X = 60;
const SWIPE_RATIO = 1.6;
/** 这些元素里起手的拖动各有主人(3D 魔方转视角、表单控件自己的拖动),不当换题手势。 */
const SWIPE_IGNORE = 'canvas, twisty-player, input, textarea, select, [data-no-swipe]';

function useScrambleSwipe({ onPrevScramble, onNextScramble }: ScrambleNav) {
  const startRef = useRef<{ x: number; y: number; mouse: boolean } | null>(null);
  // 手势起手落在按钮上(解法列表每行都是按钮)时,松手那下的 click 要吞掉,否则划一下
  // 顺带把那行选中了。
  const swallowClickRef = useRef(false);
  const enabled = !!onPrevScramble && !!onNextScramble;

  const onPointerDown = (e: React.PointerEvent) => {
    swallowClickRef.current = false;
    startRef.current = null;
    if (!enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement | null)?.closest(SWIPE_IGNORE)) return;
    startRef.current = { x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse' };
  };
  // 在 move 里判、判中就地触发并清空起点:一次拖动只换一题,也不必担心浏览器接管滚动时
  // 发来的 pointercancel 把 up 吃掉。
  const onPointerMove = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
    // 鼠标:拖过解法文本是在选文本,不是换题 —— 这一拖选中了东西就不算手势。
    if (s.mouse && !(window.getSelection()?.isCollapsed ?? true)) { startRef.current = null; return; }
    startRef.current = null;
    swallowClickRef.current = true;
    (dx > 0 ? onNextScramble : onPrevScramble)?.();
  };
  const onPointerEnd = () => { startRef.current = null; };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swallowClickRef.current) return;
    swallowClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture };
}

/** 桌面形态二选一:右栏 ↔ 全屏。右栏头部和全屏头部各挂一个,两处都能切回去。 */
function ModeToggle({ full, onChange }: { full: boolean; onChange: (full: boolean) => void }) {
  return (
    <span className="solver-mode-toggle">
      <PillToggle
        value={full}
        onChange={onChange}
        onLabel={tr({ zh: '全屏', en: 'Full' })}
        offLabel={tr({ zh: '右栏', en: 'Rail' })}
        ariaLabel={tr({ zh: '解法面板形态', en: 'Solver panel layout' })}
      />
    </span>
  );
}

function SolverBody({ scramble, isZh, compact }: Props & { compact: boolean }) {
  return (
    <>
      {/* 打乱原文。手机上这块是全屏浮层,盖住了计时器自己的打乱条;桌面右栏也够窄,
          转头去主区对照同样麻烦 —— 解法讲的是哪条打乱,就摆在解法旁边。
          尚未生成打乱(首帧 / 换项目那一刻)时整块不渲染,不留空行。 */}
      {scramble.trim() && <p className="solver-panel-scramble">{scramble}</p>}
      <StageSolver scramble={scramble} lang={isZh ? 'zh' : 'en'} compact={compact} />
      <StepSolve scramble={scramble} isZh={isZh} />
    </>
  );
}

/** Full-screen sheet. Own component so useModalDismiss's Escape + body-scroll-lock
 *  mount and unmount with the sheet itself. `onDock` 只有桌面传(手机没有右栏可回)。 */
function SolverSheet({ scramble, isZh, compact, onClose, onDock, onPrevScramble, onNextScramble }: Props & ScrambleNav & { compact: boolean; onClose: () => void; onDock?: () => void }) {
  useModalDismiss(onClose);
  const swipe = useScrambleSwipe({ onPrevScramble, onNextScramble });
  const title = tr(PANEL_TITLE);
  return (
    <div className="solver-sheet" data-no-timer role="dialog" aria-modal="true" aria-label={title} {...swipe}>
      <div className="solver-sheet-head">
        <span className="solver-sheet-title">{title}</span>
        {onDock && <ModeToggle full onChange={(v) => { if (!v) onDock(); }} />}
        <button
          type="button"
          className="solver-sheet-close"
          onClick={onClose}
          aria-label={tr({ zh: '关闭', en: 'Close' })}
        >
          <X size={18} />
        </button>
      </div>
      <div className="solver-sheet-body">
        <SolverBody scramble={scramble} isZh={isZh} compact={compact} />
      </div>
    </div>
  );
}

export default function SolverHintPanel({
  scramble,
  isZh,
  resultsPanelOpen = false,
  onOpen,
  onPrevScramble,
  onNextScramble,
}: Props & ScrambleNav) {
  const isPhone = useIsMobile(560);
  const isDesktopRail = !useIsMobile(1023); // ≥1024 时面板是右侧 ~360px 窄栏

  // 桌面右栏展开态(SSR 初值恒 false 避免 hydration mismatch,挂载后再同步)。默认展开:
  // 仅当用户此前手动收起过('0')才保持收起,其余情况(无记录 / '1')一律展开。
  const [railOpen, setRailOpen] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY) !== '0') setRailOpen(true);
    } catch { setRailOpen(true); }
  }, []);

  // 浮层要 portal 到 document.body(见文件头注),预渲染时没有 body → 挂载后才画。
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // 进 /timer 就在后台把 XCross 那张 21MB 剪枝表拉起来 —— 不等面板展开,更不等用户切阶段
  // (手机上浮层默认关着,等它挂载等于永远不预取)。表是全站单例,只下不 attach,也不需要
  // 求解器池存在;页面 load 完 + 浏览器空闲才动手,省流量 / 慢网自动跳过。细则见 rust-cross-tables。
  useEffect(() => prefetchXCrossTableWhenIdle(), []);

  // 桌面形态偏好(右栏 / 全屏),用户选了就记住:下次进来直接是上次那个形态。
  // 同 railOpen:SSR 初值恒 false,挂载后再读 localStorage。
  const [fullPref, setFullPref] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem(LS_FULL) === '1') setFullPref(true); } catch { /* 隐私模式:留右栏 */ }
  }, []);

  // 全屏浮层态 —— 归 URL 管,返回键即关闭。手机点 pill 进,桌面靠头部的形态开关进。
  const [sheetOpen, setSheetOpen] = useQueryState(
    HINTS_PARAM,
    parseAsBoolean.withDefault(false).withOptions({ history: 'push' }),
  );
  // 浮层是不是我们自己 push 出来的。是 → 关闭走 history.back() 把那一格弹掉;
  // 否则(带 ?hints=true 直接进来的深链)原地 replace 掉参数。两条路都保证「关掉后
  // 再按返回不会把浮层又勾回来」—— 若关闭也走 push,返回栈会变成 开→关 两格,
  // 一按返回就重新打开。
  const pushedRef = useRef(false);
  useEffect(() => { if (!sheetOpen) pushedRef.current = false; }, [sheetOpen]);
  const closeSheet = useCallback(() => {
    if (pushedRef.current) { window.history.back(); return; }
    void setSheetOpen(null, { history: 'replace' });
  }, [setSheetOpen]);
  const openSheet = () => {
    onOpen?.();
    pushedRef.current = true;
    void setSheetOpen(true);
  };

  // 解法栏与成绩 / 图表 / 统计栏共用右侧空间，只保留一个。父页面打开成绩栏时
  // 立即隐藏这里的内容，再同步收起内部状态；从浏览器历史恢复解法浮层时则反向
  // 通知父页面关闭成绩栏。
  useEffect(() => {
    if (!resultsPanelOpen) return;
    setRailOpen(false);
    if (sheetOpen) closeSheet();
  }, [closeSheet, resultsPanelOpen, sheetOpen]);
  useEffect(() => {
    if (sheetOpen) onOpen?.();
  }, [onOpen, sheetOpen]);

  // 桌面切形态:记住选择,并按新形态开 / 关浮层。
  const pickFull = (v: boolean) => {
    setFullPref(v);
    persistItem(LS_FULL, v ? '1' : '0');
    if (v) openSheet(); else closeSheet();
  };
  // 上次选的是全屏 → 进页面直接给全屏(每次挂载只自动开一次:之后用户切回右栏、
  // 或用返回手势关掉,都不该被这条效应再拽回全屏)。replace:不往返回栈添一格。
  const autoFullRef = useRef(false);
  useEffect(() => {
    if (!isDesktopRail || autoFullRef.current) return;
    if (fullPref && railOpen && !sheetOpen) {
      autoFullRef.current = true;
      void setSheetOpen(true, { history: 'replace' });
    }
  }, [isDesktopRail, fullPref, railOpen, sheetOpen, setSheetOpen]);

  const open = !resultsPanelOpen && (isDesktopRail ? railOpen : sheetOpen);
  // 右栏正被全屏浮层顶替:内容卸载(同一条打乱不解两遍),但 data-open 保持,
  // 关掉浮层就回到原样的宽栏。
  const railBodyOpen = !resultsPanelOpen && isDesktopRail && railOpen && !sheetOpen;

  const toggle = () => {
    if (!isDesktopRail) {
      if (sheetOpen) { closeSheet(); return; }
      openSheet();
      return;
    }
    const next = !railOpen;
    if (next) onOpen?.();
    setRailOpen(next);
    persistItem(LS_KEY, next ? '1' : '0');
  };

  const title = tr(PANEL_TITLE);

  return (
    <>
      <aside className="solver-panel surface-chrome" data-open={open} data-no-timer>
        {/* display:contents 兜底(见 shell.css):除「桌面右栏已展开」外,头部仍是
            单独一颗 pill,加这层不改任何现有形态。 */}
        <div className="solver-panel-headrow">
          <button
            type="button"
            className="solver-panel-head"
            onClick={(e) => { toggle(); e.currentTarget.blur(); }}
            aria-expanded={open}
          >
            <span className="solver-panel-title">{title}</span>
            {/* 桌面的 chevron 描述的是就地折叠,留着。手机上点开的是全屏浮层,原来配了个
                「放大」图标 —— 顶栏那排控件里只剩文字更干净,去掉。 */}
            {isDesktopRail && <ChevronRight size={14} className="solver-panel-chevron" />}
          </button>
          {/* 形态自选:留在右栏,或摊到全屏(全屏不压缩排版,3D 魔方与解法列表并排)。 */}
          {isDesktopRail && railOpen && <ModeToggle full={false} onChange={pickFull} />}
        </div>
        {railBodyOpen && (
          <div className="solver-panel-body">
            <SolverBody scramble={scramble} isZh={isZh} compact />
          </div>
        )}
      </aside>
      {sheetOpen && !resultsPanelOpen && mounted && createPortal(
        // 紧凑排版只给真手机;平板 / 桌面全屏都够宽,摊开排。
        // 桌面多给一个形态开关(切回右栏 = 关浮层并记住);手机没有右栏,只留 ✕。
        <SolverSheet
          scramble={scramble}
          isZh={isZh}
          compact={isPhone}
          // 桌面关掉全屏 = 选回右栏(否则记着的形态与眼前看到的不一致,一刷新又弹回全屏)。
          onClose={isDesktopRail ? () => pickFull(false) : closeSheet}
          onDock={isDesktopRail ? () => pickFull(false) : undefined}
          onPrevScramble={onPrevScramble}
          onNextScramble={onNextScramble}
        />,
        document.body,
      )}
    </>
  );
}
