'use client';

/**
 * SolverHintPanel — 计时器「解法提示」常驻面板(替代旧 StageSolverModal 弹层)。
 *
 * 布局:网页端 (≥1024px) 收成主区右侧的常驻竖栏;手机端落在打乱图案下方的流式块。
 * 用户可随时收起/展开,状态记进 localStorage(默认收起,避免每次进计时器都拉 ~27MB 表)。
 *
 * 引擎/动画仍复用 components/StageSolver(analyzer 主面板同款),首次展开才 next/dynamic
 * 拉表;收起后再展开复用站内共享池(getRustCrossPool 单例),不重拉。
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import StepSolve from './StepSolve';
import { tr } from '@/i18n/tr';

const StageSolver = dynamic(() => import('@/components/StageSolver'), {
  ssr: false,
  loading: () => (
    <div className="solver-panel-loading">
      <Loader2 size={16} className="solver-modal-spin" />
    </div>
  ),
});

const LS_KEY = 'timer.solverHints.panelOpen';

interface Props {
  scramble: string;
  isZh: boolean;
}

export default function SolverHintPanel({ scramble, isZh }: Props) {
  const [open, setOpen] = useState(false);
  const isPhone = useIsMobile(560);
  const isDesktopRail = !useIsMobile(1023); // ≥1024 时面板是右侧 ~360px 窄栏
  // 窄场景(手机 / 桌面右栏)给 StageSolver 紧凑布局;中间带(平板内联满宽)不压缩。
  const compact = isPhone || isDesktopRail;

  // 读 localStorage 记住的展开态(SSR 初值恒 false,挂载后再同步,避免 hydration mismatch)。
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY) === '1') setOpen(true);
    } catch { /* ignore */ }
  }, []);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try { localStorage.setItem(LS_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const title = tr({ zh: '解法提示', en: 'Solver hints' });

  return (
    <aside className="solver-panel surface-chrome" data-open={open} data-no-timer>
      <button
        type="button"
        className="solver-panel-head"
        onClick={(e) => { toggle(); e.currentTarget.blur(); }}
        aria-expanded={open}
      >
        <span className="solver-panel-title">{title}</span>
        <ChevronRight size={14} className="solver-panel-chevron" />
      </button>
      {open && (
        <div className="solver-panel-body">
          <StageSolver scramble={scramble} lang={isZh ? 'zh' : 'en'} compact={compact} />
          <StepSolve scramble={scramble} isZh={isZh} />
        </div>
      )}
    </aside>
  );
}
