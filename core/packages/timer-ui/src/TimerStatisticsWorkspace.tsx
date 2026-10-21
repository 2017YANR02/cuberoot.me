import { RecordBadge } from './RecordBadge';
import { FileChartColumn } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import type { EventId, Solve } from '@cuberoot/shared/timer';
import { TimerStatsPanel, type TimerStatsPanelProps } from './TimerStatsPanel';
import { TimerWorkspaceLanguage } from './workspace/localization';
import CaseStatsPanel from './workspace/CaseStatsPanel';
import CrossSessionStats from './workspace/CrossSessionStats';
import ScatterChart from './workspace/charts/ScatterChart';
import HistogramChart from './workspace/charts/HistogramChart';
import HourChart from './workspace/charts/HourChart';
import TrendChart from './workspace/charts/TrendChart';
import PracticeHeatmap from './workspace/charts/PracticeHeatmap';

export interface TimerStatisticsWorkspaceProps extends Omit<TimerStatsPanelProps, 'event' | 'solves'> {
  compact?: boolean;
  event: EventId;
  solves: Solve[];
  language: 'en' | 'zh';
  view: 'stats' | 'chart';
  sessionData: ComponentProps<typeof CrossSessionStats>['data'];
  activeSessionId: string;
  onOpenFull(): void;
}
/** Both hosts inject snapshots and persistence; all statistics controls live here. */
export function TimerStatisticsWorkspace({ compact = false, language, view, sessionData, activeSessionId, onOpenFull, ...stats }: TimerStatisticsWorkspaceProps) {
  const [crossSession, setCrossSession] = useState(false);
  const [chart, setChart] = useState('histogram');
  const isZh = language === 'zh';
  const tr = (text: {en: string; zh: string}) => text[language];
  const chartProps = { solves: stats.solves, isZh, width: 300, height: 170 };
  return <TimerWorkspaceLanguage.Provider value={language}>
    <section className="timer-statistics-workspace" data-no-timer>
      {view === 'stats' ? <>
        <TimerStatsPanel renderPrBadge={compact ? undefined : () => <RecordBadge record="PR" variant="inline" />} {...stats} summaryOnly={compact} />
        {!compact && <CaseStatsPanel event={stats.event} solves={stats.solves} isZh={isZh} />}
        {!compact && <div className="timer-statistics-actions">
          <button type="button" className="timer-statistics-action" onClick={onOpenFull}>{tr({en:'Full stats',zh:'完整统计'})}</button>
          <button type="button" className="timer-statistics-action" aria-expanded={crossSession} onClick={() => setCrossSession(value => !value)}>{tr({en:'Cross-session',zh:'跨分组统计'})}</button>
        </div>}
        {!compact && crossSession && <CrossSessionStats event={stats.event} isZh={isZh} data={sessionData} activeId={activeSessionId} />}
      </> : null}
      {(compact || view === 'chart') && <>
        <select className="timer-statistics-chart-select" aria-label={tr({en:'Chart',zh:'图表'})} value={chart} onChange={event => setChart(event.target.value)}>
          {Object.entries({histogram:{en:'Histogram',zh:'分布'},trend:{en:'Trend',zh:'趋势'},scatter:{en:'Scatter',zh:'散点'},hour:{en:'Hour',zh:'时段'},heatmap:{en:'Heatmap',zh:'日历'}}).map(([id,copy]) => <option key={id} value={id}>{tr(copy)}</option>)}
        </select>
        <div className="timer-statistics-chart">
          {chart === 'histogram' && <HistogramChart {...chartProps} />}
          {chart === 'trend' && <TrendChart {...chartProps} />}
          {chart === 'scatter' && <ScatterChart {...chartProps} />}
          {chart === 'hour' && <HourChart {...chartProps} />}
          {chart === 'heatmap' && <PracticeHeatmap solves={stats.solves} isZh={isZh} cellSize={11} />}
        </div>
      </>}
      {compact && <div className="timer-statistics-actions timer-statistics-actions--report">
        <button type="button" className="timer-statistics-report" onClick={onOpenFull}>
          <FileChartColumn size={16} aria-hidden="true" />
          {tr({en:'Full stats',zh:'完整统计'})}
        </button>
      </div>}
    </section>
  </TimerWorkspaceLanguage.Provider>;
}
