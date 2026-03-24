/**
 * HistoryPanel — Solo 模式成绩历史面板
 * 1:1 翻译自 battle.js renderHistory()（行 2200~2395）
 *
 * NOTE: 功能列表：
 * - 成绩列表（最新在上，带 PB/best/worst 高亮）
 * - 百分位 chip 栏（sub-X %）
 * - 趋势折线图（SVG）
 * - 删除 / Undo / 导出 CSV
 * - 点击展开打乱公式
 * - 渐进式加载
 */

import { useState, useMemo, useCallback } from 'react';
import { useBattleStore } from './engine/battle_store';
import { formatTimePlain } from './engine/format_time';
import { computeAo5, computeAverage, getEffectiveTimeFromEntry, computeSubXBreakdown } from './engine/stats';
import type { SolveEntry } from './engine/types';

// NOTE: 渐进式加载每批数量
const BATCH_SIZE = 100;

// NOTE: 趋势图颜色配置
const TREND_COLORS = {
  single: '#8ab4f8',
  ao5: '#66bb6a',
  ao12: '#ff9800',
};

// ===== 趋势图组件 =====
// 1:1 翻译自 battle.js renderTrendChart()（行 2530~2620 大致区间）

function TrendChart({ history }: { history: SolveEntry[] }) {
  const enabledAverages = useBattleStore(s => s.enabledAverages);

  if (history.length < 2) return null;

  const times = history.map(getEffectiveTimeFromEntry);
  const validTimes = times.filter(t => t !== Infinity);
  if (validTimes.length < 2) return null;

  // NOTE: 计算 Y 轴范围
  const minTime = Math.min(...validTimes);
  const maxTime = Math.max(...validTimes);
  const yRange = maxTime - minTime || 1000;
  // NOTE: 留 10% margin
  const yMin = Math.max(0, minTime - yRange * 0.1);
  const yMax = maxTime + yRange * 0.1;

  const w = 500;
  const h = 100;
  const pad = { top: 4, right: 4, bottom: 4, left: 4 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  // NOTE: 构建数据点
  const toX = (i: number) => pad.left + (i / (times.length - 1)) * plotW;
  const toY = (t: number) => {
    if (t === Infinity) return h + 20; // DNF 画到可视区外
    return pad.top + plotH - ((t - yMin) / (yMax - yMin)) * plotH;
  };

  // NOTE: 构建 Single 折线路径
  const singlePath = times.map((t, i) => {
    const x = toX(i).toFixed(1);
    const y = toY(t).toFixed(1);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  // NOTE: 构建 Ao5/Ao12 折线路径
  const buildAoPath = (n: number): string => {
    const points: string[] = [];
    for (let i = n - 1; i < times.length; i++) {
      const slice = history.slice(i - n + 1, i + 1);
      const val = n === 5 ? computeAo5(slice) : computeAverage(slice, n);
      if (val !== null && val !== Infinity) {
        const x = toX(i).toFixed(1);
        const y = toY(val).toFixed(1);
        points.push(`${points.length === 0 ? 'M' : 'L'}${x},${y}`);
      }
    }
    return points.join(' ');
  };

  return (
    <div className="trend-chart">
      <svg className="trend-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* Single */}
        <path d={singlePath} fill="none" stroke={TREND_COLORS.single} strokeWidth="1.5" opacity="0.7" />
        {/* Ao5 */}
        {enabledAverages.includes(5) && (
          <path d={buildAoPath(5)} fill="none" stroke={TREND_COLORS.ao5} strokeWidth="1.5" opacity="0.9" />
        )}
        {/* Ao12 */}
        {enabledAverages.includes(12) && (
          <path d={buildAoPath(12)} fill="none" stroke={TREND_COLORS.ao12} strokeWidth="1.5" opacity="0.9" />
        )}
      </svg>
      <div className="trend-legend">
        <span><svg width="12" height="3"><rect fill={TREND_COLORS.single} width="12" height="3"/></svg> Single</span>
        {enabledAverages.includes(5) && <span><svg width="12" height="3"><rect fill={TREND_COLORS.ao5} width="12" height="3"/></svg> Ao5</span>}
        {enabledAverages.includes(12) && <span><svg width="12" height="3"><rect fill={TREND_COLORS.ao12} width="12" height="3"/></svg> Ao12</span>}
      </div>
    </div>
  );
}

// NOTE: 格式化相对日期
function formatRelativeDate(isoDate: string, locale: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);
  const timeStr = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');

  if (diff === 0) return timeStr;
  if (diff === 1) return (locale === 'zh' ? '昨天 ' : 'Yesterday ') + timeStr;
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + timeStr;
}

// NOTE: 导出成绩为 CSV — 1:1 翻译自 battle.js exportCSV()
function exportCSV(history: SolveEntry[], puzzleId: string, precision: number) {
  if (history.length === 0) return;

  const ftp = (ms: number) => formatTimePlain(ms, precision);
  const header = '#,Time(ms),Penalty,Ao5,Scramble,Date,Memo(ms)';
  const rows = history.map((entry, i) => {
    const effTime = getEffectiveTimeFromEntry(entry);
    const timeStr = effTime === Infinity ? 'DNF' : ftp(effTime);
    const ao5 = i >= 4 ? computeAo5(history.slice(0, i + 1)) : null;
    const ao5Str = ao5 === null ? '' : (ao5 === Infinity ? 'DNF' : ftp(ao5));
    const scramble = entry.scramble ? entry.scramble.replace(/,/g, ';') : '';
    const date = entry.date || '';
    const memo = entry.memo ? ftp(entry.memo) : '';
    const penalty = entry.penalty || 'ok';
    return `${i + 1},${timeStr},${penalty},${ao5Str},"${scramble}",${date},${memo}`;
  });

  const csv = header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solves_${puzzleId}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== 主组件 =====

export default function HistoryPanel() {
  const store = useBattleStore();
  const history = store.players[0].solveHistory;
  const locale = store.locale;
  const precision = store.timerPrecision;
  const puzzleId = store.puzzleId;

  // NOTE: 渐进式加载状态
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  // NOTE: 展开的条目索引集合
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());

  const ftp = useCallback((ms: number) => formatTimePlain(ms, precision), [precision]);

  // NOTE: 预计算统计数据 — O(n) 单次扫描
  const computed = useMemo(() => {
    if (history.length === 0) return null;

    const times = history.map(getEffectiveTimeFromEntry);
    const validTimes = times.filter(t => t !== Infinity);
    const best = validTimes.length > 0 ? Math.min(...validTimes) : null;
    const worst = validTimes.length > 0 ? Math.max(...validTimes) : null;
    const bestIdx = best !== null ? times.indexOf(best) : -1;
    const worstIdx = worst !== null ? times.lastIndexOf(worst) : -1;

    // NOTE: PB 索引集合
    const pbSet = new Set<number>();
    let runningMin = Infinity;
    for (let i = 0; i < history.length; i++) {
      const t = times[i];
      if (t !== Infinity && t < runningMin) {
        runningMin = t;
        pbSet.add(i);
      }
    }

    // NOTE: 滚动 Ao5 数组
    const rollingAo5: (number | null)[] = new Array(history.length).fill(null);
    for (let i = 4; i < history.length; i++) {
      rollingAo5[i] = computeAo5(history.slice(i - 4, i + 1));
    }

    // NOTE: 百分位 chip 数据
    const subXData = computeSubXBreakdown(validTimes, ftp);

    return { times, validTimes, bestIdx, worstIdx, pbSet, rollingAo5, subXData };
  }, [history, ftp]);

  if (history.length === 0) {
    return (
      <div className="history-panel">
        <div className="history-header">
          <span className="history-title">📋 History</span>
          <span className="history-stats"></span>
        </div>
        <div className="history-empty">No solves yet</div>
      </div>
    );
  }

  if (!computed) return null;

  const { times, bestIdx, worstIdx, pbSet, rollingAo5, subXData } = computed;

  // NOTE: 构建显示列表（最新在上，截取到 visibleCount）
  const renderStart = Math.max(0, history.length - visibleCount);
  const visibleItems = [];
  for (let i = history.length - 1; i >= renderStart; i--) {
    visibleItems.push(i);
  }

  const toggleExpand = (idx: number) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="history-panel">
      <div className="history-header">
        <span className="history-title">📋 History</span>
        <span className="history-stats">{history.length} solves</span>
      </div>

      {/* 功能按钮行 */}
      <div className="history-tools">
        {store.undoStack.length > 0 && (
          <button className="history-tool-btn" onClick={() => store.undoDelete()}>
            ↩️ Undo
          </button>
        )}
        <button className="history-tool-btn" onClick={() => exportCSV(history, puzzleId, precision)}>
          📥 Export CSV
        </button>
      </div>

      {/* 趋势图 */}
      <TrendChart history={history} />

      {/* 百分位 chip 栏 */}
      {subXData.length > 0 && (
        <div className="subx-chip-bar">
          {subXData.map(d => (
            <span key={d.threshold} className="subx-chip">{d.label}: {d.pct}%</span>
          ))}
        </div>
      )}

      {/* 成绩列表 */}
      <div className="history-list">
        {visibleItems.map(i => {
          const entry = history[i];
          const effTime = times[i];
          const timeStr = effTime === Infinity ? 'DNF' : ftp(effTime);

          let timeClass = 'h-time';
          if (i === bestIdx) timeClass += ' h-best';
          else if (i === worstIdx) timeClass += ' h-worst';
          if (entry.penalty === '+2') timeClass += ' h-plus2';
          else if (entry.penalty === 'dnf') timeClass += ' h-dnf';

          const isPB = pbSet.has(i);
          const ao5 = rollingAo5[i];
          const ao5Str = ao5 === null ? '' : (ao5 === Infinity ? 'DNF' : ftp(ao5));
          const scramble = entry.scramble || '';
          const dateStr = entry.date ? formatRelativeDate(entry.date, locale) : '';
          const isExpanded = expandedSet.has(i);

          // NOTE: 多阶段分段显示
          let phaseStr = '';
          if (entry.phases && entry.phases.length > 1) {
            const labels = entry.phases.map((t: number, j: number) => {
              const delta = j === 0 ? t : t - entry.phases![j - 1];
              const label = ['333bf', '444bf', '555bf'].includes(puzzleId) && j === 0 ? 'memo' : 'P' + (j + 1);
              return label + ':' + ftp(delta);
            });
            phaseStr = ' [' + labels.join(' ') + ']';
          }

          return (
            <div
              key={i}
              className={`history-item${isExpanded ? ' expanded' : ''}`}
              onClick={() => toggleExpand(i)}
            >
              <span className="h-idx">{i + 1}.</span>
              <span className={timeClass}>
                {timeStr}
                {phaseStr && <span className="h-memo">{phaseStr}</span>}
                {isPB && <span className="h-pb" title="PB">🏆</span>}
              </span>
              <span className="h-ao5">{ao5Str}</span>
              <span className="h-date">{dateStr}</span>
              <button className="h-delete" onClick={(e) => {
                e.stopPropagation();
                store.deleteHistoryItem(i);
              }}>🗑️</button>
              <span className="h-scramble">{scramble}</span>
            </div>
          );
        })}

        {/* 加载更多按钮 */}
        {renderStart > 0 && (
          <div className="load-more-wrapper">
            <button
              className="history-tool-btn"
              onClick={() => setVisibleCount(prev => prev + BATCH_SIZE)}
            >
              {locale === 'zh' ? `加载更多 (${renderStart})` : `Load More (${renderStart})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
