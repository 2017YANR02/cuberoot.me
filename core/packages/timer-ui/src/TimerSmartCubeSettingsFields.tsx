import {
  TIMER_SETTING_FIELD_CONTRACTS,
  TIMER_SMART_CUBE_AUTO_READY_MODES,
  TIMER_SMART_CUBE_LIVE_VIEWS,
  normalizeTimerSmartCubeSettings,
  type TimerSettingCopy,
  type TimerSmartCubeSettings,
} from '@cuberoot/shared/timer';
import type { ReactNode } from 'react';
import { TimerBooleanSettingRow, TimerSettingRow, type TimerBooleanControlProps } from './TimerTimingSettingsSections';

export interface TimerSmartCubeSettingsFieldsProps {
  value: TimerSmartCubeSettings;
  localize: (copy: TimerSettingCopy) => string;
  onChange: (patch: Partial<TimerSmartCubeSettings>) => void;
  renderBooleanControl: (props: TimerBooleanControlProps) => ReactNode;
}

const FIELDS = TIMER_SETTING_FIELD_CONTRACTS.filter((field) => (
  field.category === 'smart-cube' && field.id !== 'settings.smart-cube.fake-cube'
));
export const TIMER_SMART_CUBE_SETTING_FIELD_IDS = FIELDS.map((field) => field.id);
const field = (path: keyof TimerSmartCubeSettings) => FIELDS.find((candidate) => candidate.storagePath === path)!;

const AUTO_READY_COPY = {
  scrambled: { zh: '打乱正确即预备', en: 'When scrambled' },
  off: { zh: '关闭', en: 'Off' },
  still: { zh: '静止 2 秒', en: 'Still 2s' },
  'double-flick': { zh: "双反扭 (U U')²", en: "Double-flick (U U')²" },
} satisfies Record<TimerSmartCubeSettings['bluetoothAutoReady'], TimerSettingCopy>;
const LIVE_VIEW_COPY = {
  '3d': { zh: '三维', en: '3D' },
  q2look: { zh: 'q2Look', en: 'q2Look' },
  net: { zh: '展开图', en: 'Net' },
  '2d': { zh: '立体图', en: 'Isometric' },
} satisfies Record<TimerSmartCubeSettings['liveCubeView'], TimerSettingCopy>;

/** The shared smart-cube rows; hosts only persist patches. */
export function TimerSmartCubeSettingsFields({ value, localize, onChange, renderBooleanControl }: TimerSmartCubeSettingsFieldsProps) {
  const settings = normalizeTimerSmartCubeSettings(value);
  const gyro = field('gyroEnabled');
  const autoReady = field('bluetoothAutoReady');
  const liveView = field('liveCubeView');
  const orientation = field('recordGyro');
  const recap = field('autoRecap');
  const solution = field('autoOpenSolution');
  return (
    <>
      <TimerBooleanSettingRow field={gyro} label={localize(gyro.copy)} value={settings.gyroEnabled}
        onChange={(gyroEnabled) => onChange({ gyroEnabled })} renderBooleanControl={renderBooleanControl} />
      <TimerSettingRow field={autoReady} label={localize(autoReady.copy)}>
        <select className="settings-row-control-select" aria-label={localize(autoReady.copy)} value={settings.bluetoothAutoReady}
          onChange={(event) => onChange({ bluetoothAutoReady: normalizeTimerSmartCubeSettings({ bluetoothAutoReady: event.target.value }).bluetoothAutoReady })}>
          {TIMER_SMART_CUBE_AUTO_READY_MODES.map((mode) => <option key={mode} value={mode}>{localize(AUTO_READY_COPY[mode])}</option>)}
        </select>
      </TimerSettingRow>
      <TimerSettingRow field={liveView} label={localize(liveView.copy)}>
        <select className="settings-row-control-select" aria-label={localize({ zh: '实况魔方渲染方式', en: 'Live cube rendering' })} value={settings.liveCubeView}
          onChange={(event) => onChange({ liveCubeView: normalizeTimerSmartCubeSettings({ liveCubeView: event.target.value }).liveCubeView })}>
          {TIMER_SMART_CUBE_LIVE_VIEWS.map((view) => <option key={view} value={view}>{localize(LIVE_VIEW_COPY[view])}</option>)}
        </select>
      </TimerSettingRow>
      <TimerBooleanSettingRow field={orientation} label={localize(orientation.copy)} value={settings.recordGyro}
        onChange={(recordGyro) => onChange({ recordGyro })} renderBooleanControl={renderBooleanControl} />
      <TimerBooleanSettingRow field={recap} label={localize(recap.copy)} value={settings.autoRecap}
        onChange={(autoRecap) => onChange({ autoRecap })} renderBooleanControl={renderBooleanControl} />
      <TimerBooleanSettingRow field={solution} label={localize(solution.copy)} value={settings.autoOpenSolution}
        onChange={(autoOpenSolution) => onChange({ autoOpenSolution })} renderBooleanControl={renderBooleanControl} />
    </>
  );
}
