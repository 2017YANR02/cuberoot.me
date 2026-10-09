import { timerSettingFieldContract, type TimerSoundSettings as Value, type TimerSettingCopy } from '@cuberoot/shared/timer';
import { TimerBooleanSettingRow, TimerSettingRow } from './TimerTimingSettingsSections';
import { TimerPillToggle } from './TimerPillToggle';

export const TIMER_SOUND_SETTING_FIELD_IDS = ['settings.sound.enabled', 'settings.sound.volume', 'settings.sound.voice-inspection'] as const;
const VOICES: readonly { value: Value['voiceInspection']; copy: TimerSettingCopy }[] = [
  { value: 'none', copy: { zh: '关闭（用提示音）', en: 'Off (beeps)' } },
  { value: 'en-male', copy: { zh: '英文 男声', en: 'English (male)' } },
  { value: 'en-female', copy: { zh: '英文 女声', en: 'English (female)' } },
  { value: 'zh-male', copy: { zh: '中文 男声', en: 'Chinese (male)' } },
  { value: 'zh-female', copy: { zh: '中文 女声', en: 'Chinese (female)' } },
];

export function TimerSoundSettings({ value, onChange, localize: tr, voiceAvailable, onWarmup, onPreview }: {
  value: Value; onChange(patch: Partial<Value>): void; localize(copy: TimerSettingCopy): string;
  voiceAvailable: boolean; onWarmup(): void; onPreview(): void;
}) {
  const [enabled, volume, voice] = TIMER_SOUND_SETTING_FIELD_IDS.map(timerSettingFieldContract);
  return <>
    <TimerBooleanSettingRow field={enabled} label={tr(enabled.copy)} value={value.soundsEnabled}
      onChange={soundsEnabled => { if (soundsEnabled) onWarmup(); onChange({ soundsEnabled }); }}
      renderBooleanControl={({ label, ...props }) => <TimerPillToggle ariaLabel={label} {...props} />} />
    <TimerSettingRow field={volume} label={tr(volume.copy)}>
      <input type="range" min={0} max={1} step={0.05} className="settings-row-control-input"
        aria-label={tr(volume.copy)} value={value.volume} disabled={!value.soundsEnabled}
        onChange={e => onChange({ volume: Number(e.target.value) })} />
      <button type="button" className="hint-btn" style={{ minWidth: 44, minHeight: 44 }} disabled={!value.soundsEnabled}
        aria-label={tr({ zh: '试听', en: 'Test' })} onClick={() => { onWarmup(); onPreview(); }}>♪</button>
    </TimerSettingRow>
    <TimerSettingRow field={voice} label={tr(voice.copy)}>
      <select className="settings-row-control-select" aria-label={tr(voice.copy)} value={value.voiceInspection}
        disabled={!value.soundsEnabled || !voiceAvailable}
        onChange={e => { onWarmup(); onChange({ voiceInspection: e.target.value as Value['voiceInspection'] }); }}>
        {VOICES.map(option => <option key={option.value} value={option.value}>{tr(option.copy)}</option>)}
      </select>
      {!voiceAvailable && <span className="hint">{tr({ zh: '当前设备不支持语音', en: 'Voice unavailable on this device' })}</span>}
    </TimerSettingRow>
  </>;
}
