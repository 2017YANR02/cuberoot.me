import { TIMER_ROLLING_STAT_SETTINGS_COPY, timerRollingStatChangeColumnCopy } from '@cuberoot/shared/timer/rolling-stats';
import type { TimerStatsPanelLabels } from '../TimerStatsPanel';
export function timerStatsPanelLabels(language: 'en' | 'zh'): TimerStatsPanelLabels { const tr = (text: {en:string;zh:string}) => text[language]; return {
        best: tr({ zh: '最佳', en: 'best' }),
        bestBo3: tr({ zh: 'bo3 最佳', en: 'best bo3' }),
        bestMo3: tr({ zh: 'mo3 最佳', en: 'best mo3' }),
        count: tr({ zh: '总数', en: 'count' }),
        current: tr({ zh: '当前', en: 'current' }),
        hideExtras: tr({ zh: '收起', en: 'Hide extras' }),
        mean: tr({ zh: '平均', en: 'mean' }),
        rollingPicker: {
          changeColumn: current => tr(timerRollingStatChangeColumnCopy(current)),
          clear: tr(TIMER_ROLLING_STAT_SETTINGS_COPY.clear),
          customPlaceholder: tr(TIMER_ROLLING_STAT_SETTINGS_COPY.customPlaceholder),
          customSize: tr(TIMER_ROLLING_STAT_SETTINGS_COPY.customSize),
          replace: tr(TIMER_ROLLING_STAT_SETTINGS_COPY.replace),
        },
        showAllStats: tr({ zh: '显示全部统计', en: 'Show all stats' }),
        single: tr({ zh: '单次', en: 'time' }),
        subX: tr({ zh: '阈值占比', en: 'Sub-X' }),
        worst: tr({ zh: '最差', en: 'worst' }),
      }; }
