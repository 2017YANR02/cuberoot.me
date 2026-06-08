'use client';

// NOTE: 指标对比表格 — 从 calc_table.js 迁移
// 显示 Best/Worst/Average/BPA/WPA/Mo2~Mo4 等所有计算指标

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalcStore, isMo3ForEvent, isMbfForEvent } from '../stores/calc_store';
import { DNF_VALUE, formatTime, CalcEngine } from '../engine/calc_engine';
import { tr } from '@/i18n/tr';

export function CalcTable() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const state = useCalcStore();
  const mo3 = isMo3ForEvent(state.event);
  const isMbf = isMbfForEvent(state.event);
  const isMove = state.event === '333fm';

  // NOTE: 指标行定义 — key 对应 ComputeResult 的属性; 随语言变化, useMemo 稳定引用
  const metrics = useMemo(() => {
    const AO5_METRICS = [
      { key: 'best', label: tr({ zh: '最好', en: 'Best' }) },
      { key: 'worst', label: tr({ zh: '最差', en: 'Worst' }) },
      { key: 'avg', label: tr({ zh: '平均', en: 'Average' }) },
      { key: 'bpa', label: 'BPA' },
      { key: 'wpa', label: 'WPA' },
      { key: 'bao5', label: 'BAo5' },
      { key: 'wao5', label: 'WAo5' },
      { key: 'mo5', label: 'Mo5' },
      { key: 'mo4', label: tr({ zh: '最好 Mo4', en: 'Best Mo4' }) },
      { key: 'mo3', label: tr({ zh: '最好 Mo3', en: 'Best Mo3' }) },
      { key: 'mo2', label: tr({ zh: '最好 Mo2', en: 'Best Mo2' }) },
      { key: 'bestC', label: tr({ zh: '最好计入成绩', en: 'Best Counting',
          zhHant: "最好計入成績"
    }) },
      { key: 'median', label: tr({ zh: '中位数', en: 'Median',
          zhHant: "中位數"
    }) },
      { key: 'worstC', label: tr({ zh: '最差计入成绩', en: 'Worst Counting',
          zhHant: "最差計入成績"
    }) },
      { key: 'variance', label: tr({ zh: '方差 (s²)', en: 'Variance (s²)' }) },
      { key: 'bestAvgRatio', label: tr({ zh: '最好/平均', en: 'Best/Avg' }) },
    ];
    const MO3_METRICS = [
      { key: 'best', label: tr({ zh: '最好', en: 'Best' }) },
      { key: 'worst', label: tr({ zh: '最差', en: 'Worst' }) },
      { key: 'avg', label: tr({ zh: '均值', en: 'Mean' }) },
      { key: 'mo3', label: 'Mo3' },
      { key: 'mo2', label: tr({ zh: '最好 Mo2', en: 'Best Mo2' }) },
      { key: 'variance', label: tr({ zh: '方差 (s²)', en: 'Variance (s²)' }) },
      { key: 'bestAvgRatio', label: tr({ zh: '最好/平均', en: 'Best/Avg' }) },
    ];
    return mo3 ? MO3_METRICS : AO5_METRICS;
  }, [isZh, mo3]);

  // NOTE: 计算两个选手的指标
  const results = [0, 1].map(p => {
    if (!state.playerEnabled[p]) return null;
    const row = state.times[state.seedOn + p];
    return CalcEngine.compute(row, mo3);
  });

  // NOTE: 格式化指标值
  const formatMetric = (val: number | null | undefined, key: string): string => {
    if (val === null || val === undefined) return '-';
    if (key === 'variance') return val === null ? '-' : (val as number).toFixed(2);
    if (key === 'bestAvgRatio') return val === null ? '-' : (val as number).toFixed(2);
    if (typeof val === 'number') return formatTime(val, false, isMove, true);
    return '-';
  };

  // NOTE: 高亮更好的一方
  const isBetter = (key: string, p: number): boolean => {
    if (!results[0] || !results[1]) return false;
    const v0 = results[0][key] as number | null | undefined;
    const v1 = results[1][key] as number | null | undefined;
    if (v0 == null || v1 == null) return false;
    if (typeof v0 !== 'number' || typeof v1 !== 'number') return false;
    if (v0 >= DNF_VALUE && v1 >= DNF_VALUE) return false;
    if (key === 'variance') return p === 0 ? v0 < v1 : v1 < v0;
    if (isMbf) return p === 0 ? v0 > v1 : v1 > v0;
    return p === 0 ? v0 < v1 : v1 < v0;
  };

  return (
    <details id="calc-section">
      <summary className="stats-toggle">
        {tr({ zh: '📊 统计', en: '📊 Statistics',
            zhHant: "📊 統計"
        })}
      </summary>
      <table id="calc-table">
        <thead>
          <tr>
            <th>{tr({ zh: '指标', en: 'Metric',
                zhHant: "指標"
            })}</th>
            <th>{state.names[state.seedOn] || 'A'}</th>
            {state.playerEnabled[1] && (
              <th>{state.names[state.seedOn + 1] || 'B'}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {metrics.map(m => (
            <tr key={m.key}>
              <td>{m.label}</td>
              {[0, 1].map(p => {
                if (p === 1 && !state.playerEnabled[1]) return null;
                const r = results[p];
                const val = r ? r[m.key] as number | null | undefined : null;
                const cls = isBetter(m.key, p) ? 'calc-better' :
                  (val === null || val === undefined) ? 'calc-nan' : '';
                return <td key={p} className={cls}>{formatMetric(val, m.key)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export default CalcTable;
