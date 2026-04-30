// NOTE: CSV 导出模块
// 从 viz/csv_export.js + csv_columns.js 合并翻译为 TypeScript
// 通过直接导入配置（而非全局注册中心）生成全量统计 CSV 并触发下载

import { getConfigs as getRollingConfigs } from './rolling_stats';
import { getConfigs as getRoundConfigs } from './round_metrics';
import type { SolveEntry } from './round_metrics';
import type { RollingResult } from './rolling_stats';
import type { RoundMetricsResult } from './round_metrics';
import { ROUND_NAMES } from './data_fetch';

interface CsvGroup {
  dataKey: string;
  configs: { key: string; label: string }[];
}

// NOTE: 列注册表 — 合并原版 csv_columns.js 的注册逻辑
function getAllGroups(): CsvGroup[] {
  return [
    { dataKey: 'stats', configs: getRollingConfigs() },
    { dataKey: 'roundMetrics', configs: getRoundConfigs() },
  ];
}

export interface CsvDownloadParams {
  wcaId: string;
  eventId: string;
  solveEntries: SolveEntry[];
  stats: RollingResult;
  roundMetrics: RoundMetricsResult;
  [key: string]: unknown;
}

/**
 * NOTE: 生成并下载 CSV
 */
export function download(params: CsvDownloadParams): void {
  const entries = params.solveEntries;
  const groups = getAllGroups();

  // NOTE: 表头——固定列 + 注册列
  const headers: string[] = ['index', 'date', 'competition', 'round', 'attempt', 'single_s', 'single_pb', 'avg', 'avg_pb'];
  for (const g of groups) {
    for (const cfg of g.configs) {
      // NOTE: label 转蛇形（如 BAo5 → bao5, WorstC → worstc）
      const snake = cfg.label.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
      headers.push(snake);
      headers.push(snake + '_pb');
    }
  }

  const rows: string[] = [headers.join(',')];
  let bestAvg = Infinity;  // NOTE: avg PB 追踪

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const row: string[] = [];

    // 固定列
    row.push(String(i + 1));
    row.push(e.compDate || '');
    row.push(csvField(e.compName));
    row.push(csvField(ROUND_NAMES[e.roundType] || e.roundType));
    row.push(String(e.attemptIdx + 1));
    row.push(formatCs(e.cs));
    // NOTE: 单次 PB 从 stats 的 pbFlags.singles 取
    row.push(params.stats && params.stats.pbFlags.singles[i] ? 'PB' : '');

    // NOTE: avg 列 — WCA 官方 average（轮次第一把填值，其余空）
    const avgCs = e.average;
    row.push(avgCs !== null && avgCs !== undefined ? formatCs(avgCs) : '');
    // avg PB 判定
    if (avgCs !== null && avgCs !== undefined && avgCs > 0) {
      if (avgCs < bestAvg) {
        bestAvg = avgCs;
        row.push('PB');
      } else {
        row.push('');
      }
    } else {
      row.push('');
    }

    // 注册列
    for (const g of groups) {
      const data = params[g.dataKey] as Record<string, unknown> | undefined;
      for (const cfg of g.configs) {
        const arr = data ? (data[cfg.key] as (number | null)[]) : null;
        const val = arr ? arr[i] : null;
        row.push(val === null || val === undefined ? '' : formatCs(val));
        const pbFlags = data ? (data as { pbFlags?: Record<string, boolean[]> }).pbFlags : null;
        row.push(pbFlags && pbFlags[cfg.key] && pbFlags[cfg.key][i] ? 'PB' : '');
      }
    }

    rows.push(row.join(','));
  }

  const csv = rows.join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = params.wcaId + '_' + params.eventId + '_distribution.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── 工具 ───

function formatCs(cs: number): string {
  if (cs <= 0) return 'DNF';
  return (cs / 100).toFixed(2);
}

function csvField(str: string): string {
  if (/[,"\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}
