import { useEffect, useRef, useState } from 'react';
import { BPM_MIN, BPM_MAX, bpmToTps, parseInspectionBeepInput, timerSettingFieldContract, type TimerMetronomeSettings as Value, type TimerSettingCopy } from '@cuberoot/shared/timer';
import { TimerBooleanSettingRow, TimerSettingRow } from './TimerTimingSettingsSections';
import './compact-select.css';

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
    <TimerBooleanSettingRow field={enabled} label={tr(enabled.copy)} value={value.metronomeOn}
      onChange={metronomeOn => { if (metronomeOn) onWarmup(); onChange({ metronomeOn }); }}
      renderBooleanControl={({ label, value, onChange, disabled }) => (
        <select className="native-select" aria-label={label} value={String(value)} disabled={disabled} onChange={event => onChange(event.currentTarget.value === 'true')}>
          <option value="true">{tr({ zh: '开启', en: 'On' })}</option>
          <option value="false">{tr({ zh: '关闭', en: 'Off' })}</option>
        </select>
      )} />
    <TimerSettingRow field={tempo} label={tr(tempo.copy)}>
      <input type="range" min={BPM_MIN} max={BPM_MAX} step={1} className="settings-row-control-input"
        value={bpm} aria-label={tr(tempo.copy)} disabled={!value.metronomeOn} onChange={e => onBpmChange(Number(e.target.value))} />
      <span className="hint">{bpmToTps(bpm).toFixed(1)} TPS · {bpm} BPM</span>
      <button type="button" className="hint-btn" style={{ minHeight: 44, minWidth: 44 }} disabled={!value.metronomeOn}
        title={tr({ zh: '连续敲击设定速度', en: 'Tap repeatedly to set tempo' })} onClick={() => {
          const next = onTap(); if (next !== null) { onBpmChange(next); setHint(next); }
          clearTimeout(hintTimer.current); hintTimer.current = setTimeout(() => setHint(null), 3000);
        }}>{tr({ zh: '敲击', en: 'Tap' })}</button>
      {hint !== null && <span className="hint">→ {hint}</span>}
    </TimerSettingRow>
    <TimerSettingRow field={beeps} label={tr(beeps.copy)}>
      <input className="settings-row-control-input" type="text" value={input} disabled={!value.metronomeOn}
        aria-label={tr(beeps.copy)} placeholder={tr({ zh: '例：5,10,15（逗号分隔）', en: 'e.g. 5,10,15 (comma-separated)' })}
        onChange={e => setInput(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} />
      <button type="button" className="hint-btn" style={{ minHeight: 44 }} disabled={!value.metronomeOn}
        onClick={() => { onWarmup(); onPreviewBeep(); }}>{tr({ zh: '试听', en: 'Test' })}</button>
    </TimerSettingRow>
  </>;
}
