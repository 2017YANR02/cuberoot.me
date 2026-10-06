import { TimerWorkspaceLanguage } from './localization';
import StatsModal from './StatsModal';
import DailyStatsPanel from './DailyStatsPanel';
import CfopCaseStatsPanel from './CfopCaseStatsPanel';
import RecordsOverlay from './RecordsOverlay';
import ScatterChart from './charts/ScatterChart';
import HistogramChart from './charts/HistogramChart';
import HourChart from './charts/HourChart';
import type { ComponentProps } from 'react';
export function TimerStatsModal(props: ComponentProps<typeof StatsModal> & {isZh?:boolean}) { return <TimerWorkspaceLanguage.Provider value={props.isZh ? 'zh' : 'en'}><StatsModal {...props} /></TimerWorkspaceLanguage.Provider>; }
export function TimerDailyStatsPanel(props: ComponentProps<typeof DailyStatsPanel> & {isZh?:boolean}) { return <TimerWorkspaceLanguage.Provider value={props.isZh ? 'zh' : 'en'}><DailyStatsPanel {...props} /></TimerWorkspaceLanguage.Provider>; }
export function TimerCfopCaseStatsPanel(props: ComponentProps<typeof CfopCaseStatsPanel> & {isZh?:boolean}) { return <TimerWorkspaceLanguage.Provider value={props.isZh ? 'zh' : 'en'}><CfopCaseStatsPanel {...props} /></TimerWorkspaceLanguage.Provider>; }
export function TimerRecordsOverlay(props: ComponentProps<typeof RecordsOverlay> & {isZh?:boolean}) { return <TimerWorkspaceLanguage.Provider value={props.isZh ? 'zh' : 'en'}><RecordsOverlay {...props} /></TimerWorkspaceLanguage.Provider>; }
export function TimerScatterChart(props: ComponentProps<typeof ScatterChart> & {isZh?:boolean}) { return <TimerWorkspaceLanguage.Provider value={props.isZh ? 'zh' : 'en'}><ScatterChart {...props} /></TimerWorkspaceLanguage.Provider>; }
export function TimerHistogramChart(props: ComponentProps<typeof HistogramChart> & {isZh?:boolean}) { return <TimerWorkspaceLanguage.Provider value={props.isZh ? 'zh' : 'en'}><HistogramChart {...props} /></TimerWorkspaceLanguage.Provider>; }
export function TimerHourChart(props: ComponentProps<typeof HourChart> & {isZh?:boolean}) { return <TimerWorkspaceLanguage.Provider value={props.isZh ? 'zh' : 'en'}><HourChart {...props} /></TimerWorkspaceLanguage.Provider>; }
import CaseStatsPanel from './CaseStatsPanel';
export function TimerCaseStatsPanel(props: ComponentProps<typeof CaseStatsPanel> & {isZh?:boolean}) { return <TimerWorkspaceLanguage.Provider value={props.isZh ? 'zh' : 'en'}><CaseStatsPanel {...props} /></TimerWorkspaceLanguage.Provider>; }
import CrossSessionStats from './CrossSessionStats';
export function TimerCrossSessionStats(props: ComponentProps<typeof CrossSessionStats> & {isZh?:boolean}) { return <TimerWorkspaceLanguage.Provider value={props.isZh ? 'zh' : 'en'}><CrossSessionStats {...props} /></TimerWorkspaceLanguage.Provider>; }
import TrendChart from './charts/TrendChart';
export function TimerTrendChart(props: ComponentProps<typeof TrendChart> & {isZh?:boolean}) { return <TimerWorkspaceLanguage.Provider value={props.isZh ? 'zh' : 'en'}><TrendChart {...props} /></TimerWorkspaceLanguage.Provider>; }
import PracticeHeatmap from './charts/PracticeHeatmap';
export function TimerPracticeHeatmap(props: ComponentProps<typeof PracticeHeatmap> & {isZh?:boolean}) { return <TimerWorkspaceLanguage.Provider value={props.isZh ? 'zh' : 'en'}><PracticeHeatmap {...props} /></TimerWorkspaceLanguage.Provider>; }
