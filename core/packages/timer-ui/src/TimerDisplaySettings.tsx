import type { ReactNode } from 'react';
import { timerSettingFieldContract, type TimerDisplaySettings as Value, type TimerSettingCopy } from '@cuberoot/shared/timer';
import { TimerBooleanSettingRow, type TimerBooleanControlProps } from './TimerTimingSettingsSections';

export const TIMER_DISPLAY_SETTING_FIELD_IDS = [
  'settings.appearance.compact-scramble', 'settings.appearance.hide-all-while-running',
] as const;

/** Hosts may retain preview controls between the two display preferences. */
export function TimerDisplaySettings({ value, onChange, localize, renderBooleanControl, children }: {
  value: Value;
  onChange(patch: Partial<Value>): void;
  localize(copy: TimerSettingCopy): string;
  renderBooleanControl(props: TimerBooleanControlProps): ReactNode;
  children?: ReactNode;
}) {
  const compact = timerSettingFieldContract(TIMER_DISPLAY_SETTING_FIELD_IDS[0]);
  const hidden = timerSettingFieldContract(TIMER_DISPLAY_SETTING_FIELD_IDS[1]);
  return <>
    <TimerBooleanSettingRow field={compact} label={localize(compact.copy)} value={value.compactScramble}
      onChange={compactScramble => onChange({ compactScramble })} renderBooleanControl={renderBooleanControl} />
    {children}
    <TimerBooleanSettingRow field={hidden} label={localize(hidden.copy)} value={value.hideAllUiWhileRunning}
      onChange={hideAllUiWhileRunning => onChange({ hideAllUiWhileRunning })} renderBooleanControl={renderBooleanControl} />
  </>;
}
