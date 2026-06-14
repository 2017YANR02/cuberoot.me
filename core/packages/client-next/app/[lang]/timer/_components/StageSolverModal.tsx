'use client';

/**
 * StageSolverModal — 计时器「解法提示」弹层,内嵌分析器同款共享组件
 * components/StageSolver(Rust→WASM 逐阶段最优解 + 6 视角 + 多解 + 3D 播放器)。
 *
 * 不重复造轮子:解法引擎/动画全部复用 StageSolver(analyzer 主面板 + gen 行内也用它)。
 * StageSolver 首次要拉 ~27MB WASM 表 + TwistyPlayer,没必要打进计时器首屏包,所以走
 * next/dynamic(ssr:false)——表只在用户点开弹层时才加载(同 gen SheetView 的做法)。
 */

import { useEffect, useId } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';

const StageSolver = dynamic(() => import('@/components/StageSolver'), {
  ssr: false,
  loading: () => (
    <div className="solver-modal-loading">
      <Loader2 size={16} className="solver-modal-spin" />
    </div>
  ),
});

interface Props {
  scramble: string;
  isZh: boolean;
  onClose: () => void;
}

export default function StageSolverModal({ scramble, isZh, onClose }: Props) {
  const titleId = useId();
  const isMobile = useIsMobile(560);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal timer-modal--solver"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="solver-modal-head">
          <h2 id={titleId}>{tr({ zh: '解法提示', en: 'Solver hints' })}</h2>
          <button
            type="button"
            className="solver-modal-x"
            onClick={onClose}
            aria-label={tr({ zh: '关闭', en: 'Close'
            })}
          >
            <X size={18} />
          </button>
        </div>
        <StageSolver scramble={scramble} lang={isZh ? 'zh' : 'en'} compact={isMobile} />
      </div>
    </div>
  );
}
