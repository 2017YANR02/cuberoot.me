import { useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import './timer-workspace.css';
import { ResizeDivider } from '@app-foundation/navigation-ui/resize-divider';
import '@app-foundation/navigation-ui/resize-divider.css';
import { useHostViewportLayout } from './host-viewport';
import { DEFAULT_SOLO_LAYOUT, type SoloLayout } from '@cuberoot/shared/timer';
import { observeSoloSpacing } from './solo-spacing-fit';

// Unfolded landscape can use compact docks on either side of the timer.
// Keep this in sync with timer-solver-panel.css and timing-surface.css.
export const TIMER_WIDE_QUERY = '(min-width: 1024px), (min-width: 560px) and (orientation: landscape), (pointer: coarse) and (orientation: landscape)';
function subscribe(notify: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(TIMER_WIDE_QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}
/** Every native timer slot uses safe content geometry; Web also supports unfolded landscape. */
export function useTimerWideLayout({ useHostContent = true }: { useHostContent?: boolean } = {}) {
  const host = useHostViewportLayout();
  const desktop = useSyncExternalStore(subscribe, () => typeof window.matchMedia === 'function' && window.matchMedia(TIMER_WIDE_QUERY).matches, () => false);
  if (!useHostContent || !host) return desktop;
  return Boolean(host.hinge) || host.content.width >= 1024 ||
    (host.bounds.width > host.bounds.height && host.content.width >= 400);
}

export function TimerWorkspace({ active = true, panelOpen = false, recap, soloLayout, resizeLabel = 'Resize panel', children, className = '', style, ...props }: HTMLAttributes<HTMLDivElement> & {
  active?: boolean; panelOpen?: boolean; recap?: ReactNode; resizeLabel?: string;
  /** Opt into the same bounded Solo canvas on Web and installed hosts. */
  soloLayout?: SoloLayout;
}) {
  const expandedSpacing = soloLayout && (['scrambleGap', 'sourceGap', 'timerGap', 'cubeGap'] as const)
    .some(key => soloLayout[key] > DEFAULT_SOLO_LAYOUT[key]);
  const wide = useTimerWideLayout({ useHostContent: true });
  const host = useHostViewportLayout();
  const hostLandscape = Boolean(host && host.bounds.width > host.bounds.height);
  const hinge = active && soloLayout ? host?.hinge : undefined;
  const stacked = host && hinge && hinge.width > hinge.height;
  const recapOpen = active && wide && !panelOpen && Boolean(recap);
  const workspaceRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const stage = workspaceRef.current?.querySelector<HTMLElement>('.timer-solo-main');
    // Default gaps also consume scarce space when a long scramble arrives.
    // Fit only rendered whitespace; keep the saved layout and font sizes.
    if (!active || !soloLayout || !stage || typeof ResizeObserver === 'undefined') return;
    return observeSoloSpacing(stage, soloLayout);
  }, [active, soloLayout]);
  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || !active || !wide || hinge || typeof ResizeObserver === 'undefined') return;
    // Watch the rail as well as the host: expanding a previously collapsed dock
    // must share the same width budget as resizing the native window.
    const constrain = () => constrainDockWidths(workspace);
    const observer = new ResizeObserver(constrain);
    observer.observe(workspace);
    for (const panel of workspace.querySelectorAll('.timer-solver-rail, .timer-workspace-panel')) observer.observe(panel);
    constrain();
    return () => observer.disconnect();
  }, [active, wide, panelOpen, recapOpen, hinge, hostLandscape]);
  return <div {...props} ref={workspaceRef} className={`${className}${active ? ' timer-workspace timer-no-selection' : ''}`}
    style={{ ...style, ...(hinge && host && {
      '--timer-first-pane': `${stacked ? hinge.y - host.content.y : hinge.x - host.content.x}px`,
      '--timer-hinge-gap': `${stacked ? hinge.height : hinge.width}px`,
      gridTemplateColumns: 'var(--timer-fold-columns)',
      gridTemplateRows: 'var(--timer-fold-rows)',
      gridTemplateAreas: 'var(--timer-fold-areas)',
    }), ...(soloLayout && {
      '--solo-scramble-gap': `${soloLayout.scrambleGap}px`,
      '--solo-source-gap': `${soloLayout.sourceGap}px`,
      '--solo-timer-gap': `${soloLayout.timerGap}px`,
      '--solo-cube-gap': `${soloLayout.cubeGap}px`,
      '--solo-scramble-offset-y': `${soloLayout.scrambleOffsetY}px`,
      '--solo-source-offset-y': `${soloLayout.sourceOffsetY}px`,
      '--solo-timer-offset-y': `${soloLayout.timerOffsetY}px`,
      '--solo-cube-offset-y': `${soloLayout.cubeOffsetY}px`,
      '--solo-source-scale': soloLayout.sourceScale,
      '--solo-cube-scale': soloLayout.cubeScale,
    }) } as CSSProperties}
    data-fold-axis={hinge ? (stacked ? 'horizontal' : 'vertical') : undefined}
    data-fit-viewport={soloLayout ? '' : undefined} data-spacing-flow={expandedSpacing ? '' : undefined}
    data-wide-layout={wide ? '' : undefined}
    data-panel-open={active && (panelOpen || recapOpen) ? '' : undefined} data-recap-open={recapOpen ? '' : undefined}>
    {children}
    {active && wide && !hinge && (panelOpen || recapOpen) && <TimerWorkspaceDivider side="right" label={resizeLabel} />}
    {recapOpen && (
      <aside className="timer-workspace-panel shell-panel--rail shell-recap-rail" data-site-surface="panel" data-no-timer>
        {recap}
      </aside>
    )}
  </div>;
}

const MIN_TIMER_WIDTH = 320;
function openDock(workspace: HTMLElement, side: 'left' | 'right') {
  if (side === 'right') return workspace.hasAttribute('data-panel-open')
    ? workspace.querySelector<HTMLElement>('.timer-workspace-panel') : null;
  const rail = workspace.querySelector<HTMLElement>(
    ':scope > .timer-solver-rail[data-full-height-dock], .timer-solver-stage:not([data-stage-fullscreen="true"]) > .timer-solver-rail',
  );
  return rail?.querySelector('.solver-panel[data-layout="rail"][data-open="true"]') ? rail : null;
}

/** Pixel preferences survive resizing, but cannot consume the timing canvas. */
function constrainDockWidths(workspace: HTMLElement) {
  const available = Math.max(0, workspace.clientWidth - Math.min(MIN_TIMER_WIDTH, workspace.clientWidth / 2));
  if (!workspace.clientWidth) return;
  const docks = (['left', 'right'] as const).map(side => ({ side, width: openDock(workspace, side)?.getBoundingClientRect().width ?? 0 }))
    .filter(dock => dock.width > 0);
  const total = docks.reduce((sum, dock) => sum + dock.width, 0);
  if (total <= available) return;
  const minimum = Math.min(240, available / docks.length);
  const bases = docks.map(dock => Math.min(dock.width, minimum));
  const baseTotal = bases.reduce((sum, width) => sum + width, 0);
  const flexible = total - baseTotal;
  for (const [index, dock] of docks.entries()) {
    const width = Math.floor(bases[index] + (flexible > 0 ? (dock.width - bases[index]) / flexible * (available - baseTotal) : 0));
    workspace.style.setProperty(`--timer-${dock.side}-dock-width`, `${width}px`);
  }
}

/** One pointer/keyboard resizing contract for both desktop dock boundaries. */
export function TimerWorkspaceDivider({ side, label }: { side: 'left' | 'right'; label: string }) {
  const panel = (element: HTMLElement) => element.closest('.timer-workspace')?.querySelector<HTMLElement>(side === 'left' ? '.timer-solver-rail' : '.timer-workspace-panel');
  const resize = (element: HTMLElement, requested: number) => {
    const workspace = element.closest<HTMLElement>('.timer-workspace');
    if (!workspace) return;
    const other = openDock(workspace, side === 'left' ? 'right' : 'left');
    const otherWidth = other?.getBoundingClientRect().width ?? 0;
    const maximum = Math.max(0, workspace.clientWidth - otherWidth - Math.min(MIN_TIMER_WIDTH, workspace.clientWidth / 2));
    const next = Math.round(Math.max(Math.min(240, maximum), Math.min(requested, maximum)));
    workspace.style.setProperty(side === 'left' ? '--timer-left-dock-width' : '--timer-right-dock-width', `${next}px`);
    return next;
  };
  return <ResizeDivider label={label} direction={side === 'left' ? 1 : -1}
    getSize={element => panel(element)?.getBoundingClientRect().width ?? 0} onResize={resize}
    data-no-timer className={`timer-workspace-divider timer-workspace-divider--${side}`} />;
}
