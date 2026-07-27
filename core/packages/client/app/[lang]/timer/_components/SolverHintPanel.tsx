'use client';

/**
 * SolverHintPanel — 计时器「解法提示」面板(替代旧 StageSolverModal 弹层)。
 *
 * 同一份内容,两套形态:
 *  · 桌面 (≥1024px):收成主区右侧的常驻可折叠竖栏。展开态记进 localStorage
 *    (默认展开;只有用户手动收起过 '0' 才保持收起。展开会 next/dynamic 拉
 *    StageSolver + ~27MB cross 表,故收起态显式记住以尊重用户选择)。
 *  · 手机 / 平板 (<1024px):pill 常驻在打乱图案下方,点开 = 全屏浮层。原先是
 *    就地展开,但 pill 本就贴在底栏上方,展开出来的内容整块落在首屏之外、
 *    页面又不跟着滚,点下去屏幕毫无变化 —— 看上去就是「没反应」(issue #49)。
 *    浮层开合走 URL(?hints=1,history push),所以安卓返回键 / 手势返回能关掉它。
 *
 * 引擎/动画仍复用 components/StageSolver(analyzer 主面板同款),首次展开才 next/dynamic
 * 拉表;收起后再展开复用站内共享池(getRustCrossPool 单例),不重拉。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQueryState, parseAsBoolean } from 'nuqs';
import { ChevronRight, Maximize2, X } from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import StepSolve from './StepSolve';
import { persistItem } from '@/lib/safe-storage';
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

/** URL param owning the phone full-screen sheet. Shared by SoloView (which folds
 *  it into `anyModalOpen` so Space/Escape don't reach the timer behind it). */
export const HINTS_PARAM = 'hints';

interface Props {
  scramble: string;
  isZh: boolean;
}

function SolverBody({ scramble, isZh, compact }: Props & { compact: boolean }) {
  return (
    <>
      <StageSolver scramble={scramble} lang={isZh ? 'zh' : 'en'} compact={compact} />
      <StepSolve scramble={scramble} isZh={isZh} />
    </>
  );
}

/** Full-screen sheet (phones/tablets). Own component so useModalDismiss's Escape
 *  + body-scroll-lock mount and unmount with the sheet itself. */
function SolverSheet({ scramble, isZh, compact, onClose }: Props & { compact: boolean; onClose: () => void }) {
  useModalDismiss(onClose);
  const title = tr({ zh: '解法提示', en: 'Solver hints' });
  return (
    <div className="solver-sheet" data-no-timer role="dialog" aria-modal="true" aria-label={title}>
      <div className="solver-sheet-head">
        <span className="solver-sheet-title">{title}</span>
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

export default function SolverHintPanel({ scramble, isZh }: Props) {
  const isPhone = useIsMobile(560);
  const isDesktopRail = !useIsMobile(1023); // ≥1024 时面板是右侧 ~360px 窄栏
  // 窄场景(手机 / 桌面右栏)给 StageSolver 紧凑布局;中间带(平板全屏浮层)不压缩。
  const compact = isPhone || isDesktopRail;

  // 桌面右栏展开态(SSR 初值恒 false 避免 hydration mismatch,挂载后再同步)。默认展开:
  // 仅当用户此前手动收起过('0')才保持收起,其余情况(无记录 / '1')一律展开。
  const [railOpen, setRailOpen] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY) !== '0') setRailOpen(true);
    } catch { setRailOpen(true); }
  }, []);

  // 手机全屏浮层态 —— 归 URL 管,返回键即关闭。桌面用不到它。
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
  // 转到桌面宽度(旋屏 / 拉窗)后浮层已不存在,顺手把残留的 ?hints=true 抹掉,
  // 免得再缩回手机宽度时凭空弹出一个全屏浮层。replace:不给返回栈添一格。
  useEffect(() => {
    if (isDesktopRail && sheetOpen) void setSheetOpen(null, { history: 'replace' });
  }, [isDesktopRail, sheetOpen, setSheetOpen]);

  const open = isDesktopRail ? railOpen : sheetOpen;

  const toggle = () => {
    if (!isDesktopRail) {
      if (sheetOpen) { closeSheet(); return; }
      pushedRef.current = true;
      void setSheetOpen(true);
      return;
    }
    setRailOpen((o) => {
      const next = !o;
      persistItem(LS_KEY, next ? '1' : '0');
      return next;
    });
  };

  const title = tr({ zh: '解法提示', en: 'Solver hints' });

  return (
    <>
      <aside className="solver-panel surface-chrome" data-open={open} data-no-timer>
        <button
          type="button"
          className="solver-panel-head"
          onClick={(e) => { toggle(); e.currentTarget.blur(); }}
          aria-expanded={open}
        >
          <span className="solver-panel-title">{title}</span>
          {/* 手机上点开的是全屏浮层,用「放大」图标示意;桌面才是就地折叠的 chevron。 */}
          {isDesktopRail
            ? <ChevronRight size={14} className="solver-panel-chevron" />
            : <Maximize2 size={13} className="solver-panel-expand" />}
        </button>
        {isDesktopRail && open && (
          <div className="solver-panel-body">
            <SolverBody scramble={scramble} isZh={isZh} compact={compact} />
          </div>
        )}
      </aside>
      {!isDesktopRail && open && (
        <SolverSheet scramble={scramble} isZh={isZh} compact={compact} onClose={closeSheet} />
      )}
    </>
  );
}
