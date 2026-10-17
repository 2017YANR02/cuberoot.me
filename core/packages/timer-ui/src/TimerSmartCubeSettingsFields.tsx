import {
  TIMER_SETTING_FIELD_CONTRACTS,
  TIMER_SMART_CUBE_AUTO_READY_MODES,
  TIMER_SMART_CUBE_LIVE_VIEWS,
  normalizeTimerSmartCubeSettings,
  type TimerSettingCopy,
  type TimerSmartCubeSettings,
} from '@cuberoot/shared/timer';
import type { ReactNode } from 'react';
import { TimerBooleanSettingRow, TimerSettingRow, TimerSettingsSection, type TimerBooleanControlProps } from './TimerTimingSettingsSections';

export interface TimerSmartCubeSettingsFieldsProps {
  value: TimerSmartCubeSettings;
  localize: (copy: TimerSettingCopy) => string;
  onChange: (patch: Partial<TimerSmartCubeSettings>) => void;
  renderBooleanControl: (props: TimerBooleanControlProps) => ReactNode;
}

const FIELDS = TIMER_SETTING_FIELD_CONTRACTS.filter((field) => (
  field.category === 'smart-cube' && field.id !== 'settings.smart-cube.fake-cube' && field.storagePath !== 'preScrT'
));
export const TIMER_SMART_CUBE_SETTING_FIELD_IDS = FIELDS.map(field => field.id);
const field = (path: keyof TimerSmartCubeSettings) => FIELDS.find((candidate) => candidate.storagePath === path)!;

const AUTO_READY_COPY = {
  scrambled: { zh: '打乱正确即预备', en: 'When scrambled' },
  off: { zh: '关闭', en: 'Off' },
  still: { zh: '静止 2 秒', en: 'Still 2s' },
  'double-flick': { zh: "双反扭 (U U')²", en: "Double-flick (U U')²" },
} satisfies Record<TimerSmartCubeSettings['bluetoothAutoReady'], TimerSettingCopy>;
const LIVE_VIEW_COPY = {
  '3d': { zh: 'three.js', en: 'three.js' },
  twizzle: { zh: 'cubing.js', en: 'cubing.js' },
  q2look: { zh: 'q2Look', en: 'q2Look' },
  net: { zh: '展开图', en: 'Net' },
  '2d': { zh: '立体图', en: 'Isometric' },
} satisfies Record<TimerSmartCubeSettings['liveCubeView'], TimerSettingCopy>;

/** The shared smart-cube rows; hosts only persist patches. */
export function TimerSmartCubeSettingsFields({ value, localize, onChange, renderBooleanControl }: TimerSmartCubeSettingsFieldsProps) {
  const settings = normalizeTimerSmartCubeSettings(value);
  const gyro = field('gyroEnabled');
  const calibration = field('autoCalibrateGyro');
  const autoReady = field('bluetoothAutoReady');
  const liveView = field('liveCubeView');
  const orientation = field('recordGyro');
  const recap = field('autoRecap');
  const solution = field('autoOpenSolution');
  return (
    <>
      <TimerSettingsSection title={localize({ zh: '预备与起表', en: 'Ready and start' })}>
      <TimerSettingRow field={autoReady} label={localize(autoReady.copy)}>
        <select className="settings-row-control-select" aria-label={localize(autoReady.copy)} value={settings.bluetoothAutoReady}
          onChange={(event) => onChange({ bluetoothAutoReady: normalizeTimerSmartCubeSettings({ bluetoothAutoReady: event.target.value }).bluetoothAutoReady })}>
          {TIMER_SMART_CUBE_AUTO_READY_MODES.map((mode) => <option key={mode} value={mode}>{localize(AUTO_READY_COPY[mode])}</option>)}
        </select>
      </TimerSettingRow>
      </TimerSettingsSection>
      <TimerSettingsSection title={localize({ zh: '实况与姿态', en: 'Live view and orientation' })}>
      <TimerBooleanSettingRow field={gyro} label={localize(gyro.copy)} value={settings.gyroEnabled}
        onChange={(gyroEnabled) => onChange({ gyroEnabled })} renderBooleanControl={renderBooleanControl} />
      <TimerBooleanSettingRow field={calibration} label={localize(calibration.copy)} value={settings.autoCalibrateGyro}
        onChange={(autoCalibrateGyro) => onChange({ autoCalibrateGyro })} renderBooleanControl={renderBooleanControl}
        hint={localize({ zh: '完成倒数第二步后，按当前训练朝向握好魔方；同时校准实况和本次复盘基准。', en: 'Hold the cube in the training orientation as you finish the penultimate move. Calibrates both the live view and the next replay reference.' })} />
      <TimerSettingRow field={liveView} label={localize(liveView.copy)}>
        <select className="settings-row-control-select" aria-label={localize({ zh: '实况魔方渲染方式', en: 'Live cube rendering' })} value={settings.liveCubeView}
          onChange={(event) => onChange({ liveCubeView: normalizeTimerSmartCubeSettings({ liveCubeView: event.target.value }).liveCubeView })}>
          {TIMER_SMART_CUBE_LIVE_VIEWS.map((view) => <option key={view} value={view}>{localize(LIVE_VIEW_COPY[view])}</option>)}
        </select>
      </TimerSettingRow>
      <TimerBooleanSettingRow field={orientation} label={localize(orientation.copy)} value={settings.recordGyro}
        onChange={(recordGyro) => onChange({ recordGyro })} renderBooleanControl={renderBooleanControl} />
      </TimerSettingsSection>
      <TimerSettingsSection title={localize({ zh: '完成还原后', en: 'After each solve' })}>
      <TimerBooleanSettingRow field={recap} label={localize(recap.copy)} value={settings.autoRecap}
        onChange={(autoRecap) => onChange({ autoRecap })} renderBooleanControl={renderBooleanControl} />
      <TimerBooleanSettingRow field={solution} label={localize(solution.copy)} value={settings.autoOpenSolution}
        onChange={(autoOpenSolution) => onChange({ autoOpenSolution })} renderBooleanControl={renderBooleanControl}
        hint={localize({ zh: '仅桌面窗口自动展开，移动端请手动打开解法。', en: 'Auto-opens on desktop only; open solutions manually on mobile.' })} />
      </TimerSettingsSection>
    </>
  );
}
