import {
  TIMER_SETTING_FIELD_CONTRACTS,
  TIMER_SMART_CUBE_AUTO_READY_MODES,
  TIMER_SMART_CUBE_AUTO_CALIBRATE_HINT,
  TIMER_SMART_CUBE_CORRECTION_HINT,
  TIMER_SMART_CUBE_LIVE_VIEWS,
  TIMER_SMART_CUBE_LIVE_VIEW_COPY,
  TIMER_SMART_CUBE_LIVE_VIEW_LABEL,
  TIMER_SMART_CUBE_SECTION_COPY,
  normalizeTimerSmartCubeSettings,
  normalizeSmartCubeCorrectionLimit,
  type TimerSettingCopy,
  type TimerSettingFieldContract,
  type TimerSmartCubeSettings,
} from '@cuberoot/shared/timer';
import { TIMER_SMART_CUBE_AUTO_READY_COPY } from '@cuberoot/shared/timer/auto-ready';
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
  const liveAnalysis = field('liveSolutionAnalysis');
  const recap = field('autoRecap');
  const solution = field('autoOpenSolution');
  return (
    <>
      <TimerSettingsSection title={localize(TIMER_SMART_CUBE_SECTION_COPY.ready)}>
      <TimerSettingRow field={autoReady} label={localize(autoReady.copy)}>
        <select className="settings-row-control-select" aria-label={localize(autoReady.copy)} value={settings.bluetoothAutoReady}
          onChange={(event) => onChange({ bluetoothAutoReady: normalizeTimerSmartCubeSettings({ bluetoothAutoReady: event.target.value }).bluetoothAutoReady })}>
          {TIMER_SMART_CUBE_AUTO_READY_MODES.map((mode) => <option key={mode} value={mode}>{localize(TIMER_SMART_CUBE_AUTO_READY_COPY[mode])}</option>)}
        </select>
      </TimerSettingRow>
      <TimerSettingRow field={correctionLimit} label={localize(correctionLimit.copy)}>
        <input className="settings-row-control-input" type="number" min={correctionLimit.value.min} max={correctionLimit.value.max} step={1}
          aria-label={localize(correctionLimit.copy)} value={limitInput} onChange={(event) => setLimitInput(event.target.value)}
          onBlur={commitLimit} onKeyDown={(event) => { if (event.key === 'Enter') commitLimit(); }} />
      </TimerSettingRow>
      <p className="hint">{localize(TIMER_SMART_CUBE_CORRECTION_HINT)}</p>
      </TimerSettingsSection>
      <TimerSettingsSection title={localize(TIMER_SMART_CUBE_SECTION_COPY.live)}>
      <TimerBooleanSettingRow field={gyro} label={localize(gyro.copy)} value={settings.gyroEnabled}
        onChange={(gyroEnabled) => onChange({ gyroEnabled })} renderBooleanControl={renderBooleanControl} />
      <TimerBooleanSettingRow field={calibration} label={localize(calibration.copy)} value={settings.autoCalibrateGyro}
        onChange={(autoCalibrateGyro) => onChange({ autoCalibrateGyro })} renderBooleanControl={renderBooleanControl}
        hint={localize(TIMER_SMART_CUBE_AUTO_CALIBRATE_HINT)} />
      <TimerSettingRow field={liveView} label={localize(liveView.copy)}>
        <select className="settings-row-control-select" aria-label={localize(TIMER_SMART_CUBE_LIVE_VIEW_LABEL)} value={settings.liveCubeView}
          onChange={(event) => onChange({ liveCubeView: normalizeTimerSmartCubeSettings({ liveCubeView: event.target.value }).liveCubeView })}>
          {TIMER_SMART_CUBE_LIVE_VIEWS.map((view) => <option key={view} value={view}>{localize(TIMER_SMART_CUBE_LIVE_VIEW_COPY[view])}</option>)}
        </select>
      </TimerSettingRow>
      {orientationControl}
      <TimerBooleanSettingRow field={liveAnalysis} label={localize(liveAnalysis.copy)} value={settings.liveSolutionAnalysis}
        onChange={(liveSolutionAnalysis) => onChange({ liveSolutionAnalysis })} renderBooleanControl={renderBooleanControl} />
      </TimerSettingsSection>
      <TimerSettingsSection title={localize(TIMER_SMART_CUBE_SECTION_COPY.solved)}>
      <TimerBooleanSettingRow field={recap} label={localize(recap.copy)} value={settings.autoRecap}
        onChange={(autoRecap) => onChange({ autoRecap })} renderBooleanControl={renderBooleanControl} />
      <TimerBooleanSettingRow field={solution} label={localize(solution.copy)} value={settings.autoOpenSolution}
        onChange={(autoOpenSolution) => onChange({ autoOpenSolution })} renderBooleanControl={renderBooleanControl}
        hint={localize({ zh: '仅桌面窗口自动展开，移动端请手动打开解法。', en: 'Auto-opens on desktop only; open solutions manually on mobile.' })} />
      </TimerSettingsSection>
    </>
  );
}
