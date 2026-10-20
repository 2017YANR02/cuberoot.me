import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import StageSolver from './StageSolver';
import './TimerStepSolve.css';
const TimerStepSolve = lazy(() => import('./TimerStepSolve'));

export default function TimerSolverBody({ view = 'solutions', scramble, language, compact, settingsSlot, onPrevScramble, onNextScramble, onDismissChange, onBlockingChange }: {
  view?: 'solutions' | 'steps';
  scramble: string; language: 'en' | 'zh'; compact: boolean; settingsSlot?: HTMLElement | null;
  onPrevScramble?(): void; onNextScramble?(): void;
  onBlockingChange?(blocked: boolean): void;
  onDismissChange?(dismiss: (() => boolean) | null): void;
}) {
  const [stageBlocking, setStageBlocking] = useState(false);
  const [compareBlocking, setCompareBlocking] = useState(false);
  useEffect(() => {
    onBlockingChange?.(stageBlocking || compareBlocking);
    return () => onBlockingChange?.(false);
  }, [stageBlocking, compareBlocking, onBlockingChange]);
  const compareDismiss = useRef<(() => boolean) | null>(null);
  const stageDismiss = useRef<(() => boolean) | null>(null);
  const registerCompare = useCallback((dismiss: (() => boolean) | null) => { compareDismiss.current = dismiss; }, []);
  const registerStage = useCallback((dismiss: (() => boolean) | null) => { stageDismiss.current = dismiss; }, []);
  useEffect(() => {
    onDismissChange?.(() => compareDismiss.current?.() || stageDismiss.current?.() || false);
    return () => onDismissChange?.(null);
  }, [onDismissChange]);
  return <div data-no-timer onKeyDown={event => {
    if (event.key === 'Escape' && stageDismiss.current?.()) { event.preventDefault(); event.stopPropagation(); }
  }}>
    {view === 'solutions' ? <>
      {scramble.trim() && <p className="solver-panel-scramble">{scramble}</p>}
      <StageSolver scramble={scramble} lang={language} compact={compact} expandedSolutions={!compact} settingsSlot={settingsSlot}
        onPrevScramble={onPrevScramble} onNextScramble={onNextScramble} onDismissChange={registerStage} onBlockingChange={setStageBlocking} />
    </> : <Suspense fallback={null}>
      <TimerStepSolve scramble={scramble} isZh={language === 'zh'} onDismissChange={registerCompare} onBlockingChange={setCompareBlocking} />
    </Suspense>}
  </div>;
}
