import { isCnEligible, timerSettingFieldContract, type CnMode, type EventId, type TimerSettingCopy } from '@cuberoot/shared/timer';
import { TimerSettingRow } from './TimerTimingSettingsSections';

export const TIMER_COLOR_NEUTRAL_SETTING_FIELD_IDS = ['settings.scramble.color-neutral'] as const;
const OPTIONS: readonly { value: CnMode; copy: TimerSettingCopy }[] = [
  { value: 'none', copy: { zh: '禁用', en: 'Disabled' } },
  { value: 'single', copy: { zh: '单色', en: 'Single color' } },
  { value: 'dual', copy: { zh: '双色', en: 'Dual color' } },
  { value: 'six', copy: { zh: '六色', en: 'Six colors' } },
];

export function TimerColorNeutralSetting({ event, value, onChange, localize }: {
  event: EventId; value: CnMode; onChange(value: CnMode): void; localize(copy: TimerSettingCopy): string;
}) {
  if (!isCnEligible(event)) return null;
  const field = timerSettingFieldContract(TIMER_COLOR_NEUTRAL_SETTING_FIELD_IDS[0]);
  return <TimerSettingRow field={field} label={localize(field.copy)}>
    <select className="settings-row-control-select" aria-label={localize(field.copy)} value={value}
      onChange={e => onChange(e.target.value as CnMode)}>
      {OPTIONS.map(option => <option key={option.value} value={option.value}>{localize(option.copy)}</option>)}
    </select>
  </TimerSettingRow>;
}
