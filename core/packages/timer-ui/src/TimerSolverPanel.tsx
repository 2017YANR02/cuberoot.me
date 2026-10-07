'use client';

import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Maximize2, Minimize2, X } from 'lucide-react';
import { Spinner } from './Spinner';
import { useTimerWideLayout } from './TimerWorkspace';
import { useModalDismiss } from './useModalDismiss';
import { modalFocusableElements } from './modal-focus';
import './timer-solver-panel.css';

const TimerSolverBody = lazy(() => import('./TimerSolverBody'));
const persistItem = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } };
const phoneSubscribe = (notify: () => void) => {
  if (!window.matchMedia) return () => {};
  const query = window.matchMedia('(max-width: 560px)');
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};

const LS_KEY = 'timer.solverHints.panelOpen';
/** 桌面形态选择:'1' = 全屏,其余 = 左栏。用户自己选的,下次进来保持。 */
const LS_FULL = 'timer.solverHints.full';

/** 一个词就够 —— pill 挤在顶栏那排控件里,「解法提示」四个字白占宽度。 */
const PANEL_TITLE = { zh: '解法', en: 'Solve' };

export interface TimerSolverPanelProps {
  scramble: string;
  language: 'en' | 'zh';
  sheetOpen: boolean;
  onSheetOpenChange(open: boolean, replace?: boolean): void;
  onBlockingChange?(blocked: boolean): void;
  onDismissChange?(dismiss: (() => boolean) | null): void;
  resultsPanelOpen?: boolean;
  autoCollapseOnReady?: boolean;
  autoOpenOnSolve?: number;
  onOpen?: () => void;
}

/** 换题回调。左栏形态下换题归主区(计时面板的径向手势 + 键盘),全屏浮层把整屏盖住了,
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
  useEffect(() => {
    if (!enabled) { startRef.current = null; swallowClickRef.current = false; }
  }, [enabled]);

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
    if (!enabled) { startRef.current = null; return; }
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

function SolverBody({ scramble, language, compact, settingsSlot, onPrevScramble, onNextScramble, onDismissChange, onBlockingChange }: Pick<TimerSolverPanelProps, 'scramble' | 'language' | 'onDismissChange' | 'onBlockingChange'> & ScrambleNav & { compact: boolean; settingsSlot?: HTMLElement | null }) {
  return <Suspense fallback={<div className="solver-panel-loading"><Spinner size={16} label={{ zh: '加载中', en: 'Loading' }[language]} /></div>}>
    <TimerSolverBody scramble={scramble} language={language} compact={compact}
      settingsSlot={settingsSlot} onPrevScramble={onPrevScramble} onNextScramble={onNextScramble} onDismissChange={onDismissChange} onBlockingChange={onBlockingChange} />
  </Suspense>;
}

/** Full-screen sheet. Own component so useModalDismiss's Escape + body-scroll-lock
 *  mount and unmount with the sheet itself. `onDock` 只有桌面传(手机没有左栏可回)。 */
function SolverSheet({ scramble, language, compact, onClose, onDock, onPrevScramble, onNextScramble, onDismissChange, onBlockingChange }: Pick<TimerSolverPanelProps, 'scramble' | 'language' | 'onDismissChange' | 'onBlockingChange'> & ScrambleNav & { compact: boolean; onClose: () => void; onDock?: () => void }) {
  const [settingsSlot, setSettingsSlot] = useState<HTMLSpanElement | null>(null);
  const tr = (text: { en: string; zh: string }) => text[language];
  const dialog = useRef<HTMLDivElement>(null);
  const nestedDismiss = useRef<(() => boolean) | null>(null);
  const [nestedBlocking, setNestedBlocking] = useState(false);
  const reportBlocking = useCallback((blocked: boolean) => {
    setNestedBlocking(blocked);
    onBlockingChange?.(blocked);
  }, [onBlockingChange]);
  const registerDismiss = useCallback((dismiss: (() => boolean) | null) => { nestedDismiss.current = dismiss; }, []);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const dismiss = useCallback(() => { if (!nestedDismiss.current?.()) closeRef.current(); }, []);
  useModalDismiss(dismiss);
  useEffect(() => {
    onDismissChange?.(() => { dismiss(); return true; });
    return () => onDismissChange?.(null);
  }, [dismiss, onDismissChange]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFirst = () => { if (dialog.current) (modalFocusableElements(dialog.current)[0] ?? dialog.current).focus(); };
    focusFirst();
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.closest('[aria-modal="true"]') !== dialog.current && event.target.closest('[aria-modal="true"]')) return;
      if (dialog.current && event.target instanceof Node && !dialog.current.contains(event.target)) focusFirst();
    };
    document.addEventListener('focusin', onFocus);
    return () => { document.removeEventListener('focusin', onFocus); if (previous?.isConnected) previous.focus(); };
  }, []);
  const swipe = useScrambleSwipe(nestedBlocking ? {} : { onPrevScramble, onNextScramble });
  const title = tr(PANEL_TITLE);
  return (
    <div className="solver-sheet" data-no-timer role="dialog" aria-modal="true" aria-label={title} ref={dialog} tabIndex={-1} {...swipe}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss(); }
        if (event.key !== 'Tab' || !dialog.current) return;
        const elements = modalFocusableElements(dialog.current); const first = elements[0]; const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); dialog.current.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <div className="solver-sheet-head">
        <span className="solver-sheet-title">{title}</span>
        <span className="solver-settings-slot" ref={setSettingsSlot} />
        {onDock && (
          <button
            type="button"
            className="solver-layout-action"
            onClick={onDock}
            title={tr({ zh: '还原到左侧面板', en: 'Restore to side panel' })}
            aria-label={tr({ zh: '还原到左侧面板', en: 'Restore to side panel' })}
          >
            <Minimize2 size={16} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="solver-sheet-close"
          onClick={dismiss}
          aria-label={tr({ zh: '关闭', en: 'Close' })}
        >
          <X size={18} />
        </button>
      </div>
      <div className="solver-sheet-body">
        <SolverBody onDismissChange={registerDismiss} onBlockingChange={reportBlocking} scramble={scramble} language={language} compact={compact} settingsSlot={settingsSlot} onPrevScramble={onPrevScramble} onNextScramble={onNextScramble} />
      </div>
    </div>
  );
}

export default function TimerSolverPanel({
  scramble,
  language,
  sheetOpen,
  onSheetOpenChange,
  onDismissChange,
  onBlockingChange,
  resultsPanelOpen = false,
  autoCollapseOnReady = false,
  autoOpenOnSolve = 0,
  onOpen,
  onPrevScramble,
  onNextScramble,
}: TimerSolverPanelProps & ScrambleNav) {
  const [settingsSlot, setSettingsSlot] = useState<HTMLSpanElement | null>(null);
  const tr = (text: { en: string; zh: string }) => text[language];
  const isPhone = useSyncExternalStore(phoneSubscribe, () => !!window.matchMedia?.('(max-width: 560px)').matches, () => false);
  const isDesktopRail = useTimerWideLayout();

  // 桌面左栏展开态(SSR 初值恒 false 避免 hydration mismatch,挂载后再同步)。默认展开:
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

  // 桌面形态偏好(左栏 / 全屏),用户选了就记住:下次进来直接是上次那个形态。
  // 同 railOpen:SSR 初值恒 false,挂载后再读 localStorage。
  const [fullPref, setFullPref] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem(LS_FULL) === '1') setFullPref(true); } catch { /* 隐私模式:留左栏 */ }
  }, []);

  const sheetOpenRef = useRef(sheetOpen);
  sheetOpenRef.current = sheetOpen;
  const closeSheet = useCallback(() => onSheetOpenChange(false), [onSheetOpenChange]);
  const openSheet = () => { onOpen?.(); onSheetOpenChange(true); };

  // 窄屏的解法与成绩都是整屏面板，只保留一个。父页面打开成绩栏时
  // 立即隐藏这里的内容，再同步收起内部状态；从浏览器历史恢复解法浮层时则反向
  // 通知父页面关闭成绩栏。
  useEffect(() => {
    if (!resultsPanelOpen) return;
    setRailOpen(false);
    if (sheetOpen) closeSheet();
  }, [closeSheet, resultsPanelOpen, sheetOpen]);
  useEffect(() => {
    if (!autoCollapseOnReady) return;
    setRailOpen(false);
    if (sheetOpenRef.current) closeSheet();
  }, [autoCollapseOnReady, closeSheet]);
  const openedSolveRequestRef = useRef(0);
  useEffect(() => {
    if (autoOpenOnSolve <= 0 || openedSolveRequestRef.current === autoOpenOnSolve) return;
    openedSolveRequestRef.current = autoOpenOnSolve;
    if (isDesktopRail) setRailOpen(true);
  }, [autoOpenOnSolve, isDesktopRail]);
  useEffect(() => {
    if (sheetOpen) onOpen?.();
  }, [onOpen, sheetOpen]);

  // 桌面切形态:记住选择,并按新形态开 / 关浮层。
  const pickFull = (v: boolean) => {
    autoFullRef.current = true;
    setFullPref(v);
    persistItem(LS_FULL, v ? '1' : '0');
    if (v) openSheet(); else closeSheet();
  };
  // 上次选的是全屏 → 进页面直接给全屏(每次挂载只自动开一次:之后用户切回左栏、
  // 或用返回手势关掉,都不该被这条效应再拽回全屏)。replace:不往返回栈添一格。
  const autoFullRef = useRef(false);
  const previousSheetOpen = useRef(sheetOpen);
  useEffect(() => {
    if (previousSheetOpen.current && !sheetOpen && isDesktopRail) {
      setFullPref(false);
      persistItem(LS_FULL, '0');
      autoFullRef.current = true;
    }
    previousSheetOpen.current = sheetOpen;
  }, [sheetOpen, isDesktopRail]);
  useEffect(() => {
    if (!isDesktopRail || autoFullRef.current) return;
    if (fullPref && railOpen && !sheetOpen) {
      autoFullRef.current = true;
      onSheetOpenChange(true, true);
    }
  }, [isDesktopRail, fullPref, railOpen, sheetOpen, onSheetOpenChange]);

  const open = !resultsPanelOpen && (isDesktopRail ? railOpen : sheetOpen);
  // 左栏正被全屏浮层顶替:内容卸载(同一条打乱不解两遍),但 data-open 保持,
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
      <aside className="solver-panel surface-chrome" data-open={open} data-layout={isDesktopRail ? 'rail' : 'trigger'} data-no-timer>
        {/* display:contents 兜底(见 shell.css):除「桌面左栏已展开」外,头部仍是
            单独一颗 pill,加这层不改任何现有形态。 */}
        <div className="solver-panel-headrow">
          <button
            type="button"
            className="solver-panel-head"
            onClick={toggle}
            aria-expanded={open}
          >
            <span className="solver-panel-title">{title}</span>
            {/* 收起时箭头留在入口内；展开时移到全屏按钮右侧。 */}
            {isDesktopRail && !railOpen && <ChevronRight size={14} className="solver-panel-chevron" />}
          </button>
          {railBodyOpen && <span className="solver-settings-slot" ref={setSettingsSlot} />}
          {isDesktopRail && railOpen && (
            <button
              type="button"
              className="solver-layout-action"
              onClick={() => pickFull(true)}
              aria-haspopup="dialog"
              aria-label={tr({ zh: '全屏查看解法', en: 'View solutions fullscreen' })}
              title={tr({ zh: '全屏查看解法', en: 'View solutions fullscreen' })}
            >
              <Maximize2 size={16} aria-hidden="true" />
            </button>
          )}
          {isDesktopRail && railOpen && (
            <button
              type="button"
              className="solver-layout-action"
              onClick={(e) => { toggle(); e.currentTarget.blur(); }}
              aria-expanded={open}
              aria-label={tr({ zh: '收起解法面板', en: 'Collapse solutions panel' })}
              title={tr({ zh: '收起解法面板', en: 'Collapse solutions panel' })}
            >
              <ChevronRight size={14} className="solver-panel-chevron" aria-hidden="true" />
            </button>
          )}
        </div>
        {railBodyOpen && (
          <div className="solver-panel-body">
            <SolverBody onDismissChange={onDismissChange} onBlockingChange={onBlockingChange} scramble={scramble} language={language} compact settingsSlot={settingsSlot} onPrevScramble={onPrevScramble} onNextScramble={onNextScramble} />
          </div>
        )}
      </aside>
      {sheetOpen && !resultsPanelOpen && mounted && createPortal(
        // 紧凑排版只给真手机;平板 / 桌面全屏都够宽,摊开排。
        // 桌面提供还原按钮(切回左栏 = 关浮层并记住);手机没有左栏,只留 ✕。
        <SolverSheet
          scramble={scramble}
          language={language}
          compact={isPhone}
          onDismissChange={onDismissChange} onBlockingChange={onBlockingChange}
          // 桌面关掉全屏 = 选回左栏(否则记着的形态与眼前看到的不一致,一刷新又弹回全屏)。
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
