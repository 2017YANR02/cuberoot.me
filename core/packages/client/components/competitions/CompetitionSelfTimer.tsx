import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { inspectionPenalty } from '@cuberoot/shared/timer';
import { useT } from '@/hooks/useT';
import type { CompetitionAttemptResult } from '@/lib/online-competition-api';
import { useCompetitionTimerControls } from './useCompetitionTimerControls';

const INSPECTION_SECONDS = 15;
const DNF = { centiseconds: null, penalty: 'DNF' } as const;

export function CompetitionSelfTimer({ disabled, onResult }: {
  disabled: boolean; onResult: (result: CompetitionAttemptResult) => void;
}) {
  const t = useT();
  const [inspectAt, setInspectAt] = useState<number | null>(null);
  const [solve, setSolve] = useState<{ at: number; penalty: 'none' | '+2' } | null>(null);
  const [result, setResult] = useState<CompetitionAttemptResult | null>(null);
  const [now, setNow] = useState(0);
  const heldPointer = useRef(false);
  const finished = useRef(false);
  const phase = solve ? 'solve' : inspectAt !== null ? 'inspection' : 'scramble';
  const elapsed = inspectAt === null ? 0 : Math.max(0, now - inspectAt);
  const inspection = inspectionPenalty(elapsed, INSPECTION_SECONDS);

  function finish(next: CompetitionAttemptResult) {
    if (finished.current) return;
    finished.current = true;
    setResult(next);
    onResult(next);
  }

  function inspect() {
    const time = performance.now();
    setNow(time);
    setInspectAt(time);
  }

  function start() {
    if (inspectAt === null) return;
    const at = performance.now();
    const penalty = inspectionPenalty(at - inspectAt, INSPECTION_SECONDS);
    if (penalty === 'DNF') finish(DNF);
    else {
      setNow(at);
      setSolve({ at, penalty: penalty === '+2' ? '+2' : 'none' });
    }
  }

  function stop() {
    if (!solve) return;
    finish({ centiseconds: Math.max(1, Math.floor((performance.now() - solve.at) / 10)), penalty: solve.penalty });
  }

  const tick = useEffectEvent(() => {
    const time = performance.now();
    if (!solve && inspectAt !== null && inspectionPenalty(time - inspectAt, INSPECTION_SECONDS) === 'DNF') finish(DNF);
    else setNow(time);
  });
  const locked = disabled || result !== null;
  useEffect(() => {
    if (locked || phase === 'scramble') return;
    const interval = setInterval(() => tick(), phase === 'solve' ? 31 : 50);
    return () => clearInterval(interval);
  }, [locked, phase]);
  const controls = useCompetitionTimerControls({ phase, disabled: locked, onInspect: inspect, onStart: start, onStop: stop });
  const display = result
    ? result.penalty === 'DNF' ? 'DNF' : ((result.centiseconds ?? 0) / 100).toFixed(2) + (result.penalty === '+2' ? ' +2' : '')
    : solve ? (Math.floor(Math.max(0, now - solve.at) / 10) / 100).toFixed(2)
      : inspection === '+2' ? '+2' : `${Math.max(0, Math.ceil(INSPECTION_SECONDS - elapsed / 1000))}s`;

  const face = <output aria-label={t('内置计时', 'Built-in timer')} aria-live="off" data-ready={controls.ready || undefined}>{display}</output>;
  return <div className="competition-duel-timer competition-self-timer">
    {phase === 'solve' && !result ? <button type="button" className="competition-timer-face"
      aria-label={t('点击计时数字停表', 'Tap the time to stop')} onClick={stop}>{face}</button> : face}
    {!result && <p className="competition-muted">{phase === 'solve' ? t('按任意键或点击停表。', 'Press any key or tap to stop.')
      : controls.ready ? t('已就绪，松开起表。', 'Ready. Release to start.')
        : phase === 'inspection' ? t('长按空格或按钮，松开起表。', 'Hold Space or the button, then release to start.')
          : t('打乱后按空格开始观察。', 'Press Space after scrambling to start inspection.')}</p>}
    {!result && <button type="button" className="competition-secondary" disabled={locked} data-competition-timer-control
      onPointerDown={event => {
        heldPointer.current = phase === 'inspection' && event.button === 0;
        if (!heldPointer.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        controls.beginHold();
      }}
      onPointerUp={() => { controls.releaseHold(); }}
      onPointerCancel={controls.cancelHold} onLostPointerCapture={controls.cancelHold}
      onClick={event => {
        if (heldPointer.current && event.detail > 0) { heldPointer.current = false; return; }
        if (phase === 'scramble') inspect();
        else if (phase === 'solve') stop();
        else if (event.detail === 0) start();
      }}>{phase === 'solve' ? t('停表', 'Stop timer') : phase === 'inspection' ? t('长按准备', 'Hold to start') : t('开始观察', 'Start inspection')}</button>}
    {!result && phase !== 'solve' && <button type="button" className="competition-secondary" disabled={locked} onClick={() => finish(DNF)}>DNF</button>}
  </div>;
}
