import BoolToggle from './BoolToggle';
import { useEffect, useRef, useState } from 'react';
import { BPM_MIN, BPM_MAX, bpmToTps, parseInspectionBeepInput, timerSettingFieldContract, type TimerMetronomeSettings as Value, type TimerSettingCopy } from '@cuberoot/shared/timer';
import { TimerBooleanSettingRow, TimerSettingRow, TimerSettingsSection } from './TimerTimingSettingsSections';
import './compact-select.css';
import { TimerDifficultyHelp } from './TimerDifficultyHelp';
import './random-difficulty-config.css';

export const TIMER_METRONOME_SETTING_FIELD_IDS = ['settings.sound.metronome-enabled', 'settings.sound.metronome-tempo', 'settings.sound.inspection-beeps'] as const;

export function TimerMetronomeSettings({ value, bpm, onChange, onBpmChange, onTap, onWarmup, onPreviewBeep, localize: tr }: {
  value: Pick<Value, 'metronomeOn' | 'inspectionBeepAt'>; bpm: number;
  onChange(patch: Partial<Pick<Value, 'metronomeOn' | 'inspectionBeepAt'>>): void;
  onBpmChange(bpm: number): void; onTap(): number | null; onWarmup(): void; onPreviewBeep(): void;
  localize(copy: TimerSettingCopy): string;
}) {
  const [enabled, tempo, beeps] = TIMER_METRONOME_SETTING_FIELD_IDS.map(timerSettingFieldContract);
  const savedInput = value.inspectionBeepAt.join(',');
  const [input, setInput] = useState(savedInput);
  const [hint, setHint] = useState<number | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => setInput(savedInput), [savedInput]);
  useEffect(() => () => clearTimeout(hintTimer.current), []);
  const commit = () => { const inspectionBeepAt = parseInspectionBeepInput(input); setInput(inspectionBeepAt.join(',')); onChange({ inspectionBeepAt }); };
  return <>
    <TimerSettingsSection title={tr({ zh: '节拍器', en: 'Metronome' })}>
    <p className="settings-section-note">{tr({ zh: '仅在观察和计时期间播放；独立于提示音开关。', en: 'Plays during inspection and timing, independently of the sound-effects switch.' })}</p>
    <TimerBooleanSettingRow field={enabled} label={tr(enabled.copy)} value={value.metronomeOn}
      onChange={metronomeOn => { if (metronomeOn) onWarmup(); onChange({ metronomeOn }); }}
      renderBooleanControl={({ label, value, onChange, disabled }) => (
        <BoolToggle label="" ariaLabel={label} value={value} onChange={onChange} disabled={disabled} />
      )} />
    <TimerSettingRow field={tempo} label={tr(tempo.copy)}>
      <span className="settings-metronome-tempo">
      <input type="range" min={BPM_MIN} max={BPM_MAX} step={1} className="settings-row-control-input"
        value={bpm} aria-label={tr(tempo.copy)} disabled={!value.metronomeOn} onChange={e => onBpmChange(Number(e.target.value))} />
      <span className="hint settings-metronome-readout">{bpmToTps(bpm).toFixed(1)} TPS · {bpm} BPM</span>
      <button type="button" className="hint-btn" style={{ minHeight: 44, minWidth: 44 }} disabled={!value.metronomeOn}
        title={tr({ zh: '连续敲击设定速度', en: 'Tap repeatedly to set tempo' })} onClick={() => {
          const next = onTap(); if (next !== null) { onBpmChange(next); setHint(next); }
          clearTimeout(hintTimer.current); hintTimer.current = setTimeout(() => setHint(null), 3000);
        }}>{tr({ zh: '敲击', en: 'Tap' })}</button>
      </span>
      {hint !== null && <span className="hint">→ {hint}</span>}
    </TimerSettingRow>
    </TimerSettingsSection>
    <TimerSettingsSection title={tr({ zh: '额外观察提示', en: 'Extra inspection alerts' })}
      headerControl={<TimerDifficultyHelp question hover
        label={tr({ zh: '额外观察提示说明', en: 'About extra inspection alerts' })}
        content={tr({ zh: '按观察开始后的秒数响铃，留空关闭。独立于节拍器和提示音开关，仍使用上方音量。需在“计时”中开启 WCA 观察。', en: 'Beep at elapsed inspection seconds; leave blank to turn off. Independent of the metronome and sound-effects switch; uses the volume above. Enable WCA inspection under Timing.' })} />}>

    <TimerSettingRow field={beeps} label={tr(beeps.copy)}>
      <input className="settings-row-control-input" type="text" value={input}
        aria-label={tr(beeps.copy)} placeholder={tr({ zh: '例：5,10,15（逗号分隔）', en: 'e.g. 5,10,15 (comma-separated)' })}
        onChange={e => setInput(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} />
      <button type="button" className="hint-btn" style={{ minHeight: 44 }}
        onClick={() => { onWarmup(); onPreviewBeep(); }}>{tr({ zh: '试听', en: 'Test' })}</button>
    </TimerSettingRow>
    </TimerSettingsSection>
  </>;
}
