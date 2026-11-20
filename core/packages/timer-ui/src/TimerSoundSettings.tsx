import BoolToggle from './BoolToggle';
import { timerSettingFieldContract, type TimerSoundSettings as Value, type TimerSettingCopy } from '@cuberoot/shared/timer';
import { TIMER_INSPECTION_VOICE_COPY, TIMER_SOUND_SETTINGS_COPY } from '@cuberoot/shared/timer/sound-feedback';
import { TimerBooleanSettingRow, TimerSettingRow } from './TimerTimingSettingsSections';
import './compact-select.css';

export const TIMER_SOUND_SETTING_FIELD_IDS = ['settings.sound.enabled', 'settings.sound.volume', 'settings.sound.voice-inspection'] as const;

export function TimerSoundSettings({ value, onChange, localize: tr, voiceAvailable, onWarmup, onPreview }: {
  value: Value; onChange(patch: Partial<Value>): void; localize(copy: TimerSettingCopy): string;
  voiceAvailable: boolean; onWarmup(): void; onPreview(): void;
}) {
  const [enabled, volume, voice] = TIMER_SOUND_SETTING_FIELD_IDS.map(timerSettingFieldContract);
  return <>
    <TimerBooleanSettingRow field={enabled} label={tr(enabled.copy)} value={value.soundsEnabled}
      onChange={soundsEnabled => { if (soundsEnabled) onWarmup(); onChange({ soundsEnabled }); }}
      renderBooleanControl={({ label, value, onChange, disabled }) => (
        <BoolToggle label="" ariaLabel={label} value={value} onChange={onChange} disabled={disabled} />
      )} />
    <TimerSettingRow field={volume} label={tr(volume.copy)}>
      <input type="range" min={0} max={1} step={0.05} className="settings-row-control-input"
        aria-label={tr(volume.copy)} value={value.volume}
        onChange={e => onChange({ volume: Number(e.target.value) })} />
      <span className="settings-volume-value">{Math.round(value.volume * 100)}%</span>
      <button type="button" className="hint-btn" style={{ minWidth: 44, minHeight: 44 }} disabled={!value.soundsEnabled}
        aria-label={tr(TIMER_SOUND_SETTINGS_COPY.test)} onClick={() => { onWarmup(); onPreview(); }}>♪</button>
    </TimerSettingRow>
    <TimerSettingRow field={voice} label={tr(voice.copy)}>
      <select className="settings-row-control-select" aria-label={tr(voice.copy)} value={value.voiceInspection}
        disabled={!value.soundsEnabled || !voiceAvailable}
        onChange={e => { onWarmup(); onChange({ voiceInspection: e.target.value as Value['voiceInspection'] }); }}>
        {Object.entries(TIMER_INSPECTION_VOICE_COPY).map(([value, copy]) => <option key={value} value={value}>{tr(copy)}</option>)}
      </select>
      {!voiceAvailable && <span className="hint">{tr(TIMER_SOUND_SETTINGS_COPY.voiceUnavailable)}</span>}
    </TimerSettingRow>
  </>;
}
