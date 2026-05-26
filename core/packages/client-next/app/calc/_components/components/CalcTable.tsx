'use client';

// NOTE: 指标对比表格 — 从 calc_table.js 迁移
// 显示 Best/Worst/Average/BPA/WPA/Mo2~Mo4 等所有计算指标

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalcStore, isMo3ForEvent, isMbfForEvent } from '../stores/calc_store';
import { DNF_VALUE, formatTime, CalcEngine } from '../engine/calc_engine';

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
      { key: 'best', label: isZh ? '最好' : 'Best' },
      { key: 'worst', label: isZh ? '最差' : 'Worst' },
      { key: 'avg', label: isZh ? '平均' : 'Average' },
      { key: 'bpa', label: 'BPA' },
      { key: 'wpa', label: 'WPA' },
      { key: 'bao5', label: 'BAo5' },
      { key: 'wao5', label: 'WAo5' },
      { key: 'mo5', label: 'Mo5' },
      { key: 'mo4', label: isZh ? '最好 Mo4' : 'Best Mo4' },
      { key: 'mo3', label: isZh ? '最好 Mo3' : 'Best Mo3' },
      { key: 'mo2', label: isZh ? '最好 Mo2' : 'Best Mo2' },
      { key: 'bestC', label: isZh ? '最好计入成绩' : 'Best Counting' },
      { key: 'median', label: isZh ? '中位数' : 'Median' },
      { key: 'worstC', label: isZh ? '最差计入成绩' : 'Worst Counting' },
      { key: 'variance', label: isZh ? '方差 (s²)' : 'Variance (s²)' },
      { key: 'bestAvgRatio', label: isZh ? '最好/平均' : 'Best/Avg' },
    ];
    const MO3_METRICS = [
      { key: 'best', label: isZh ? '最好' : 'Best' },
      { key: 'worst', label: isZh ? '最差' : 'Worst' },
      { key: 'avg', label: isZh ? '均值' : 'Mean' },
      { key: 'mo3', label: 'Mo3' },
      { key: 'mo2', label: isZh ? '最好 Mo2' : 'Best Mo2' },
      { key: 'variance', label: isZh ? '方差 (s²)' : 'Variance (s²)' },
      { key: 'bestAvgRatio', label: isZh ? '最好/平均' : 'Best/Avg' },
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
        {isZh ? '📊 统计' : '📊 Statistics'}
      </summary>
      <table id="calc-table">
        <thead>
          <tr>
            <th>{isZh ? '指标' : 'Metric'}</th>
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
