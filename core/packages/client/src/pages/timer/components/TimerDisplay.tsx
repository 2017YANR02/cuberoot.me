import { formatMs } from '../stats';
import type { TimerPhase } from '../useTimer';

interface Props {
  phase: TimerPhase;
  displayMs: number;
  /** Last solve's effective penalty for color hint after stop. */
  lastPenalty?: 'ok' | '+2' | 'DNF' | null;
}

export default function TimerDisplay({ phase, displayMs, lastPenalty }: Props) {
  const cls =
    phase === 'holding' ? 'holding' :
    phase === 'ready'   ? 'ready' :
    phase === 'running' ? 'running' :
    lastPenalty === 'DNF' ? 'dnf' : '';

  // While running, show shorter (no millis) for readability; while stopped show full precision.
  let text: string;
  if (phase === 'running') {
    text = formatMs(displayMs, 2).replace(/\.\d+$/, ''); // drop sub-second while running
  } else if (phase === 'stopped' && lastPenalty === 'DNF') {
    text = 'DNF';
  } else if (phase === 'stopped' && lastPenalty === '+2') {
    text = formatMs(displayMs + 2000, 2) + '+';
  } else {
    text = formatMs(displayMs, 2);
  }

  return <div className={`timer-display ${cls}`}>{text}</div>;
}
