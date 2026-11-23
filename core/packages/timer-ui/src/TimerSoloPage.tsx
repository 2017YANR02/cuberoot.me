'use client';
import { useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { LayoutTemplate, Settings } from 'lucide-react';
import { SolverTriggerContext } from './solver-trigger-context';
import { TimerTopbar, type TimerTopbarProps } from './TimerChrome';
import { TimerStageLayout, type TimerStageLayoutProps } from './TimerStageLayout';
import { TimerWorkspaceDivider, useTimerWideLayout } from './TimerWorkspace';
import './timer-solo-page.css';
import { TimerTools, type TimerToolsProps } from './TimerTools';
import TimingSurface from './TimingSurface';
import { useHostViewportLayout } from './host-viewport';
import { Tooltip } from './Tooltip';

export interface TimerSoloControlsProps {
  project?: ReactNode;
  content?: ReactNode;
  method?: ReactNode;
  source?: ReactNode;
  afterSource?: ReactNode;
  layout?: { label: string; editing: boolean; disabled?: boolean; hideTooltip?: boolean; onToggle(): void };
  settings?: { label: string; disabled?: boolean; onOpen(): void };
}

export function TimerSoloControls({ project, content, method, source, afterSource, layout, settings }: TimerSoloControlsProps) {
  return <>
    {project}
    {content}
    {method}
    {source}
    {afterSource}
    {layout && <Tooltip content={layout.label} disabled={layout.hideTooltip}>{tip => (
      <button {...tip} type="button" className="timer-solo-control solo-layout-toggle" data-no-timer
        aria-label={layout.label} aria-pressed={layout.editing} disabled={layout.disabled}
        onClick={layout.onToggle}><LayoutTemplate size={18} strokeWidth={1.6} aria-hidden="true" /></button>
    )}</Tooltip>}
    {settings && <button type="button" className="timer-solo-control settings-popover-trigger" data-no-timer
      aria-label={settings.label} aria-haspopup="dialog" disabled={settings.disabled}
      onClick={settings.onOpen}><Settings size={18} aria-hidden="true" /></button>}
  </>;
}

export interface TimerSoloPageProps {
  title?: string;
  resizeLabel?: string;
  topbar: Omit<TimerTopbarProps, 'actions'> & { liveStatus?: string };
  stage: Omit<TimerStageLayoutProps, 'children'>;
  timing: Omit<ComponentProps<typeof TimingSurface>, 'layout'>;
  solver?: ReactNode;
  capturePreview?: ReactNode;
  afterTiming?: ReactNode;
  narrowRecap?: ReactNode;
  hints?: ReactNode;
  history?: ReactNode;
  tools?: TimerToolsProps;
}
/** Canonical Solo view. Routing, stores and device transports stay with hosts;
 * this component owns responsive placement and renders exactly one solver. */
export function TimerSoloPage({ title, resizeLabel = 'Resize panel', topbar, stage, timing, solver, capturePreview, afterTiming, narrowRecap, hints, history, tools }: TimerSoloPageProps) {
  const hinge = useHostViewportLayout()?.hinge;
  const separateSolver = Boolean(hinge && (!stage.fullscreen || hinge.width > hinge.height));
  const rail = <div className="shell-rail timer-solver-rail" data-no-timer>{solver}</div>;
  const wide = useTimerWideLayout();
  const [solverTriggerSlot, setSolverTriggerSlot] = useState<HTMLSpanElement | null>(null);
  const [previewHost, setPreviewHost] = useState<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { surfaceRef, onContextMenu, onMouseDown, onMouseUp, onPointerDown, onPointerUp, onPointerCancel, ...canvas } = timing;
  return <SolverTriggerContext.Provider value={solverTriggerSlot}>
    {separateSolver && rail}
    <TimerTopbar brand={topbar.brand} availableTopBar={topbar.availableTopBar}
      actions={topbar.liveStatus && <span role="status" className="timer-live-watch-status">{topbar.liveStatus}</span>}
      className={`timer-solo-topbar${stage.fullscreen ? ' timer-solo-topbar--fullscreen' : ''}${topbar.className ? ` ${topbar.className}` : ''}`}
      controls={<>{solver && <span className="solver-trigger-slot" ref={setSolverTriggerSlot} />}{topbar.controls}</>} />
    <TimerStageLayout {...stage} inputRef={surfaceRef} previewHostRef={timing.cornerSlot ? setPreviewHost : undefined}
      inputHandlers={{ onContextMenu, onMouseDown, onMouseUp, onPointerDown, onPointerUp, onPointerCancel }}
      className={`timer-solo-main timer-workspace-main timer-solver-stage${stage.className ? ` ${stage.className}` : ''}`}>
      {title && <h1 className="sr-only">{title}</h1>}
      <TimingSurface {...canvas} surfaceRef={canvasRef} layout="solo" previewHost={previewHost} />
      {capturePreview && <div className="timer-solo-capture-preview" data-no-timer>{capturePreview}</div>}
      {!wide && narrowRecap && <div data-no-timer style={{ display: 'contents' }}>{narrowRecap}</div>}
      <div className="timer-solo-after-timing surface-chrome" data-no-timer hidden={stage.fullscreen}>
        {afterTiming}
        {hints}
      </div>
      {wide && !separateSolver && <TimerWorkspaceDivider side="left" label={resizeLabel} />}
      {!separateSolver && rail}
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
