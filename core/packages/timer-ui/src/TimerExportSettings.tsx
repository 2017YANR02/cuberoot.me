import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useId } from 'react';
import { timerSettingFieldContract, type TimerSettingCopy } from '@cuberoot/shared/timer';

export const TIMER_EXPORT_SETTING_FIELD_IDS = ['settings.data.export-cuberoot', 'settings.data.export-cstimer', 'settings.data.export-csv', 'settings.data.export-speedstacks'] as const;
export type TimerExportFormat = 'cuberoot' | 'cstimer' | 'csv' | 'speedstacks';
const FORMATS = ['cuberoot', 'cstimer', 'csv', 'speedstacks'] as const;

export function TimerExportSettings({ onExport, disabled, localize: tr }: {
  onExport(format: TimerExportFormat): void;
  disabled?: boolean;
  localize(copy: TimerSettingCopy): string;
}) {
  const labelId = useId();
  const titles = [
    { zh: '完整备份全部成绩，可重新导入 CubeRoot', en: 'Back up all solves for later re-import into CubeRoot' },
    { zh: '导出当前分组的全部项目为 csTimer JSON', en: 'Export all events in the current session as csTimer JSON' },
    { zh: '导出当前分组的全部项目，每条成绩一行', en: 'Export all events in the current session, one row per solve' },
    { zh: '导出当前项目为 Speedstacks 文本', en: 'Export the current event as Speedstacks text' },
  ];
  return <div className="settings-row">
    <span id={labelId} className="settings-row-label">{tr({ zh: '导出', en: 'Export' })}</span>
    <span className="settings-row-control" role="group" aria-labelledby={labelId}>
      {FORMATS.map((format, index) => {
        const Icon = format === 'csv' ? FileSpreadsheet : format === 'speedstacks' ? FileText : Download;
        return <button key={format} type="button" className="hint-btn" style={{ minHeight: 44 }} disabled={disabled}
          data-setting-id={TIMER_EXPORT_SETTING_FIELD_IDS[index]} title={tr(titles[index])} onClick={() => onExport(format)}>
          <Icon size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          {tr(timerSettingFieldContract(TIMER_EXPORT_SETTING_FIELD_IDS[index]).copy)}
        </button>;
      })}
    </span>
  </div>;
}
