import { timerSettingFieldContract, type TimerPreScrambleSettings as Value, type TimerSettingCopy } from '@cuberoot/shared/timer';
import CubeOrientationSelect from './CubeOrientationSelect';
import { TimerSettingRow } from './TimerTimingSettingsSections';

export const TIMER_PRE_SCRAMBLE_SETTING_FIELD_IDS = [
  'settings.scramble.pre-orientation', 'settings.scramble.training-pre-orientation',
] as const;

export function TimerPreScrambleSettings({ value, onChange, localize }: {
  value: Value; onChange(patch: Partial<Value>): void; localize(copy: TimerSettingCopy): string;
}) {
  return <>{(['preScr', 'preScrT'] as const).map((key, index) => {
    const field = timerSettingFieldContract(TIMER_PRE_SCRAMBLE_SETTING_FIELD_IDS[index]);
    return <TimerSettingRow key={key} field={field} label={localize(field.copy)}>
      <CubeOrientationSelect className="settings-row-control-select" value={value[key]} localize={localize}
        ariaLabel={localize(field.copy)} onChange={next => onChange({ [key]: next })} />
    </TimerSettingRow>;
  })}</>;
}
