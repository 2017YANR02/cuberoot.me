import type { ReactNode } from 'react';
import { History, Settings } from 'lucide-react';
import { TimerTopbar } from './TimerChrome';

export interface TimerBattleToolbarProps {
  language: 'en' | 'zh';
  controls?: ReactNode;
  brand?: ReactNode;
  eventControl?: ReactNode;
  disabled?: boolean;
  onHistory(): void;
  onSettings(): void;
  onNext?(): void;
  onStart?(): void;
  startDisabled?: boolean;
}
export function TimerBattleToolbar({ language, controls, brand, eventControl, disabled, onHistory, onSettings, onNext, onStart, startDisabled }: TimerBattleToolbarProps) {
  const copy = { en: { history: 'Local battle history', settings: 'Settings', next: 'Next round', start: 'Start together' }, zh: { history: '本地对战历史', settings: '设置', next: '下一轮', start: '同时开始' } }[language];
  return <TimerTopbar className="timer-battle-toolbar" controls={controls} brand={brand} actions={<div className="timer-room-actions">
    {onStart && <button type="button" disabled={disabled || startDisabled} onClick={onStart}>{copy.start}</button>}
    {onNext && <button type="button" disabled={disabled} onClick={onNext}>{copy.next}</button>}
    {eventControl}
    <button type="button" disabled={disabled} onClick={onHistory} aria-label={copy.history} title={copy.history}><History size={16} /></button>
    <button type="button" disabled={disabled} onClick={onSettings} aria-label={copy.settings} title={copy.settings}><Settings size={16} /></button>
  </div>} />;
}
