import { useSyncExternalStore, type HTMLAttributes, type ReactNode } from 'react';
import './timer-workspace.css';
import { ResizeDivider } from '@app-foundation/navigation-ui/resize-divider';
import '@app-foundation/navigation-ui/resize-divider.css';

export const TIMER_WIDE_QUERY = '(min-width: 1024px)';
function subscribe(notify: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(TIMER_WIDE_QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}
/** Same breakpoint for Web docks and installed hosts; stable narrow SSR. */
export function useTimerWideLayout() {
  return useSyncExternalStore(subscribe, () => typeof window.matchMedia === 'function' && window.matchMedia(TIMER_WIDE_QUERY).matches, () => false);
}

export function TimerWorkspace({ active = true, panelOpen = false, recap, resizeLabel = 'Resize panel', children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & {
  active?: boolean; panelOpen?: boolean; recap?: ReactNode; resizeLabel?: string;
}) {
  const wide = useTimerWideLayout();
  const recapOpen = active && wide && !panelOpen && Boolean(recap);
  return <div {...props} className={`${className}${active ? ' timer-workspace timer-no-selection' : ''}`}
    data-panel-open={active && (panelOpen || recapOpen) ? '' : undefined} data-recap-open={recapOpen ? '' : undefined}>
    {children}
    {active && wide && (panelOpen || recapOpen) && <TimerWorkspaceDivider side="right" label={resizeLabel} />}
    {recapOpen && (
      <aside className="timer-workspace-panel shell-panel--rail shell-recap-rail" data-site-surface="panel" data-no-timer>
        {recap}
      </aside>
    )}
  </div>;
}

/** One pointer/keyboard resizing contract for both desktop dock boundaries. */
export function TimerWorkspaceDivider({ side, label }: { side: 'left' | 'right'; label: string }) {
  const panel = (element: HTMLElement) => element.closest('.timer-workspace')?.querySelector<HTMLElement>(side === 'left' ? '.timer-solver-rail' : '.timer-workspace-panel');
  const resize = (element: HTMLElement, requested: number) => {
    const workspace = element.closest<HTMLElement>('.timer-workspace');
    if (!workspace) return;
    const other = workspace.querySelector<HTMLElement>(side === 'left' ? '.timer-workspace-panel' : '.timer-solver-rail');
    const otherWidth = other?.getBoundingClientRect().width ?? 0;
    const maximum = Math.max(160, workspace.clientWidth - otherWidth - 320);
    const next = Math.round(Math.max(Math.min(240, maximum), Math.min(requested, maximum)));
    workspace.style.setProperty(side === 'left' ? '--timer-left-dock-width' : '--timer-right-dock-width', `${next}px`);
    return next;
  };
  return <ResizeDivider label={label} direction={side === 'left' ? 1 : -1}
    getSize={element => panel(element)?.getBoundingClientRect().width ?? 0} onResize={resize}
    data-no-timer className={`timer-workspace-divider timer-workspace-divider--${side}`} />;
}
