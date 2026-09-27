import { useSyncExternalStore, type HTMLAttributes, type ReactNode } from 'react';
import './timer-workspace.css';

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

export function TimerWorkspace({ active = true, panelOpen = false, recap, children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & {
  active?: boolean; panelOpen?: boolean; recap?: ReactNode;
}) {
  const wide = useTimerWideLayout();
  const recapOpen = active && wide && !panelOpen && Boolean(recap);
  return <div {...props} className={`${className}${active ? ' timer-workspace' : ''}`}
    data-panel-open={active && (panelOpen || recapOpen) ? '' : undefined} data-recap-open={recapOpen ? '' : undefined}>
    {children}
    {recapOpen && (
      <aside className="timer-workspace-panel shell-panel--rail shell-recap-rail" data-site-surface="panel" data-no-timer>
        {recap}
      </aside>
    )}
  </div>;
}
