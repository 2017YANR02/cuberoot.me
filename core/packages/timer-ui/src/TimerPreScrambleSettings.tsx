import { timerSettingFieldContract, type TimerPreScrambleSettings as Value, type TimerSettingCopy } from '@cuberoot/shared/timer';
import CubeOrientationSelect from './CubeOrientationSelect';
import { TimerSettingRow } from './TimerTimingSettingsSections';

export const TIMER_PRE_SCRAMBLE_SETTING_FIELD_IDS = [
  'settings.scramble.pre-orientation', 'settings.scramble.training-pre-orientation',
] as const;

export function TimerPreScrambleSettings({ value, onChange, localize, only }: {
  value: Value; onChange(patch: Partial<Value>): void; localize(copy: TimerSettingCopy): string;
  only?: 'normal' | 'training';
}) {
  return <>{(['preScr', 'preScrT'] as const).map((key, index) => {
    if ((only === 'normal' && key === 'preScrT') || (only === 'training' && key === 'preScr')) return null;
    const field = timerSettingFieldContract(TIMER_PRE_SCRAMBLE_SETTING_FIELD_IDS[index]);
    return <TimerSettingRow key={key} field={field} label={localize(field.copy)}>
      <CubeOrientationSelect className="settings-row-control-select" value={value[key]} localize={localize}
        title={key === 'preScrT' ? localize({ en: 'Hold the selected colors on top and in front. Smart-cube training scrambles and guidance use this orientation.', zh: '按所选顶色和前色拿方，智能魔方专项的打乱和推进使用此朝向。' }) : undefined}
        ariaLabel={localize(field.copy)} onChange={next => onChange({ [key]: next })} />
    </TimerSettingRow>;
  })}</>;
}
