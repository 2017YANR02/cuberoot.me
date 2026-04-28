import { useState } from 'react';
import type { Solve, EventId } from '../types';
import { summarize, subXBreakdown, eventDefaultFormat, formatPrimary, formatBestPrimary, averageOfN, bestAverageOfN, formatMs } from '../stats';
import { useSettings } from '../settings';

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
      <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
          {isZh ? '主成绩' : 'Primary'} · {pLabel}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 18, lineHeight: 1.4 }}>
          <span style={{ opacity: 0.7, fontSize: 13 }}>{isZh ? '当前' : 'Current'}</span>
          <span style={{ fontWeight: 600, opacity: primaryNow === '-' ? 0.4 : 1 }}>{primaryNow}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 18, lineHeight: 1.4 }}>
          <span style={{ opacity: 0.7, fontSize: 13 }}>{isZh ? '最佳' : 'Best'}</span>
          <span style={{ fontWeight: 600, opacity: primaryBest === '-' ? 0.4 : 1 }}>{primaryBest}</span>
        </div>
      </div>
      {(() => {
        // Compact mode: if fewer than 4 rows have non-empty values, only show
        // populated rows + Count + Best (always pin those two), with a
        // "Show all" toggle to reveal the full table. Once the user has Ao5
        // / Mo3 / etc., the full table renders by default.
        const populatedCount = rows.reduce((n, r) => n + (isEmptyVal(r.val) ? 0 : 1), 0);
        const compact = populatedCount < 4 && !expanded;
        const PIN = new Set([
          isZh ? '总数' : 'Count',
          isZh ? '最佳' : 'Best',
        ]);
        const visible = compact
          ? rows.filter(r => PIN.has(r.lbl) || !isEmptyVal(r.val))
          : rows;
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
            {populatedCount < 4 && (
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
