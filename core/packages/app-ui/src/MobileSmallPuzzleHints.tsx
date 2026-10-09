import {
  timerSmallPuzzleHintCopy,
  timerSupportsSmallPuzzleHints,
  type EventId,
  type TimerPhase,
} from '@cuberoot/shared/timer';
import { TimerSmallPuzzleHints } from '@cuberoot/timer-ui';
import { lazy, Suspense } from 'react';
const TimerSolverHints = lazy(() => import('@cuberoot/timer-ui/TimerSolverHints'));

import type { SupportedLanguage } from './copy';

interface MobileSmallPuzzleHintsProps {
  event: EventId;
  language: SupportedLanguage;
  phase: TimerPhase;
  scramble: string;
}

/** Thin Mobile host adapter; solver state and React UI stay shared with Web. */
export function MobileSmallPuzzleHints({
  event,
  language,
  phase,
  scramble,
}: MobileSmallPuzzleHintsProps) {
  if (event === 'sq1' || event === 'mega') return <div className="mobile-solution-hints surface-chrome" data-no-timer>
    <Suspense fallback={null}><TimerSolverHints event={event} scramble={scramble} isZh={language === 'zh'} /></Suspense>
  </div>;
  if (!timerSupportsSmallPuzzleHints(event)) return null;
  return (
    <div className="mobile-solution-hints surface-chrome">
      <TimerSmallPuzzleHints
        event={event}
        labels={timerSmallPuzzleHintCopy(event, language)}
        phase={phase}
        scramble={scramble}
      />
    </div>
  );
}
