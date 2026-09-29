import { useEffect, useRef, useState } from 'react';
import { Target } from 'lucide-react';
import { formatTargetTime, type TimerSettingCopy } from '@cuberoot/shared/timer';
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
  if (targetMs === null) return null;
  const delta = targetMs - displayMs;
  return <div className={`timer-target-indicator${delta < 0 ? ' overshot' : ''}`}>
    <Target size={12} />
    <span className="target-label">{localize({ zh: '目标', en: 'target' })} {formatTargetTime(targetMs)}</span>
    <span className="target-delta">{`${delta >= 0 ? '+' : '-'}${(Math.abs(delta) / 1000).toFixed(2)}s`}</span>
  </div>;
}
