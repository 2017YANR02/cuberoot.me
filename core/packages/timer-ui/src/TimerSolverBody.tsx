import { useCallback, useEffect, useRef } from 'react';
import StageSolver from './StageSolver';
import TimerStepSolve from './TimerStepSolve';

export default function TimerSolverBody({ scramble, language, compact, settingsSlot, onPrevScramble, onNextScramble, onDismissChange }: {
  scramble: string; language: 'en' | 'zh'; compact: boolean; settingsSlot?: HTMLElement | null;
  onPrevScramble?(): void; onNextScramble?(): void;
  onDismissChange?(dismiss: (() => boolean) | null): void;
}) {
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
    {scramble.trim() && <p className="solver-panel-scramble">{scramble}</p>}
    <StageSolver scramble={scramble} lang={language} compact={compact} settingsSlot={settingsSlot}
      onPrevScramble={onPrevScramble} onNextScramble={onNextScramble} onDismissChange={registerStage} />
    <TimerStepSolve scramble={scramble} isZh={language === 'zh'} onDismissChange={registerCompare} />
  </div>;
}
