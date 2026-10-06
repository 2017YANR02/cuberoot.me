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
          changeColumn: current => tr({
            zh: `更改统计列，当前 ${current}`,
            en: `Change stats column, currently ${current}`,
          }),
          clear: tr({ zh: '清除', en: 'Clear' }),
          customPlaceholder: tr({ zh: '自定义 ao', en: 'Custom ao' }),
          customSize: tr({ zh: '自定义 ao 大小', en: 'Custom ao size' }),
          replace: tr({ zh: '替换', en: 'Replace' }),
        },
        showAllStats: tr({ zh: '显示全部统计', en: 'Show all stats' }),
        single: tr({ zh: '单次', en: 'time' }),
        subX: tr({ zh: '阈值占比', en: 'Sub-X' }),
        worst: tr({ zh: '最差', en: 'worst' }),
      }; }
