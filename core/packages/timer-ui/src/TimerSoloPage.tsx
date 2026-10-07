'use client';
import { useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { TimerTopbar, type TimerTopbarProps } from './TimerChrome';
import { TimerStageLayout, type TimerStageLayoutProps } from './TimerStageLayout';
import { useTimerWideLayout } from './TimerWorkspace';
import './timer-solo-page.css';
import { TimerTools, type TimerToolsProps } from './TimerTools';
import TimingSurface from './TimingSurface';

export interface TimerSoloPageProps {
  title?: string;
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
export function TimerSoloPage({ title, topbar, stage, timing, solver, afterTiming, narrowRecap, hints, history, tools }: TimerSoloPageProps) {
  const wide = useTimerWideLayout();
  return <>
    <TimerTopbar {...topbar} className={`timer-solo-topbar${stage.fullscreen ? ' timer-solo-topbar--fullscreen' : ''}${topbar.className ? ` ${topbar.className}` : ''}`}
      controls={<>{topbar.controls}{!wide && solver}</>} />
    <TimerStageLayout {...stage} className={`timer-solo-main timer-workspace-main timer-solver-stage${stage.className ? ` ${stage.className}` : ''}`}>
      {title && <h1 className="sr-only">{title}</h1>}
      <TimingSurface {...timing} layout="solo" />
      {!wide && narrowRecap}
      <div className="timer-solo-after-timing surface-chrome" hidden={stage.fullscreen}>
        {afterTiming}
        {hints}
      </div>
      <div className="shell-rail timer-solver-rail" data-no-timer>{wide && solver}</div>
    </TimerStageLayout>
    {history}
    {tools && <TimerTools {...tools} />}
  </>;
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
