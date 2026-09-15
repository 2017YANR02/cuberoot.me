import {
  normalizeTimerScramblePreviewSettings,
  timerScramblePreview3DDisabled,
  timerSettingFieldContract,
  type TimerScramblePreviewSettings,
  type TimerSettingCopy,
  type TimerSettingFieldId,
} from '@cuberoot/shared/timer';
import type { ReactNode } from 'react';

import {
  TimerBooleanSettingRow,
  type TimerBooleanControlProps,
} from './TimerTimingSettingsSections';

export interface TimerScramblePreviewSettingsProps {
  localize: (copy: TimerSettingCopy) => string;
  onChange: (patch: Partial<TimerScramblePreviewSettings>) => void;
  renderBooleanControl: (props: TimerBooleanControlProps) => ReactNode;
  value: TimerScramblePreviewSettings;
}

const SHOW_FIELD = timerSettingFieldContract('settings.appearance.scramble-image');
const THREE_D_FIELD = timerSettingFieldContract('settings.appearance.cube-3d');

export const TIMER_SCRAMBLE_PREVIEW_SETTING_FIELD_IDS: readonly TimerSettingFieldId[] = [
  SHOW_FIELD.id,
  THREE_D_FIELD.id,
];

/** Shared Web/installed-client controls for scramble preview visibility and 2D/3D mode. */
export function TimerScramblePreviewSettings({
  localize,
  onChange,
  renderBooleanControl,
  value,
}: TimerScramblePreviewSettingsProps) {
  const settings = normalizeTimerScramblePreviewSettings(value);
  return (
    <>
      <TimerBooleanSettingRow
        field={SHOW_FIELD}
        label={localize(SHOW_FIELD.copy)}
        onChange={(showCubePreview) => onChange({ showCubePreview })}
        renderBooleanControl={renderBooleanControl}
        value={settings.showCubePreview}
      />
      <TimerBooleanSettingRow
        disabled={timerScramblePreview3DDisabled(settings)}
        field={THREE_D_FIELD}
        label={localize(THREE_D_FIELD.copy)}
        onChange={(prefer3D) => onChange({ prefer3D })}
        renderBooleanControl={renderBooleanControl}
        value={settings.prefer3D}
      />
    </>
  );
}
