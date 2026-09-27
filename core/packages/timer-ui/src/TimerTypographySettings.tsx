import { timerSettingFieldContract, type TimerTypographySettings as Value } from '@cuberoot/shared/timer';
import TimerFontPicker from './TimerFontPicker';
import { TimerSettingRow } from './TimerTimingSettingsSections';

export const TIMER_TYPOGRAPHY_SETTING_FIELD_IDS = [
  'settings.appearance.timer-font', 'settings.appearance.timer-font-scale',
  'settings.appearance.scramble-font', 'settings.appearance.scramble-font-scale',
] as const;

/** Font previews and scale controls shared by Web and installed clients. */
export function TimerTypographySettings({ value, onChange, language }: {
  value: Value; onChange(patch: Partial<Value>): void; language: 'en' | 'zh';
}) {
  return <>{(['timer', 'scramble'] as const).map((kind, index) => {
    const fontKey = `${kind}Font` as const;
    const scaleKey = `${kind}FontScale` as const;
    const field = timerSettingFieldContract(TIMER_TYPOGRAPHY_SETTING_FIELD_IDS[index * 2]);
    const scale = timerSettingFieldContract(TIMER_TYPOGRAPHY_SETTING_FIELD_IDS[index * 2 + 1]);
    return <section key={kind}>
      <TimerSettingRow field={field} label={field.copy[language]}>
        <TimerFontPicker value={value[fontKey]} language={language} ariaLabel={field.copy[language]}
          preview={kind === 'scramble' ? "R U R' F2" : undefined}
          previewWeight={kind === 'scramble' ? 400 : undefined}
          options={kind === 'scramble' ? ['liberation', 'mono', 'sans'] : undefined}
          onChange={font => onChange({ [fontKey]: font })} />
      </TimerSettingRow>
      <TimerSettingRow field={scale} label={scale.copy[language]}>
        <input type="range" className="settings-row-control-input" aria-label={scale.copy[language]}
          min={kind === 'timer' ? 0.5 : 0.6} max={kind === 'timer' ? 2 : 2.5} step={0.05}
          value={value[scaleKey]} onChange={event => onChange({ [scaleKey]: Number(event.target.value) })} />
        <span className="hint">{value[scaleKey].toFixed(2)}×</span>
      </TimerSettingRow>
    </section>;
  })}</>;
}
