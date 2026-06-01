/**
 * AdvancedFeatures — 高级功能组件集合
 * 1:1 翻译自 battle.js（Sprint 3~6）
 *
 * NOTE: 包含：
 * - MilestoneToast（里程碑提示）
 * - AoDetailPopup（Ao 详情弹窗）
 * - ManualInputDialog（手动输入成绩）
 * - SimulationResult（模拟赛结果）
 * - HeatmapCalendar（练习热力图）
 * - ShareCard（分享成绩卡片）
 * - csTimer 导入/JSON 导出
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBattleStore, findBestAverage } from './engine/battle_store';
import { formatTimePlain } from '@/app/[lang]/timer/_shared/format';
import { computeAo5, computeAverage, getEffectiveTimeFromEntry, isPBSingleAt } from '@/app/[lang]/timer/_shared/stats-core';
import { PUZZLES } from './engine/constants';
import type { SolveEntry } from './engine/types';

// ===== MilestoneToast =====
// 1:1 翻译自 battle.js showMilestoneToast()（行 2793~2804）

export function MilestoneToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 触发入场动画
    requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => {
      setShow(false);
      setTimeout(onDone, 300);
    }, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`milestone-toast${show ? ' show' : ''}`}>
      {message}
    </div>
  );
}

// ===== 里程碑检测逻辑 =====
// 1:1 翻译自 battle.js checkMilestone()（行 2719~2788）

export function checkMilestoneMessages(history: SolveEntry[]): string[] {
  if (history.length === 0) return [];

  const lastEntry = history[history.length - 1];
  const effTime = getEffectiveTimeFromEntry(lastEntry);
  const messages: string[] = [];

  // NOTE: PB single 检测
  if (effTime !== Infinity && isPBSingleAt(history, history.length - 1)) {
    messages.push('🏆 New PB!');
  }

  // NOTE: PB ao5 检测
  if (history.length >= 5) {
    const ao5 = computeAo5(history);
    if (ao5 !== null && ao5 !== Infinity) {
      if (history.length === 5) {
        messages.push('🥇 New PB Ao5!');
      } else {
        const prevBest = findBestAverage(history.slice(0, -1), computeAo5, 5);
        if (prevBest === null || ao5 < prevBest) {
          messages.push('🥇 New PB Ao5!');
        }
      }
    }
  }

  // NOTE: PB ao12 检测
  if (history.length >= 12) {
    const ao12Fn = (sub: SolveEntry[]) => computeAverage(sub, 12);
    const ao12 = computeAverage(history, 12);
    if (ao12 !== null && ao12 !== Infinity) {
      if (history.length === 12) {
        messages.push('🥇 New PB Ao12!');
      } else {
        const prevBest = findBestAverage(history.slice(0, -1), ao12Fn, 12);
        if (prevBest === null || ao12 < prevBest) {
          messages.push('🥇 New PB Ao12!');
        }
      }
    }
  }

  // NOTE: 整数里程碑
  const count = history.length;
  if ([100, 200, 500, 1000, 2000, 5000, 10000].includes(count)) {
    messages.push(`🎯 ${count} solves!`);
  }

  return messages;
}

// NOTE: 疲劳检测 — 1:1 翻译自 battle.js checkFatigue()（行 2812~2834）
export function checkFatigueMessage(history: SolveEntry[], locale: string): string | null {
  if (history.length < 15) return null;

  const times = history.slice(-10).map(getEffectiveTimeFromEntry).filter(t => t !== Infinity);
  if (times.length < 8) return null;

  let rising = 0;
  for (let i = 0; i <= times.length - 5; i++) {
    const avg = (times[i] + times[i + 1] + times[i + 2] + times[i + 3] + times[i + 4]) / 5;
    if (i > 0) {
      const prevAvg = (times[i - 1] + times[i] + times[i + 1] + times[i + 2] + times[i + 3]) / 5;
      if (avg > prevAvg) rising++;
    }
  }

  if (rising >= 4) {
    return locale === 'zh' ? '建议休息一下 🍵' : 'Take a break? 🍵';
  }
  return null;
}

// ===== AoDetailPopup =====
// 1:1 翻译自 battle.js showAoDetail()（行 2664~2711）

export function AoDetailPopup({ aoN, onClose }: { aoN: number; onClose: () => void }) {
  const history = useBattleStore(s => s.players[0].solveHistory);
  const precision = useBattleStore(s => s.timerPrecision);

  if (history.length < aoN) return null;
  const ftp = (ms: number) => formatTimePlain(ms, precision);

  const lastN = history.slice(-aoN);
  const effTimes = lastN.map(getEffectiveTimeFromEntry);
  const sorted = [...effTimes].sort((a, b) => a - b);
  const trim = Math.ceil(aoN / 20);

  // NOTE: 标记被 trim 的条目
  const trimmedLow: number[] = [];
  const trimmedHigh: number[] = [];
  const sortedCopy = [...sorted];
  for (let t = 0; t < trim; t++) {
    const idx = effTimes.indexOf(sortedCopy[t]);
    if (!trimmedLow.includes(idx)) trimmedLow.push(idx);
  }
  for (let t = 0; t < trim; t++) {
    const val = sortedCopy[sortedCopy.length - 1 - t];
    for (let k = effTimes.length - 1; k >= 0; k--) {
      if (effTimes[k] === val && !trimmedHigh.includes(k) && !trimmedLow.includes(k)) {
        trimmedHigh.push(k);
        break;
      }
    }
  }

  const aoVal = aoN === 5 ? computeAo5(history) : computeAverage(history, aoN);
  const aoStr = aoVal === null ? '-' : (aoVal === Infinity ? 'DNF' : ftp(aoVal));

  return (
    <div className="ao-detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ao-detail-panel">
        <div className="ao-detail-header">
          <h3>Ao{aoN}: {aoStr}</h3>
          <button className="ao-detail-close" onClick={onClose}>✕</button>
        </div>
        <div className="ao-detail-list">
          {lastN.map((_entry, i) => {
            const effTime = effTimes[i];
            const timeStr = effTime === Infinity ? 'DNF' : ftp(effTime);
            let marker = '', cls = '';
            if (trimmedLow.includes(i)) { marker = ' ↓'; cls = ' ao-trimmed-best'; }
            else if (trimmedHigh.includes(i)) { marker = ' ↑'; cls = ' ao-trimmed-worst'; }
            const globalIdx = history.length - aoN + i;

            return (
              <div key={i} className={`ao-detail-item${cls}`}>
                <span className="ao-detail-idx">{globalIdx + 1}.</span>
                <span className="ao-detail-time">{timeStr}{marker}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===== ManualInputDialog =====
// 1:1 翻译自 battle.js showManualInputDialog()（行 3055~3127）

// NOTE: 解析时间字符串 → 毫秒
function parseTimeInput(str: string): number | null {
  str = str.trim();
  if (!str) return null;
  // mm:ss.xxx
  const matchMS = str.match(/^(\d+):(\d+\.?\d*)$/);
  if (matchMS) {
    return Math.round((parseInt(matchMS[1]) * 60 + parseFloat(matchMS[2])) * 1000);
  }
  // ss.xxx
  const num = parseFloat(str);
  if (!isNaN(num) && num > 0) {
    // NOTE: 值 > 100 视为毫秒，否则视为秒
    return num > 100 ? Math.round(num) : Math.round(num * 1000);
  }
  return null;
}

export function ManualInputDialog({ onClose }: { onClose: () => void }) {
  const store = useBattleStore();
  const locale = store.locale;
  const [timeStr, setTimeStr] = useState('');
  const [penalty, setPenalty] = useState('ok');
  const [error, setError] = useState(false);

  const handleSubmit = useCallback(() => {
    const ms = parseTimeInput(timeStr);
    if (ms === null || ms <= 0) {
      setError(true);
      return;
    }
    const entry: SolveEntry = {
      time: ms,
      penalty: penalty as 'ok' | '+2' | 'dnf',
      scramble: '',
      date: new Date().toISOString(),
    };
    // NOTE: 直接修改 store 中的历史并保存
    const players = [...store.players] as [typeof store.players[0], typeof store.players[1]];
    players[0] = { ...players[0], solveHistory: [...players[0].solveHistory, entry] };
    useBattleStore.setState({ players });
    store.saveSolveHistory();
    onClose();
  }, [timeStr, penalty, store, onClose]);

  return (
    <div className="ao-detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ao-detail-panel">
        <div className="ao-detail-header">
          <h3>{locale === 'zh' ? '手动输入成绩' : 'Manual Input'}</h3>
          <button className="ao-detail-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '8px 0' }}>
          <input
            type="text"
            placeholder={locale === 'zh' ? '输入时间 (如 8.55 或 1:23.456)' : 'Enter time (e.g. 8.55 or 1:23.456)'}
            value={timeStr}
            onChange={e => { setTimeStr(e.target.value); setError(false); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            style={{
              width: '100%', padding: '10px', borderRadius: '8px',
              border: `1px solid ${error ? '#ef5350' : '#4a6785'}`,
              background: '#0a1628', color: '#fff', fontSize: '16px', boxSizing: 'border-box'
            }}
            autoFocus
          />
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <select
              value={penalty}
              onChange={e => setPenalty(e.target.value)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #4a6785', background: '#0a1628', color: '#8ab4f8' }}
            >
              <option value="ok">OK</option>
              <option value="+2">+2</option>
              <option value="dnf">DNF</option>
            </select>
            <button className="segmented-btn active" style={{ flex: 1, borderRadius: '6px' }} onClick={handleSubmit}>
              {locale === 'zh' ? '添加' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 模拟赛 =====
// 1:1 翻译自 battle.js simulateCompetition()（行 3319~3342）

function simulateCompetition(validTimes: number[], iterations: number = 1000) {
  if (validTimes.length < 5) return null;

  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sample: number[] = [];
    for (let j = 0; j < 5; j++) {
      sample.push(validTimes[Math.floor(Math.random() * validTimes.length)]);
    }
    sample.sort((a, b) => a - b);
    const ao5 = Math.round((sample[1] + sample[2] + sample[3]) / 3);
    results.push(ao5);
  }

  results.sort((a, b) => a - b);
  return {
    p50: results[Math.floor(iterations * 0.5)],
    p75: results[Math.floor(iterations * 0.75)],
    p95: results[Math.floor(iterations * 0.95)],
  };
}

export function SimulationPopup({ onClose }: { onClose: () => void }) {
  const history = useBattleStore(s => s.players[0].solveHistory);
  const precision = useBattleStore(s => s.timerPrecision);
  const locale = useBattleStore(s => s.locale);
  const ftp = (ms: number) => formatTimePlain(ms, precision);

  const validTimes = history.map(getEffectiveTimeFromEntry).filter(t => t !== Infinity);
  if (validTimes.length < 5) return null;

  const result = simulateCompetition(validTimes, 1000);
  if (!result) return null;

  return (
    <div className="ao-detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ao-detail-panel">
        <div className="ao-detail-header">
          <h3>{locale === 'zh' ? '🎲 模拟赛结果 (1000次)' : '🎲 Competition Sim (1000x)'}</h3>
          <button className="ao-detail-close" onClick={onClose}>✕</button>
        </div>
        <div className="sim-results">
          <div className="sim-row">
            <span className="sim-label">{locale === 'zh' ? '50% 概率 ≤' : '50th percentile'}</span>
            <span className="sim-value">{ftp(result.p50)}</span>
          </div>
          <div className="sim-row">
            <span className="sim-label">{locale === 'zh' ? '75% 概率 ≤' : '75th percentile'}</span>
            <span className="sim-value">{ftp(result.p75)}</span>
          </div>
          <div className="sim-row">
            <span className="sim-label">{locale === 'zh' ? '95% 概率 ≤' : '95th percentile'}</span>
            <span className="sim-value">{ftp(result.p95)}</span>
          </div>
        </div>
        <p style={{ color: '#6b7a8d', fontSize: '12px', marginTop: '12px' }}>
          {locale === 'zh' ? '基于当前成绩分布 Bootstrap 随机抽样 Ao5' : 'Ao5 bootstrap sampled from your current times distribution'}
        </p>
      </div>
    </div>
  );
}

// ===== 热力图日历 =====
// 1:1 翻译自 battle.js renderHeatmapCalendar()（行 3390~3447）

export function HeatmapCalendar({ history, locale }: { history: SolveEntry[]; locale: string }) {
  if (history.length === 0) return null;

  // NOTE: 按日期聚合
  const dayMap: Record<string, number> = {};
  history.forEach(entry => {
    if (!entry.date) return;
    const d = new Date(entry.date);
    const key = d.getFullYear() + '-' +
      (d.getMonth() + 1).toString().padStart(2, '0') + '-' +
      d.getDate().toString().padStart(2, '0');
    dayMap[key] = (dayMap[key] || 0) + 1;
  });

  const cellSize = 10, gap = 2;
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);

  const startDow = startDate.getDay();
  const totalDays = 365;
  const cols = Math.ceil((totalDays + startDow) / 7);
  const W = cols * (cellSize + gap) + 30;
  const H = 7 * (cellSize + gap) + 20;

  const maxCount = Math.max(1, ...Object.values(dayMap));
  const getColor = (count: number) => {
    if (count === 0) return '#161b22';
    const level = Math.ceil((count / maxCount) * 4);
    return ['', '#0e4429', '#006d32', '#26a641', '#39d353'][Math.min(level, 4)];
  };

  // 构建 SVG rect 列表
  const rects: React.JSX.Element[] = [];
  const current = new Date(startDate);
  for (let day = 0; day < totalDays; day++) {
    const col = Math.floor((day + startDow) / 7);
    const row = (day + startDow) % 7;
    const key = current.getFullYear() + '-' +
      (current.getMonth() + 1).toString().padStart(2, '0') + '-' +
      current.getDate().toString().padStart(2, '0');
    const count = dayMap[key] || 0;
    const x = col * (cellSize + gap);
    const y = row * (cellSize + gap);

    rects.push(
      <rect key={day} x={x} y={y} width={cellSize} height={cellSize} rx={2} fill={getColor(count)}>
        <title>{key}: {count} solves</title>
      </rect>
    );

    current.setDate(current.getDate() + 1);
  }

  return (
    <div className="heatmap-container">
      <div className="heatmap-title">{locale === 'zh' ? '练习日历' : 'Practice Calendar'}</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }}>
        {rects}
      </svg>
    </div>
  );
}

// ===== csTimer 导入 =====
// 1:1 翻译自 battle.js importFromCsTimer()（行 3136~3182）

export function importFromCsTimer(jsonText: string, store: ReturnType<typeof useBattleStore.getState>): { count: number; error?: string } {
  try {
    const data = JSON.parse(jsonText);
    let imported = 0;
    const newHistory = [...store.players[0].solveHistory];

    for (const key in data) {
      if (!Array.isArray(data[key])) continue;
      for (const record of data[key]) {
        if (!Array.isArray(record) || record.length < 2) continue;
        const [penalty, rawTime, comment, timestamp] = record;

        let timeMs: number;
        if (Array.isArray(rawTime)) {
          timeMs = rawTime[0] * 1000 + rawTime[1];
        } else {
          timeMs = Math.round(rawTime * 10);
          if (timeMs > 360000000) timeMs = Math.round(rawTime);
        }

        let penaltyStr: 'ok' | '+2' | 'dnf' = 'ok';
        if (penalty === -1) penaltyStr = 'dnf';
        else if (penalty === 2000) penaltyStr = '+2';

        newHistory.push({
          time: timeMs,
          penalty: penaltyStr,
          scramble: typeof comment === 'string' ? comment : '',
          date: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        });
        imported++;
      }
    }

    const players = [...store.players] as [typeof store.players[0], typeof store.players[1]];
    players[0] = { ...players[0], solveHistory: newHistory };
    useBattleStore.setState({ players });
    store.saveSolveHistory();
    return { count: imported };
  } catch (e) {
    return { count: 0, error: (e as Error).message };
  }
}

// NOTE: 弹出文件选择器导入 csTimer
export function triggerCsTimerImport(store: ReturnType<typeof useBattleStore.getState>, onDone: (msg: string) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.txt';
  input.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importFromCsTimer(reader.result as string, store);
      if (result.error) {
        onDone('Import failed: ' + result.error);
      } else {
        const locale = store.locale;
        onDone(locale === 'zh' ? `已导入 ${result.count} 条` : `Imported ${result.count} solves`);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ===== JSON 导出 =====
// 1:1 翻译自 battle.js exportToJson()（行 3565~3595）

export function exportToJson(history: SolveEntry[], puzzleId: string): void {
  if (history.length === 0) return;

  const records: unknown[][] = [];
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const t = entry.time;
    let penalty = 0;
    if (entry.penalty === 'dnf') penalty = -1;
    else if (entry.penalty === '+2') penalty = 2000;
    const scramble = entry.scramble || '';
    const ts = entry.date ? Math.floor(new Date(entry.date).getTime() / 1000) : Math.floor(Date.now() / 1000);
    records.push([penalty, t, scramble, ts]);
  }

  const exportData = { session1: records };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'battle_export_' + puzzleId + '_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ===== 分享卡片 =====
// 1:1 翻译自 battle.js shareResultCard()（行 3454~3557）

export function shareResultCard(history: SolveEntry[], puzzleId: string, locale: string, precision: number): void {
  if (history.length < 5) return;
  const ftp = (ms: number) => formatTimePlain(ms, precision);

  const times = history.map(getEffectiveTimeFromEntry);
  const validTimes = times.filter(t => t !== Infinity);
  const best = Math.min(...validTimes);
  const mean = Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length);
  const ao5 = computeAo5(history);
  const ao12 = history.length >= 12 ? computeAverage(history, 12) : null;

  const puzzle = PUZZLES.find(p => p.id === puzzleId);
  const puzzleName = puzzle ? (puzzle.name[locale as 'en' | 'zh'] || puzzle.name.en) : puzzleId;

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 500;
  const ctx = canvas.getContext('2d')!;

  // 背景
  const grad = ctx.createLinearGradient(0, 0, 400, 500);
  grad.addColorStop(0, '#0a1628');
  grad.addColorStop(1, '#1a2332');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 400, 500);

  // 标题
  ctx.fillStyle = '#8ab4f8';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(puzzleName, 200, 50);

  // 统计
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  const stats: [string, string][] = [
    ['Best', ftp(best)],
    ['Mean', ftp(mean)],
    ['Ao5', ao5 === null ? '-' : (ao5 === Infinity ? 'DNF' : ftp(ao5))],
    ['Ao12', ao12 === null ? '-' : (ao12 === Infinity ? 'DNF' : ftp(ao12))],
    ['Solves', history.length.toString()],
  ];
  let yPos = 100;
  for (const [label, value] of stats) {
    ctx.fillStyle = '#6b7a8d';
    ctx.fillText(label, 60, yPos);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(value, 200, yPos);
    ctx.font = '16px sans-serif';
    yPos += 40;
  }

  // 迷你折线图
  const recentValid: { i: number; t: number }[] = [];
  const last50 = history.slice(-50);
  last50.forEach((e, i) => {
    const t = getEffectiveTimeFromEntry(e);
    if (t !== Infinity) recentValid.push({ i, t });
  });
  if (recentValid.length >= 2) {
    const chartTop = 340, chartH = 100, chartLeft = 40, chartRight = 360;
    const minT = Math.min(...recentValid.map(p => p.t));
    const maxT = Math.max(...recentValid.map(p => p.t));
    const range = maxT - minT || 1;

    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    recentValid.forEach((p, j) => {
      const px = chartLeft + (p.i / (last50.length - 1)) * (chartRight - chartLeft);
      const py = chartTop + (1 - (p.t - minT) / range) * chartH;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // 水印
  ctx.fillStyle = '#4a5568';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('cuberoot.me/timer', 200, 480);

  // 下载或分享
  canvas.toBlob((blob) => {
    if (!blob) return;
    if (navigator.share) {
      const file = new File([blob], 'cube-stats.png', { type: 'image/png' });
      navigator.share({ files: [file], title: puzzleName + ' Stats' }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cube-stats.png';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, 'image/png');
}
