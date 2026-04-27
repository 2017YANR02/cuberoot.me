import { useEffect, useMemo, useState } from 'react';
import type { EventId, Solve } from '../types';
import { effectiveMs } from '../types';
import { EVENTS } from '../types';
import {
  summarize,
  pbSingleIndex,
  subXBreakdown,
  bestSingle,
  eventDefaultFormat,
  formatMs,
} from '../stats';

interface Props {
  event: EventId;
  solves: Solve[];
  isZh: boolean;
  onClose: () => void;
}

/** Largest run of consecutive calendar days containing ≥1 solve. */
function longestStreak(solves: Solve[]): number {
  if (solves.length === 0) return 0;
  const days = new Set<string>();
  for (const s of solves) {
    const d = new Date(s.ts);
    days.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  }
  const sorted = Array.from(days).map(k => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }).sort((a, b) => a - b);
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (sorted[i] - sorted[i - 1]) / 86400000;
    if (Math.round(diff) === 1) { cur++; if (cur > best) best = cur; }
    else cur = 1;
  }
  return best;
}

export default function StatsModal({ event, solves, isZh, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const evInfo = EVENTS.find(e => e.id === event);
  const evName = evInfo ? (isZh ? evInfo.nameZh : evInfo.nameEn) : event;
  const fmt = eventDefaultFormat(event);

  const summary = useMemo(() => summarize(solves), [solves]);
  const pbIdx = useMemo(() => pbSingleIndex(solves), [solves]);
  const pbDate = pbIdx >= 0 ? new Date(solves[pbIdx].ts) : null;
  const pbStr = pbIdx >= 0 ? formatMs(effectiveMs(solves[pbIdx])) : '—';
  const subX = useMemo(() => subXBreakdown(solves), [solves]);
  const streak = useMemo(() => longestStreak(solves), [solves]);
  const best = bestSingle(solves);

  // Build the lines for both display and copy. Order mimics cstimer's BUTTON_OPTIONS.
  const lines: Array<[string, string]> = [];
  lines.push([isZh ? '项目' : 'Event', evName]);
  lines.push([isZh ? '次数' : 'Count', String(summary.count)]);
  if (best !== null) lines.push([isZh ? '最佳单次' : 'Best single', formatMs(best)]);
  if (pbDate) lines.push([isZh ? 'PB 日期' : 'PB date', pbDate.toLocaleDateString()]);
  lines.push([isZh ? '平均' : 'Mean', summary.mean]);
  lines.push(['σ', summary.sd]);
  lines.push(['CV', summary.cv]);
  if (fmt.kind === 'mo3' || event === '333fm') {
    lines.push(['mo3', summary.mo3]);
    lines.push([isZh ? '最佳 mo3' : 'Best mo3', summary.bestMo3]);
  }
  if (fmt.kind === 'bo3') {
    lines.push(['bo3', summary.bo3]);
    lines.push([isZh ? '最佳 bo3' : 'Best bo3', summary.bestBo3]);
  }
  lines.push(['ao5', summary.ao5]);
  lines.push(['ao12', summary.ao12]);
  lines.push(['ao50', summary.ao50]);
  lines.push(['ao100', summary.ao100]);
  lines.push(['ao1000', summary.ao1000]);
  lines.push([isZh ? '最佳 ao5' : 'Best ao5', summary.bestAo5]);
  lines.push([isZh ? '最佳 ao12' : 'Best ao12', summary.bestAo12]);
  lines.push([isZh ? '最佳 ao50' : 'Best ao50', summary.bestAo50]);
  lines.push([isZh ? '最佳 ao100' : 'Best ao100', summary.bestAo100]);
  lines.push([isZh ? '最佳 ao1000' : 'Best ao1000', summary.bestAo1000]);
  if (streak > 0) lines.push([isZh ? '最长连续天数' : 'Longest streak', `${streak} ${isZh ? '天' : 'days'}`]);

  const textVersion = useMemo(() => {
    const header = `${evName} — ${isZh ? '统计' : 'Stats'} (n=${summary.count})`;
    const body = lines.map(([k, v]) => `${k}: ${v}`).join('\n');
    const subxBody = subX.length
      ? '\n\n' + (isZh ? 'sub-X 分布：' : 'Sub-X breakdown:') + '\n' +
          subX.map(s => `  ${s.label}: ${s.pct.toFixed(1)}%`).join('\n')
      : '';
    return header + '\n' + body + subxBody;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evName, isZh, summary.count, subX, JSON.stringify(lines)]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(textVersion);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div className="timer-modal stats-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isZh ? '完整统计' : 'Full stats'} — {evName}</h2>

        <div className="modal-section">
          <div className="stats-modal-grid">
            {lines.map(([k, v]) => (
              <div className="stats-modal-row" key={k}>
                <span className="stats-modal-lbl">{k}</span>
                <span className="stats-modal-val">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {pbIdx >= 0 && (
          <div className="modal-section">
            <h3 className="settings-h3">{isZh ? 'PB 单次' : 'PB single'}</h3>
            <div className="stats-modal-pb">
              <div>{pbStr}</div>
              <div className="scramble-text">{solves[pbIdx].scramble}</div>
            </div>
          </div>
        )}

        {subX.length > 0 && (
          <div className="modal-section">
            <h3 className="settings-h3">{isZh ? 'sub-X 分布' : 'Sub-X breakdown'}</h3>
            <div className="subx-list">
              {subX.map(s => (
                <div className="subx-row" key={s.threshold}>
                  <span className="subx-lbl">{s.label}</span>
                  <div className="subx-bar"><div className="subx-fill" style={{ width: `${s.pct}%` }} /></div>
                  <span className="subx-pct">{s.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onCopy} className="primary">
            {copied ? (isZh ? '已复制' : 'Copied') : (isZh ? '复制文本' : 'Copy text')}
          </button>
          <button onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}
