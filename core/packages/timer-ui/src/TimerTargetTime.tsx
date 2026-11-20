import { useEffect, useRef, useState } from 'react';
import { Target } from 'lucide-react';
import { timerTargetIndicator, type TimerSettingCopy } from '@cuberoot/shared/timer';
import './timer-target-time.css';

/** Both hosts use elapsed milliseconds, never formatted display text. */
export function useTimerTargetFeedback(phase: string, displayMs: number, targetMs: number | null) {
  const [pulse, setPulse] = useState<'good' | 'bad' | null>(null);
  const previousPhase = useRef(phase);
  useEffect(() => {
    const stopped = phase === 'stopped' && previousPhase.current !== 'stopped';
    previousPhase.current = phase;
    if (!stopped || targetMs === null || !Number.isFinite(displayMs)) {
      setPulse(null);
      return;
    }
    setPulse(displayMs <= targetMs ? 'good' : 'bad');
    const handle = window.setTimeout(() => setPulse(null), 1000);
    return () => window.clearTimeout(handle);
  }, [phase, displayMs, targetMs]);
  const overshot = phase === 'running' && targetMs !== null && displayMs > targetMs;
  return `${overshot ? 'target-overshot' : ''} ${pulse ? `target-pulse-${pulse}` : ''}`.trim();
}

export function TimerTargetTime({ targetMs, displayMs, localize }: {
  targetMs: number | null;
  displayMs: number;
  localize(copy: TimerSettingCopy): string;
}) {
  const indicator = timerTargetIndicator(targetMs, displayMs, localize);
  if (!indicator) return null;
  return <div className={`timer-target-indicator${indicator.overshot ? ' overshot' : ''}`}>
    <Target size={12} />
    <span className="target-label">{indicator.label}</span>
    <span className="target-delta">{indicator.delta}</span>
  </div>;
}
