'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Solve } from '@cuberoot/shared/timer';
import type { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';

type LiveSolve = Solve & { liveGyroSamples: ReturnType<SmartCubeAttemptProducer['snapshotLive']>['gyroSamples'] };
type Context = Pick<Solve, 'event' | 'scramble'> & { startedAt: number };

/** Throttle presentation only; hosts still record and detect completion synchronously. */
export function useLiveSmartCubeAttempt(producer: SmartCubeAttemptProducer, getContext: () => Context | null, enabled = true) {
  const [solve, setSolve] = useState<LiveSolve | null>(null);
  const contextRef = useRef(getContext);
  contextRef.current = getContext;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (pending.current !== null) clearTimeout(pending.current);
    pending.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const clear = useCallback(() => { cancel(); setSolve(null); }, [cancel]);
  const publish = useCallback(() => {
    if (!enabledRef.current || pending.current !== null) return;
    const context = contextRef.current();
    if (!context) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      if (!enabledRef.current || contextRef.current()?.startedAt !== context.startedAt) return;
      const { moves, device, gyroSamples } = producer.snapshotLive();
      if (!moves.length) return;
      setSolve({ id: `live-${context.startedAt}`, event: context.event, scramble: context.scramble,
        timeMs: moves.at(-1)?.ts ?? 0, penalty: 'ok', ts: 0, moves, device, liveGyroSamples: gyroSamples });
    }, 100);
  }, [producer]);
  useEffect(() => {
    if (enabled) publish();
    else clear();
  }, [enabled, publish, clear]);
  return { solve: enabled ? solve : null, publish, clear };
}

export function TimerLiveSolutionPanel({ language, children }: { language: 'en' | 'zh'; children: ReactNode }) {
  const label = language === 'zh' ? '实时解法' : 'Live solution';
  return <section className="shell-recap timer-live-solution" data-no-timer aria-label={label}>
    <div className="shell-recap-head timer-live-solution-label">{label}</div>
    <div className="shell-recap-body">{children}</div>
  </section>;
}
