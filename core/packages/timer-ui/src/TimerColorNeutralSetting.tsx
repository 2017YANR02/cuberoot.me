import { isCnEligible, timerSettingFieldContract, type CnMode, type EventId, type TimerSettingCopy } from '@cuberoot/shared/timer';
import { TIMER_COLOR_NEUTRAL_MODE_COPY } from '@cuberoot/shared/timer/settings-contract';
import { TimerSettingRow } from './TimerTimingSettingsSections';

export const TIMER_COLOR_NEUTRAL_SETTING_FIELD_IDS = ['settings.scramble.color-neutral'] as const;
const OPTIONS = Object.entries(TIMER_COLOR_NEUTRAL_MODE_COPY);

export function TimerColorNeutralSetting({ event, value, onChange, localize }: {
  event: EventId; value: CnMode; onChange(value: CnMode): void; localize(copy: TimerSettingCopy): string;
}) {
  if (!isCnEligible(event)) return null;
  const field = timerSettingFieldContract(TIMER_COLOR_NEUTRAL_SETTING_FIELD_IDS[0]);
  return <TimerSettingRow field={field} label={localize(field.copy)}>
    <select className="settings-row-control-select" aria-label={localize(field.copy)} value={value}
      onChange={e => onChange(e.target.value as CnMode)}>
      {OPTIONS.map(([mode, copy]) => <option key={mode} value={mode}>{localize(copy)}</option>)}
    </select>
  </TimerSettingRow>;
}
