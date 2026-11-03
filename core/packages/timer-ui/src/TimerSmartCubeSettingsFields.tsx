import {
  TIMER_SETTING_FIELD_CONTRACTS,
  TIMER_SMART_CUBE_AUTO_READY_MODES,
  TIMER_SMART_CUBE_LIVE_VIEWS,
  normalizeTimerSmartCubeSettings,
  normalizeSmartCubeCorrectionLimit,
  type TimerSettingCopy,
  type TimerSettingFieldContract,
  type TimerSmartCubeSettings,
} from '@cuberoot/shared/timer';
import { useEffect, useState, type ReactNode } from 'react';
import { TimerBooleanSettingRow, TimerSettingRow, TimerSettingsSection, type TimerBooleanControlProps } from './TimerTimingSettingsSections';

export interface TimerSmartCubeSettingsFieldsProps {
  value: TimerSmartCubeSettings;
  localize: (copy: TimerSettingCopy) => string;
  onChange: (patch: Partial<TimerSmartCubeSettings>) => void;
  renderBooleanControl: (props: TimerBooleanControlProps) => ReactNode;
  orientationControl?: ReactNode;
}

const FIELDS = TIMER_SETTING_FIELD_CONTRACTS.filter((field) => (
  field.category === 'smart-cube' && field.id !== 'settings.smart-cube.fake-cube' && field.storagePath !== 'preScrT'
));
export const TIMER_SMART_CUBE_SETTING_FIELD_IDS = FIELDS.map(field => field.id);
const field = (path: keyof TimerSmartCubeSettings): TimerSettingFieldContract => FIELDS.find((candidate) => candidate.storagePath === path)!;

const AUTO_READY_COPY = {
  scrambled: { zh: '打乱正确', en: 'When scrambled' },
  still: { zh: '无操作 2 秒', en: 'Idle for 2 seconds' },
  'double-flick': { zh: "来回转动（U U'）", en: "Turn and return (U U')" },
} satisfies Record<TimerSmartCubeSettings['bluetoothAutoReady'], TimerSettingCopy>;
const LIVE_VIEW_COPY = {
  '3d': { zh: 'three.js', en: 'three.js' },
  twizzle: { zh: 'cubing.js', en: 'cubing.js' },
  q2look: { zh: 'q2Look', en: 'q2Look' },
  net: { zh: '展开图', en: 'Net' },
  '2d': { zh: '立体图', en: 'Isometric' },
} satisfies Record<TimerSmartCubeSettings['liveCubeView'], TimerSettingCopy>;

/** The shared smart-cube rows; hosts only persist patches. */
export function TimerSmartCubeSettingsFields({ value, localize, onChange, renderBooleanControl, orientationControl }: TimerSmartCubeSettingsFieldsProps) {
  const settings = normalizeTimerSmartCubeSettings(value);
  const gyro = field('gyroEnabled');
  const calibration = field('autoCalibrateGyro');
  const autoReady = field('bluetoothAutoReady');
  const correctionLimit = field('smartCubeCorrectionLimit');
  const [limitInput, setLimitInput] = useState(String(settings.smartCubeCorrectionLimit));
  useEffect(() => setLimitInput(String(settings.smartCubeCorrectionLimit)), [settings.smartCubeCorrectionLimit]);
  const commitLimit = () => {
    const limit = normalizeSmartCubeCorrectionLimit(limitInput.trim() ? Number(limitInput) : undefined);
    setLimitInput(String(limit));
    if (limit !== settings.smartCubeCorrectionLimit) onChange({ smartCubeCorrectionLimit: limit });
  };
  const liveView = field('liveCubeView');
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
      <TimerSettingRow field={correctionLimit} label={localize(correctionLimit.copy)}>
        <input className="settings-row-control-input" type="number" min={correctionLimit.value.min} max={correctionLimit.value.max} step={1}
          aria-label={localize(correctionLimit.copy)} value={limitInput} onChange={(event) => setLimitInput(event.target.value)}
          onBlur={commitLimit} onKeyDown={(event) => { if (event.key === 'Enter') commitLimit(); }} />
      </TimerSettingRow>
      <p className="hint">{localize({ zh: '合并后的逆序纠错超过此步数时重新规划；0 为立即重新规划。', en: 'Replan when the merged undo sequence exceeds this limit; 0 replans immediately.' })}</p>
      </TimerSettingsSection>
      <TimerSettingsSection title={localize({ zh: '实况与姿态', en: 'Live view and orientation' })}>
      <TimerBooleanSettingRow field={gyro} label={localize(gyro.copy)} value={settings.gyroEnabled}
        onChange={(gyroEnabled) => onChange({ gyroEnabled })} renderBooleanControl={renderBooleanControl} />
      <TimerBooleanSettingRow field={calibration} label={localize(calibration.copy)} value={settings.autoCalibrateGyro}
        onChange={(autoCalibrateGyro) => onChange({ autoCalibrateGyro })} renderBooleanControl={renderBooleanControl}
        hint={localize({ zh: '在打乱完成倒数第二步时进行朝向重置', en: 'Reset the orientation after the penultimate scramble move.' })} />
      <TimerSettingRow field={liveView} label={localize(liveView.copy)}>
        <select className="settings-row-control-select" aria-label={localize({ zh: '实况魔方渲染方式', en: 'Live cube rendering' })} value={settings.liveCubeView}
          onChange={(event) => onChange({ liveCubeView: normalizeTimerSmartCubeSettings({ liveCubeView: event.target.value }).liveCubeView })}>
          {TIMER_SMART_CUBE_LIVE_VIEWS.map((view) => <option key={view} value={view}>{localize(LIVE_VIEW_COPY[view])}</option>)}
        </select>
      </TimerSettingRow>
      {orientationControl}
      </TimerSettingsSection>
      <TimerSettingsSection title={localize({ zh: '结束后', en: 'After solving' })}>
      <TimerBooleanSettingRow field={recap} label={localize(recap.copy)} value={settings.autoRecap}
        onChange={(autoRecap) => onChange({ autoRecap })} renderBooleanControl={renderBooleanControl} />
      <TimerBooleanSettingRow field={solution} label={localize(solution.copy)} value={settings.autoOpenSolution}
        onChange={(autoOpenSolution) => onChange({ autoOpenSolution })} renderBooleanControl={renderBooleanControl}
        hint={localize({ zh: '仅桌面窗口自动展开，移动端请手动打开解法。', en: 'Auto-opens on desktop only; open solutions manually on mobile.' })} />
      </TimerSettingsSection>
    </>
  );
}
