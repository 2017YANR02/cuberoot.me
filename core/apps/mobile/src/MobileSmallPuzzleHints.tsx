import {
  timerSmallPuzzleHintCopy,
  timerSupportsSmallPuzzleHints,
  type EventId,
  type TimerPhase,
} from '@cuberoot/shared/timer';
import { TimerSmallPuzzleHints } from '@cuberoot/timer-ui';

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
