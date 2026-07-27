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

/** 一个词就够 —— pill 挤在顶栏那排控件里,「解法提示」四个字白占宽度。 */
const PANEL_TITLE = { zh: '解法', en: 'Solve' };

interface Props {
  scramble: string;
  isZh: boolean;
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

/** Full-screen sheet (phones/tablets). Own component so useModalDismiss's Escape
 *  + body-scroll-lock mount and unmount with the sheet itself. */
function SolverSheet({ scramble, isZh, compact, onClose }: Props & { compact: boolean; onClose: () => void }) {
  useModalDismiss(onClose);
  const title = tr(PANEL_TITLE);
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

  // 浮层要 portal 到 document.body(见文件头注),预渲染时没有 body → 挂载后才画。
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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

  const title = tr(PANEL_TITLE);

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
          {/* 桌面的 chevron 描述的是就地折叠,留着。手机上点开的是全屏浮层,原来配了个
              「放大」图标 —— 顶栏那排控件里只剩文字更干净,去掉。 */}
          {isDesktopRail && <ChevronRight size={14} className="solver-panel-chevron" />}
        </button>
        {isDesktopRail && open && (
          <div className="solver-panel-body">
            <SolverBody scramble={scramble} isZh={isZh} compact={compact} />
          </div>
        )}
      </aside>
      {!isDesktopRail && open && mounted && createPortal(
        <SolverSheet scramble={scramble} isZh={isZh} compact={compact} onClose={closeSheet} />,
        document.body,
      )}
    </>
  );
}
