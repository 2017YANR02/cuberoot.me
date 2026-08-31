'use client';

import {
  timerManualEntryCopy,
  type EventId,
  type Solve,
  type TimerManualEntryValue,
} from '@cuberoot/shared/timer';
import { TimerManualEntryModal } from '@cuberoot/timer-ui';

import { useLang } from '@/i18n/tr';

import { makeSolve } from '../_lib/storage/db';

interface Props {
  event: EventId;
  currentScramble: string;
  onClose: () => void;
  onSubmit: (solve: Solve) => void;
}

function toSolve(value: TimerManualEntryValue): Solve {
  const solve = makeSolve({
    comment: value.comment,
    event: value.event,
    penalty: value.penalty,
    scramble: value.scramble,
    timeMs: value.timeMs,
  });
  return value.mbld ? { ...solve, mbld: value.mbld } : solve;
}

export default function ManualEntryModal({ event, currentScramble, onClose, onSubmit }: Props) {
  const language = useLang();
  return (
    <TimerManualEntryModal
      currentScramble={currentScramble}
      event={event}
      labels={timerManualEntryCopy(language)}
      onClose={onClose}
      onSubmit={(value) => onSubmit(toSolve(value))}
    />
  );
}
