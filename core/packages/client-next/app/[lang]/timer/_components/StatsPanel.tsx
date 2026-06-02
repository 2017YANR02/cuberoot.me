'use client';

import { useState } from 'react';
import type { Solve, EventId } from '../_lib/types';
import {
  summarize,
  subXBreakdown,
  eventDefaultFormat,
  formatPrimary,
  formatBestPrimary,
  averageOfN,
  bestAverageOfN,
  formatMs,
} from '../_lib/stats';
import { useSettings } from '../_lib/settings';

interface Props {
  solves: Solve[];
  isZh: boolean;
  event: EventId;
}

function primaryLabel(kind: 'ao5' | 'mo3' | 'bo3' | 'single', isZh: boolean): string {
  if (kind === 'ao5')    return isZh ? '五次平均' : 'Ao5';
  if (kind === 'mo3')    return isZh ? '三次平均' : 'Mo3';
  if (kind === 'bo3')    return isZh ? '三次最佳' : 'Bo3';
  return isZh ? '单次' : 'Single';
}

const STANDARD_AOS = new Set([5, 12, 50, 100, 1000]);

/** A row's value is "empty" if it's a dash placeholder. */
function isEmptyVal(v: string): boolean {
  return v === '-' || v === '—' || v === '- / -';
}

export default function StatsPanel({ solves, isZh, event }: Props) {
  const settings = useSettings();
  const [expanded, setExpanded] = useState(false);
  const s = summarize(solves);
  const subX = subXBreakdown(solves);
  const customAos = (settings.customAoWindows ?? []).filter(n => !STANDARD_AOS.has(n));
  const fmt = eventDefaultFormat(event);
  const primaryNow = formatPrimary(solves, fmt);
  const primaryBest = formatBestPrimary(solves, fmt);
  const pLabel = primaryLabel(fmt.kind, isZh);
  const liveBpaWpa5 = s.bpa5 !== '-' || s.wpa5 !== '-';
  const liveBpaWpa12 = s.bpa12 !== '-' || s.wpa12 !== '-';
  const rows: { lbl: string; val: string }[] = [
    { lbl: isZh ? '总数' : 'Count',     val: s.count.toString() },
    { lbl: isZh ? '最佳' : 'Best',      val: s.best },
    { lbl: isZh ? '最差' : 'Worst',     val: s.worst },
    { lbl: isZh ? '平均' : 'Mean',      val: s.mean },
    { lbl: 'σ',                         val: s.sd },
    { lbl: 'CV',                        val: s.cv },
    { lbl: 'Ao5',                       val: s.ao5 },
    ...(liveBpaWpa5 ? [{ lbl: 'BPA/WPA(5)', val: `${s.bpa5} / ${s.wpa5}` }] : []),
    { lbl: 'Ao12',                      val: s.ao12 },
    ...(liveBpaWpa12 ? [{ lbl: 'BPA/WPA(12)', val: `${s.bpa12} / ${s.wpa12}` }] : []),
    { lbl: 'Mo3',                       val: s.mo3 },
    { lbl: 'Bo3',                       val: s.bo3 },
    { lbl: 'Ao50',                      val: s.ao50 },
    { lbl: 'Ao100',                     val: s.ao100 },
    { lbl: 'Ao1000',                    val: s.ao1000 },
    { lbl: isZh ? 'Ao5 最佳' : 'Best Ao5',     val: s.bestAo5 },
    { lbl: isZh ? 'Ao12 最佳' : 'Best Ao12',   val: s.bestAo12 },
    { lbl: isZh ? 'Mo3 最佳' : 'Best Mo3',     val: s.bestMo3 },
    { lbl: isZh ? 'Bo3 最佳' : 'Best Bo3',     val: s.bestBo3 },
    { lbl: isZh ? 'Ao50 最佳' : 'Best Ao50',   val: s.bestAo50 },
    { lbl: isZh ? 'Ao100 最佳' : 'Best Ao100', val: s.bestAo100 },
    { lbl: isZh ? 'Ao1000 最佳' : 'Best Ao1000', val: s.bestAo1000 },
    ...customAos.flatMap(n => [
      { lbl: `Ao${n}`,                              val: formatMs(averageOfN(solves, n)) },
      { lbl: isZh ? `Ao${n} 最佳` : `Best Ao${n}`,  val: formatMs(bestAverageOfN(solves, n)) },
    ]),
  ];
  return (
    <div className="stats-panel">
      <h3>{isZh ? '统计' : 'Stats'}</h3>
      <div className="stats-primary">
        <div className="stats-primary-head">
          {isZh ? '主成绩' : 'Primary'} <span className="stats-primary-sub">{pLabel}</span>
        </div>
        <div className="stats-primary-row">
          <span className="lbl">{isZh ? '当前' : 'Current'}</span>
          <span className={`stats-primary-val ${primaryNow === '-' ? 'muted' : ''}`}>{primaryNow}</span>
        </div>
        <div className="stats-primary-row">
          <span className="lbl">{isZh ? '最佳' : 'Best'}</span>
          <span className={`stats-primary-val ${primaryBest === '-' ? 'muted' : ''}`}>{primaryBest}</span>
        </div>
      </div>
      {(() => {
        // Show a small core set by default (Count/Best/Mean/σ/Ao5/Ao12/Mo3),
        // keep the long tail (all Best-of-N, Ao50/100/1000, customs) one tap
        // away behind the toggle — so the rail isn't a 22-row scroll wall.
        // Live BPA/WPA rows stay visible (they only exist mid-average), and on
        // a fresh session (<4 populated) any populated row is pinned too.
        const populatedCount = rows.reduce((n, r) => n + (isEmptyVal(r.val) ? 0 : 1), 0);
        const PRIMARY = new Set([
          isZh ? '总数' : 'Count',
          isZh ? '最佳' : 'Best',
          isZh ? '平均' : 'Mean',
          'σ', 'Ao5', 'Ao12', 'Mo3',
        ]);
        const isLive = (lbl: string) => lbl.startsWith('BPA/WPA');
        const visible = expanded
          ? rows
          : rows.filter(r => PRIMARY.has(r.lbl) || isLive(r.lbl) || (populatedCount < 4 && !isEmptyVal(r.val)));
        const hasExtras = rows.some(r => !PRIMARY.has(r.lbl) && !isLive(r.lbl));
        return (
          <>
            <div className="stats-grid">
              {visible.map(r => (
                <div className="row" key={r.lbl}>
                  <span className="lbl">{r.lbl}</span>
                  <span className={`val ${isEmptyVal(r.val) ? 'muted' : ''}`}>{r.val}</span>
                </div>
              ))}
            </div>
            {hasExtras && (
              <button
                type="button"
                className="stats-expand-toggle"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded
                  ? (isZh ? '收起' : 'Hide extras')
                  : (isZh ? '显示全部统计' : 'Show all averages')}
              </button>
            )}
          </>
        );
      })()}
      {subX.length > 0 && (
        <>
          <h3 style={{ marginTop: 12 }}>{isZh ? '阈值占比' : 'Sub-X'}</h3>
          <div className="subx-list">
            {subX.map(x => (
              <div className="subx-row" key={x.threshold}>
                <span className="subx-lbl">{x.label}</span>
                <div className="subx-bar">
                  <div className="subx-fill" style={{ width: `${x.pct}%` }} />
                </div>
                <span className="subx-pct">{x.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
