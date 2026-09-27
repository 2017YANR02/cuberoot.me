import { useSyncExternalStore, type HTMLAttributes } from 'react';
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

export function TimerWorkspace({ active = true, panelOpen = false, recapOpen = false, className = '', ...props }: HTMLAttributes<HTMLDivElement> & {
  active?: boolean; panelOpen?: boolean; recapOpen?: boolean;
}) {
  return <div {...props} className={`${className}${active ? ' timer-workspace' : ''}`}
    data-panel-open={active && panelOpen ? '' : undefined} data-recap-open={active && recapOpen ? '' : undefined} />;
}
