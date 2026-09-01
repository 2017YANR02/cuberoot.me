import {
  TIMER_SCRAMBLE_CLICK_ACTIONS,
  normalizeTimerScrambleClickAction,
  timerSettingFieldContract,
  type TimerScrambleClickAction,
  type TimerSettingCopy,
} from '@cuberoot/shared/timer';
import { useId } from 'react';

export interface TimerScrambleClickActionSettingProps {
  localize: (copy: TimerSettingCopy) => string;
  onChange: (value: TimerScrambleClickAction) => void;
  value: TimerScrambleClickAction;
}

const FIELD = timerSettingFieldContract('settings.appearance.scramble-click-action');

const ACTION_COPY: Record<TimerScrambleClickAction, TimerSettingCopy> = {
  none: { en: 'Nothing', zh: '无操作' },
  next: { en: 'Next scramble', zh: '换下一个' },
  copy: { en: 'Copy to clipboard', zh: '复制到剪贴板' },
};

export function TimerScrambleClickActionSetting({
  localize,
  onChange,
  value,
}: TimerScrambleClickActionSettingProps) {
  const labelId = useId();

  return (
    <div className="settings-row" data-setting-id={FIELD.id}>
      <span className="settings-row-label" id={labelId}>{localize(FIELD.copy)}</span>
      <span aria-labelledby={labelId} className="settings-row-control" role="group">
        <select
          aria-labelledby={labelId}
          className="settings-row-control-select"
          onChange={(event) => onChange(normalizeTimerScrambleClickAction(event.target.value))}
          value={normalizeTimerScrambleClickAction(value)}
        >
          {TIMER_SCRAMBLE_CLICK_ACTIONS.map((action) => (
            <option key={action} value={action}>{localize(ACTION_COPY[action])}</option>
          ))}
        </select>
      </span>
    </div>
  );
}
