import { X } from 'lucide-react';
import { TIMER_RESULTS_TABS_COPY } from '@cuberoot/shared/timer/history';
import './timer-results-tabs.css';

/** The compact results rail has two views; statistics includes its chart. */
export function TimerResultsTabs({ value, onChange, onClose, language }: {
  value: 'times' | 'stats';
  onChange(value: 'times' | 'stats'): void;
  onClose?(): void;
  language: 'en' | 'zh';
}) {
  return <div className="shell-panel-tabs">
    {(['times', 'stats'] as const).map(tab => <button key={tab} type="button"
      className={`shell-panel-tab${value === tab ? ' active' : ''}`} aria-pressed={value === tab}
      onClick={() => onChange(tab)}>
      {TIMER_RESULTS_TABS_COPY[tab][language]}
    </button>)}
    {onClose && <button type="button" className="shell-panel-close" onClick={onClose}
      aria-label={TIMER_RESULTS_TABS_COPY.close[language]}><X size={16} /></button>}
  </div>;
}
