import BoolToggle from './BoolToggle';
import { useEffect, useRef, useState } from 'react';
import { BPM_MIN, BPM_MAX, bpmToTps, parseInspectionBeepInput, timerSettingFieldContract, type TimerMetronomeSettings as Value, type TimerSettingCopy } from '@cuberoot/shared/timer';
import { TIMER_INSPECTION_ALERTS_COPY, TIMER_SOUND_SETTINGS_COPY } from '@cuberoot/shared/timer/sound-feedback';
import { TIMER_METRONOME_COPY } from '@cuberoot/shared/timer/metronome-settings';
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
    <TimerSettingsSection title={tr(TIMER_METRONOME_COPY.heading)}>
    <p className="settings-section-note">{tr(TIMER_METRONOME_COPY.description)}</p>
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
        title={tr(TIMER_METRONOME_COPY.tapHint)} onClick={() => {
          const next = onTap(); if (next !== null) { onBpmChange(next); setHint(next); }
          clearTimeout(hintTimer.current); hintTimer.current = setTimeout(() => setHint(null), 3000);
        }}>{tr(TIMER_METRONOME_COPY.tap)}</button>
      </span>
      {hint !== null && <span className="hint">→ {hint}</span>}
    </TimerSettingRow>
    </TimerSettingsSection>
    <TimerSettingsSection title={tr(TIMER_INSPECTION_ALERTS_COPY.title)}
      headerControl={<TimerDifficultyHelp question hover
        label={tr(TIMER_INSPECTION_ALERTS_COPY.helpLabel)}
        content={tr(TIMER_INSPECTION_ALERTS_COPY.help)} />}>

    <TimerSettingRow field={beeps} label={tr(beeps.copy)}>
      <input autoComplete="off" className="settings-row-control-input" type="text" value={input}
        aria-label={tr(beeps.copy)} placeholder={tr(TIMER_SOUND_SETTINGS_COPY.beepPlaceholder)}
        onChange={e => setInput(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} />
      <button type="button" className="hint-btn" style={{ minHeight: 44 }}
        onClick={() => { onWarmup(); onPreviewBeep(); }}>{tr(TIMER_SOUND_SETTINGS_COPY.test)}</button>
    </TimerSettingRow>
    </TimerSettingsSection>
  </>;
}
