'use client';

import { useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { Solve, EventId } from '../_lib/types';
import { effectiveMs } from '../_lib/types';
import {
  subXBreakdown,
  averageOfN,
  bestAverageOfN,
  bestSingle,
  worstSingle,
  meanOfAll,
  meanOfN,
  bestMeanOfN,
  bestOfN,
  bestBestOfN,
  stdDev,
  coefficientOfVariation,
  formatPct,
  bpa,
  wpa,
  formatMs,
} from '../_lib/stats';
import { useSettings, updateSettings } from '../_lib/settings';

interface Props {
  solves: Solve[];
  isZh: boolean;
  /** Kept for call-site compatibility; the cstimer table is event-agnostic. */
  event?: EventId;
}

/** Preset average windows offered in the inline "+ window" picker. */
const AO_PRESETS = [5, 12, 25, 50, 100, 200, 1000, 10000] as const;
const MIN_AO = 3;
const MAX_AO = 100000;

function sanitizeWindows(list: number[]): number[] {
  const out: number[] = [];
  for (const raw of list) {
    const n = Math.floor(Number(raw));
    if (Number.isFinite(n) && n >= MIN_AO && n <= MAX_AO && !out.includes(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

/** A formatted value counts as "empty" when it's a dash placeholder. */
function isEmptyVal(v: string): boolean {
  return v === '-' || v === '—';
}

export default function StatsPanel({ solves, isZh }: Props) {
  const settings = useSettings();
  const [expanded, setExpanded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');

  const windows = useMemo(
    () => sanitizeWindows(settings.statsAoWindows ?? []),
    [settings.statsAoWindows],
  );

  const setWindows = (next: number[]) => updateSettings({ statsAoWindows: sanitizeWindows(next) });
  const removeWindow = (n: number) => setWindows(windows.filter(w => w !== n));
  const toggleWindow = (n: number) =>
    setWindows(windows.includes(n) ? windows.filter(w => w !== n) : [...windows, n]);
  const addCustom = () => {
    const n = Math.floor(Number(customDraft.trim()));
    if (Number.isFinite(n) && n >= MIN_AO && n <= MAX_AO) { setWindows([...windows, n]); setCustomDraft(''); }
  };

  // ── cstimer-style current/best rows: time (single) + each ao window ──
  const table = useMemo(() => {
    const last = solves.length ? solves[solves.length - 1] : null;
    const rows: { key: string; label: string; cur: string; best: string; n?: number }[] = [
      {
        key: 'time',
        label: isZh ? '单次' : 'time',
        cur: last ? formatMs(effectiveMs(last)) : '-',
        best: formatMs(bestSingle(solves)),
      },
    ];
    for (const n of windows) {
      rows.push({
        key: `ao${n}`,
        label: `ao${n}`,
        cur: formatMs(averageOfN(solves, n)),
        best: formatMs(bestAverageOfN(solves, n)),
        n,
      });
    }
    return rows;
  }, [solves, windows, isZh]);

  // ── footer + extras ──
  const count = solves.length;
  const sd = stdDev(solves);
  const cv = coefficientOfVariation(solves);
  const subX = useMemo(() => subXBreakdown(solves), [solves]);

  const extras = useMemo(() => {
    const rows: { lbl: string; val: string }[] = [
      { lbl: isZh ? '平均' : 'mean',  val: formatMs(meanOfAll(solves)) },
      { lbl: isZh ? '最差' : 'worst', val: formatMs(worstSingle(solves)) },
      { lbl: 'mo3',  val: formatMs(meanOfN(solves, 3)) },
      { lbl: isZh ? 'mo3 最佳' : 'best mo3', val: formatMs(bestMeanOfN(solves, 3)) },
      { lbl: 'bo3',  val: formatMs(bestOfN(solves, 3)) },
      { lbl: isZh ? 'bo3 最佳' : 'best bo3', val: formatMs(bestBestOfN(solves, 3)) },
    ];
    // Live BPA/WPA for any window that is one solve away from completing.
    for (const n of windows) {
      if (solves.length === n - 1) {
        rows.push({ lbl: `BPA/WPA(${n})`, val: `${formatMs(bpa(solves, n))} / ${formatMs(wpa(solves, n))}` });
      }
    }
    return rows;
  }, [solves, windows, isZh]);

  const presetActive = (n: number) => windows.includes(n);

  return (
    <div className="stats-panel">
      <div className="stats-table">
        <div className="stats-table-head">
          <span className="st-label" />
          <span className="st-col">{isZh ? '当前' : 'current'}</span>
          <span className="st-col">{isZh ? '最佳' : 'best'}</span>
        </div>
        {table.map(r => (
          <div className="stats-row" key={r.key}>
            <span className="st-label">
              {r.label}
              {r.n !== undefined && (
                <button
                  type="button"
                  className="st-remove"
                  onClick={() => removeWindow(r.n!)}
                  title={isZh ? `移除 ao${r.n}` : `Remove ao${r.n}`}
                  aria-label={isZh ? `移除 ao${r.n}` : `Remove ao${r.n}`}
                >
                  <X size={11} />
                </button>
              )}
            </span>
            <span className={`st-cur ${isEmptyVal(r.cur) ? 'muted' : ''}`}>{r.cur}</span>
            <span className={`st-best ${isEmptyVal(r.best) ? 'muted' : ''}`}>{r.best}</span>
          </div>
        ))}
      </div>

      {/* Inline "+ add window" picker */}
      <div className="stats-ao-add">
        <button type="button" className="stats-ao-add-btn" onClick={() => setAddOpen(o => !o)} aria-expanded={addOpen}>
          <Plus size={13} /> {isZh ? '添加窗口' : 'Add window'}
        </button>
        {addOpen && (
          <>
            <div className="stats-ao-backdrop" onClick={() => setAddOpen(false)} />
            <div className="stats-ao-pop">
              <div className="stats-ao-presets">
                {AO_PRESETS.map(p => (
                  <button
                    type="button"
                    key={p}
                    className={`stats-ao-chip${presetActive(p) ? ' active' : ''}`}
                    onClick={() => toggleWindow(p)}
                  >
                    ao{p}
                  </button>
                ))}
              </div>
              <div className="stats-ao-custom">
                <input
                  type="number"
                  min={MIN_AO}
                  max={MAX_AO}
                  value={customDraft}
                  placeholder={isZh ? '自定义 N' : 'Custom N'}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
                />
                <button type="button" className="stats-ao-custom-add" onClick={addCustom}>
                  {isZh ? '添加' : 'Add'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer: σ / CV / count */}
      <div className="stats-foot">
        <span>σ {sd === null ? '—' : formatMs(Math.round(sd))}</span>
        <span>CV {formatPct(cv)}</span>
        <span>{isZh ? '总数' : 'count'} {count}</span>
      </div>

      {expanded && (
        <div className="stats-grid">
          {extras.map(r => (
            <div className="row" key={r.lbl}>
              <span className="lbl">{r.lbl}</span>
              <span className={`val ${isEmptyVal(r.val) ? 'muted' : ''}`}>{r.val}</span>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="stats-expand-toggle" onClick={() => setExpanded(e => !e)}>
        {expanded ? (isZh ? '收起' : 'Hide extras') : (isZh ? '显示全部统计' : 'Show all stats')}
      </button>

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
