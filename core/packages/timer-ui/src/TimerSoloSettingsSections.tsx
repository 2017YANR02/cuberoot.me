import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { timerSettingFieldContract, type RollingStatKey } from '@cuberoot/shared/timer';
import { TIMER_ROLLING_STAT_SETTINGS_COPY } from '@cuberoot/shared/timer/rolling-stats';
import { timerFontPreviewStyle } from './TimerFontPicker';
import { SegmentTime } from './SegmentTime';
import { TimerDisplaySettings } from './TimerDisplaySettings';
import { TimerRollingStatsPicker } from './TimerRollingStatsPicker';
import { TimerScramblePreviewSettings } from './TimerScramblePreviewSettings';
import { TimerSettingRow, TimerSettingsSection } from './TimerTimingSettingsSections';
import { TimerTypographySettings } from './TimerTypographySettings';
import { timerStatsPanelLabels } from './workspace/stats-labels';

type Language = 'en' | 'zh';
const previewTime = '12.34';

type AppearanceValue = ComponentProps<typeof TimerDisplaySettings>['value']
  & ComponentProps<typeof TimerTypographySettings>['value']
  & ComponentProps<typeof TimerScramblePreviewSettings>['value'];

export function TimerSoloAppearanceSections({
  language, value, onChange, renderBooleanControl, renderReadout, displayMode, rankings,
}: {
  language: Language;
  value: AppearanceValue;
  onChange(patch: Partial<AppearanceValue>): void;
  renderBooleanControl: ComponentProps<typeof TimerDisplaySettings>['renderBooleanControl'];
  renderReadout?: (text: string) => ReactNode;
  displayMode?: ReactNode;
  rankings: ReactNode;
}) {
  const tr = (copy: { en: string; zh: string }) => copy[language];
  return <>
    <div className="settings-appearance-preview" aria-label={tr({ en: 'Appearance preview', zh: '外观预览' })}
      style={{ '--settings-time-scale': value.timerFontScale, '--settings-scramble-scale': value.scrambleFontScale } as CSSProperties}>
      <span className="settings-preview-label">{tr({ en: 'Preview', zh: '预览' })}</span>
      <strong style={timerFontPreviewStyle(value.timerFont)}>
        {renderReadout ? renderReadout(previewTime) : <SegmentTime text={previewTime} />}
      </strong>
      <span style={timerFontPreviewStyle(value.scrambleFont, 400)}>R U R&apos; U&apos; F2</span>
    </div>
    <TimerSettingsSection title={tr({ en: 'Fonts', zh: '字体' })}>
      <TimerTypographySettings value={value} language={language} onChange={onChange} />
    </TimerSettingsSection>
    <TimerSettingsSection title={tr({ en: 'Display and interaction', zh: '显示与操作' })}>
      {displayMode}
      <TimerDisplaySettings value={value} onChange={onChange} localize={tr} renderBooleanControl={renderBooleanControl}>
        <TimerScramblePreviewSettings value={value} onChange={onChange} localize={tr} renderBooleanControl={renderBooleanControl} />
      </TimerDisplaySettings>
    </TimerSettingsSection>
    <TimerSettingsSection title={tr({ en: 'Result rankings', zh: '成绩排名' })}>
      {rankings}
    </TimerSettingsSection>
  </>;
}

const rollingStatistics = timerSettingFieldContract('settings.timer.rolling-statistics');

export function TimerSoloResultSettings({ language, columns, onColumnsChange }: {
  language: Language;
  columns: readonly RollingStatKey[];
  onColumnsChange(columns: RollingStatKey[]): void;
}) {
  const labels = timerStatsPanelLabels(language).rollingPicker;
  const titles = TIMER_ROLLING_STAT_SETTINGS_COPY.column[language];
  return <TimerSettingsSection title={TIMER_ROLLING_STAT_SETTINGS_COPY.heading[language]}>
    {columns.map((column, index) => (
      <TimerSettingRow key={index} field={rollingStatistics} label={titles[index] ?? rollingStatistics.copy[language]}>
        <TimerRollingStatsPicker variant="settings" columns={columns} labels={labels}
          triggerColumns={[column]} onColumnsChange={onColumnsChange} />
      </TimerSettingRow>
    ))}
  </TimerSettingsSection>;
}
