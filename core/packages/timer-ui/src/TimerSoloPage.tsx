'use client';
import { useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { SolverTriggerContext } from './solver-trigger-context';
import { TimerTopbar, type TimerTopbarProps } from './TimerChrome';
import { TimerStageLayout, type TimerStageLayoutProps } from './TimerStageLayout';
import { TimerWorkspaceDivider, useTimerWideLayout } from './TimerWorkspace';
import './timer-solo-page.css';
import { TimerTools, type TimerToolsProps } from './TimerTools';
import TimingSurface from './TimingSurface';

export interface TimerSoloPageProps {
  title?: string;
  resizeLabel?: string;
  topbar: TimerTopbarProps;
  stage: Omit<TimerStageLayoutProps, 'children'>;
  timing: Omit<ComponentProps<typeof TimingSurface>, 'layout'>;
  solver?: ReactNode;
  afterTiming?: ReactNode;
  narrowRecap?: ReactNode;
  hints?: ReactNode;
  history?: ReactNode;
  tools?: TimerToolsProps;
}
/** Canonical Solo view. Routing, stores and device transports stay with hosts;
 * this component owns responsive placement and renders exactly one solver. */
export function TimerSoloPage({ title, resizeLabel = 'Resize panel', topbar, stage, timing, solver, afterTiming, narrowRecap, hints, history, tools }: TimerSoloPageProps) {
  const wide = useTimerWideLayout();
  const [solverTriggerSlot, setSolverTriggerSlot] = useState<HTMLSpanElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { surfaceRef, onContextMenu, onMouseDown, onMouseUp, onPointerDown, onPointerUp, onPointerCancel, ...canvas } = timing;
  return <SolverTriggerContext.Provider value={solverTriggerSlot}>
    <TimerTopbar {...topbar} className={`timer-solo-topbar${stage.fullscreen ? ' timer-solo-topbar--fullscreen' : ''}${topbar.className ? ` ${topbar.className}` : ''}`}
      controls={<>{solver && <span className="solver-trigger-slot" ref={setSolverTriggerSlot} />}{topbar.controls}{!wide && solver}</>} />
    <TimerStageLayout {...stage} inputRef={surfaceRef}
      inputHandlers={{ onContextMenu, onMouseDown, onMouseUp, onPointerDown, onPointerUp, onPointerCancel }}
      className={`timer-solo-main timer-workspace-main timer-solver-stage${stage.className ? ` ${stage.className}` : ''}`}>
      {title && <h1 className="sr-only">{title}</h1>}
      <TimingSurface {...canvas} surfaceRef={canvasRef} layout="solo" />
      {!wide && narrowRecap && <div data-no-timer style={{ display: 'contents' }}>{narrowRecap}</div>}
      <div className="timer-solo-after-timing surface-chrome" data-no-timer hidden={stage.fullscreen}>
        {afterTiming}
        {hints}
      </div>
      {wide && <TimerWorkspaceDivider side="left" label={resizeLabel} />}
      <div className="shell-rail timer-solver-rail" data-no-timer>{wide && solver}</div>
    </TimerStageLayout>
    {history}
    {tools && <TimerTools {...tools} />}
  </SolverTriggerContext.Provider>;
}
/** Solver sheets permit navigation keys; every other overlay blocks them. */
export function timerSoloModalState(blocking: boolean, solverSheet: boolean): 'blocking' | 'hints-only' | 'none' {
  return blocking ? 'blocking' : solverSheet ? 'hints-only' : 'none';
}

const compactQuery = '(max-width: 480px)';
function subscribeCompact(notify: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(compactQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}
/** Matches the Web More menu's compact-only actions, independently of dock width. */
export function useTimerSoloCompactLayout() {
  return useSyncExternalStore(subscribeCompact, () => typeof window.matchMedia === 'function' && window.matchMedia(compactQuery).matches, () => false);
}
