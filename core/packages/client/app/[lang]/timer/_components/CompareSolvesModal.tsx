'use client';

/**
 * CompareSolvesModal — side-by-side comparison of two solves' stage breakdown.
 *
 * Renders a per-stage table (Cross / F2L / OLL / PLL) plus total HTM and TPS
 * with B-vs-A deltas. When a solve has no recorded `stageSegments` (e.g.
 * manually entered, or pre-stage-analysis), we render a hint inline rather
 * than a broken row.
 */

import type { JSX } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Solve } from '../_lib/types';
import { effectiveMs, eventInfo } from '../_lib/types';
import { formatMs } from '../_lib/stats';
import { computeStageSegments } from '../_lib/reconstruct/stage_segments';
import type { StageSegments } from '../_lib/reconstruct/stage_segments';
import { useIsMobile } from '@/hooks/useIsMobile';
import './reconstruct.css';
import { tr } from '@/i18n/tr';

interface Props {
  solveA: Solve;
  solveB: Solve;
  isZh: boolean;
  onClose: () => void;
}

type StageKey = 'cross' | 'f2l' | 'oll' | 'pll';

interface StageRow {
  key: StageKey;
  labelEn: string;
  labelZh: string;
  msA: number | null;
  msB: number | null;
  htmA: number | null;
  htmB: number | null;
  caseA: string | null;
  caseB: string | null;
}

function getOrCompute(s: Solve): StageSegments | null {
  if (s.stageSegments) return s.stageSegments;
  if (s.moves && s.moves.length > 0) {
    return computeStageSegments(s.scramble, s.moves, s.timeMs);
  }
  return null;
}

function fmtStage(ms: number | null): string {
  return ms === null ? '—' : `${(ms / 1000).toFixed(2)}s`;
}

function fmtTps(ms: number | null, htm: number | null): string {
  if (ms === null || htm === null || ms <= 0) return '—';
  return (htm / (ms / 1000)).toFixed(2);
}

function renderMsDelta(a: number | null, b: number | null, _isZh: boolean): JSX.Element {
  if (a === null || b === null) return <span style={{ color: '#666' }}>—</span>;
  const d = b - a;
  if (Math.abs(d) < 5) return <span style={{ color: '#888' }}>{tr({ zh: '持平', en: 'tie' })}</span>;
  const faster = d < 0;
  const sign = d > 0 ? '+' : '−';
  const cls = faster ? 'faster' : 'slower';
  return (
    <span className={`reconstruct-stage-delta ${cls}`}>
      {sign}{(Math.abs(d) / 1000).toFixed(2)}s
    </span>
  );
}

function renderTpsDelta(a: number | null, b: number | null): JSX.Element {
  if (a === null || b === null) return <span style={{ color: '#666' }}>—</span>;
  const d = b - a;
  if (Math.abs(d) < 0.05) return <span style={{ color: '#888' }}>tie</span>;
  const cls = d > 0 ? 'faster' : 'slower';
  const sign = d > 0 ? '+' : '−';
  return (
    <span className={`reconstruct-stage-delta ${cls}`}>
      {sign}{Math.abs(d).toFixed(2)}
    </span>
  );
}

function renderHtmDelta(a: number | null, b: number | null): JSX.Element {
  if (a === null || b === null) return <span style={{ color: '#666' }}>—</span>;
  const d = b - a;
  if (d === 0) return <span style={{ color: '#888' }}>tie</span>;
  const cls = d < 0 ? 'faster' : 'slower';
  const sign = d > 0 ? '+' : '−';
  return (
    <span className={`reconstruct-stage-delta ${cls}`}>
      {sign}{Math.abs(d)}
    </span>
  );
}

function totalHtm(seg: StageSegments | null): number | null {
  if (!seg) return null;
  let total = 0;
  let any = false;
  for (const v of [seg.crossHtm, seg.f2lHtm, seg.ollHtm, seg.pllHtm]) {
    if (v !== null) { total += v; any = true; }
  }
  return any ? total : null;
}

function overallTps(seg: StageSegments | null, totalMs: number): number | null {
  const h = totalHtm(seg);
  if (h === null || totalMs <= 0) return null;
  return h / (totalMs / 1000);
}

function fmtTpsValue(ms: number | null, htm: number | null): number | null {
  if (ms === null || htm === null || ms <= 0) return null;
  return htm / (ms / 1000);
}

export default function CompareSolvesModal({ solveA, solveB, isZh, onClose }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const isMobile = useIsMobile(480);

  const segA = useMemo(() => getOrCompute(solveA), [solveA]);
  const segB = useMemo(() => getOrCompute(solveB), [solveB]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { closeBtnRef.current?.focus(); }, []);

  const stages: StageRow[] = [
    {
      key: 'cross', labelEn: 'Cross', labelZh: '十字',
      msA: segA?.crossMs ?? null, msB: segB?.crossMs ?? null,
      htmA: segA?.crossHtm ?? null, htmB: segB?.crossHtm ?? null,
      caseA: segA?.crossSide ?? null, caseB: segB?.crossSide ?? null,
    },
    {
      key: 'f2l', labelEn: 'F2L', labelZh: 'F2L',
      msA: segA?.f2lMs ?? null, msB: segB?.f2lMs ?? null,
      htmA: segA?.f2lHtm ?? null, htmB: segB?.f2lHtm ?? null,
      caseA: null, caseB: null,
    },
    {
      key: 'oll', labelEn: 'OLL', labelZh: 'OLL',
      msA: segA?.ollMs ?? null, msB: segB?.ollMs ?? null,
      htmA: segA?.ollHtm ?? null, htmB: segB?.ollHtm ?? null,
      caseA: segA?.ollCase ?? null, caseB: segB?.ollCase ?? null,
    },
    {
      key: 'pll', labelEn: 'PLL', labelZh: 'PLL',
      msA: segA?.pllMs ?? null, msB: segB?.pllMs ?? null,
      htmA: segA?.pllHtm ?? null, htmB: segB?.pllHtm ?? null,
      caseA: segA?.pllCase ?? null, caseB: segB?.pllCase ?? null,
    },
  ];

  const totalA = effectiveMs(solveA);
  const totalB = effectiveMs(solveB);
  const totalHtmA = totalHtm(segA);
  const totalHtmB = totalHtm(segB);
  const tpsA = overallTps(segA, solveA.timeMs);
  const tpsB = overallTps(segB, solveB.timeMs);

  const dtA = new Date(solveA.ts);
  const dtB = new Date(solveB.ts);
  const evA = eventInfo(solveA.event);
  const evB = eventInfo(solveB.event);

  const headerStyle: React.CSSProperties = isMobile
    ? {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 12,
        color: '#bbb',
        padding: '8px 0',
        borderBottom: '1px solid #2a2a2e',
        marginBottom: 8,
      }
    : {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
        fontSize: 12,
        color: '#bbb',
        padding: '8px 0',
        borderBottom: '1px solid #2a2a2e',
        marginBottom: 8,
      };
  const rowStyle: React.CSSProperties = isMobile
    ? {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 0',
        borderBottom: '1px solid #1f1f23',
        fontSize: 13,
      }
    : {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
        padding: '8px 0',
        borderBottom: '1px solid #1f1f23',
        alignItems: 'start',
        fontSize: 13,
      };
  const colStyle: React.CSSProperties = { color: '#eee' };
  const subStyle: React.CSSProperties = { color: '#888', fontSize: 11, marginTop: 2 };
  const labelCellStyle: React.CSSProperties = {
    fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5,
  };
  const mobileLineStyle: React.CSSProperties = {
    display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'baseline', fontSize: 12,
  };
  const mobileTagStyle: React.CSSProperties = {
    color: '#aaa', fontSize: 11, fontWeight: 600, minWidth: 14,
  };

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal"
        role="dialog"
        aria-modal="true"
        aria-label={tr({ zh: '对比成绩', en: 'Compare solves'
        })}
        style={isMobile ? { maxWidth: '100%', width: '100%' } : { maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{tr({ zh: '对比成绩', en: 'Compare solves'
        })}</h2>

        <div style={headerStyle}>
          <div>
            <div style={{ color: '#aaa', fontSize: 11 }}>A · {(isZh ? evA.nameZh : evA.nameEn)}</div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: isMobile ? 14 : 16 }}>{formatMs(totalA)}</div>
            <div style={subStyle}>{dtA.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: '#aaa', fontSize: 11 }}>B · {(isZh ? evB.nameZh : evB.nameEn)}</div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: isMobile ? 14 : 16 }}>{formatMs(totalB)}</div>
            <div style={subStyle}>{dtB.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: '#aaa', fontSize: 11 }}>{tr({ zh: '差异 (B − A)', en: 'Delta (B − A)'
            })}</div>
            <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>
              {Number.isFinite(totalA) && Number.isFinite(totalB)
                ? renderMsDelta(totalA, totalB, isZh)
                : <span style={{ color: '#888' }}>—</span>}
            </div>
          </div>
        </div>

        {(!segA || !segB) && (
          <div
            className="reconstruct-empty"
            style={{ marginBottom: 12, fontSize: 12, color: '#d4885a' }}
          >
            {!segA && !segB
              ? tr({ zh: '两次成绩都没有阶段数据 — 在设置中点击"重新分析"试试', en: 'No stage data on either solve — try Reanalyze in settings'
                                      })
              : !segA
                ? tr({ zh: 'A 没有阶段数据 — 在设置中点击"重新分析"试试', en: 'A has no stage data — try Reanalyze in settings'
                                              })
                : tr({ zh: 'B 没有阶段数据 — 在设置中点击"重新分析"试试', en: 'B has no stage data — try Reanalyze in settings'
                                              })}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          {stages.map(s => {
            const caseDiff = s.caseA !== null && s.caseB !== null && s.caseA !== s.caseB;
            if (isMobile) {
              return (
                <div key={s.key} style={rowStyle}>
                  <div style={{ ...labelCellStyle, marginBottom: 4 }}>
                    <span className={`reconstruct-stage-dot stage-${s.key}`} style={{ marginRight: 4 }} />
                    {(isZh ? s.labelZh : s.labelEn)}
                  </div>
                  <div style={mobileLineStyle}>
                    <span style={mobileTagStyle}>A</span>
                    <span style={{ color: '#eee' }}>{fmtStage(s.msA)}</span>
                    {s.caseA && (
                      <span style={{ color: caseDiff ? '#d4885a' : '#888' }}>· {s.caseA}</span>
                    )}
                    <span style={{ color: '#888' }}>
                      · {s.htmA !== null ? `${s.htmA} htm · ${fmtTps(s.msA, s.htmA)} tps` : '—'}
                    </span>
                  </div>
                  <div style={mobileLineStyle}>
                    <span style={mobileTagStyle}>B</span>
                    <span style={{ color: '#eee' }}>{fmtStage(s.msB)}</span>
                    {s.caseB && (
                      <span style={{ color: caseDiff ? '#d4885a' : '#888' }}>· {s.caseB}</span>
                    )}
                    <span style={{ color: '#888' }}>
                      · {s.htmB !== null ? `${s.htmB} htm · ${fmtTps(s.msB, s.htmB)} tps` : '—'}
                    </span>
                  </div>
                  <div style={mobileLineStyle}>
                    <span style={mobileTagStyle}>Δ</span>
                    {renderMsDelta(s.msA, s.msB, isZh)}
                    <span style={{ color: '#888' }}>·</span>
                    <span style={{ color: '#888' }}>{tr({ zh: '步数 ', en: 'htm '
                    })}</span>
                    {renderHtmDelta(s.htmA, s.htmB)}
                    <span style={{ color: '#888' }}>· tps</span>
                    {renderTpsDelta(fmtTpsValue(s.msA, s.htmA), fmtTpsValue(s.msB, s.htmB))}
                  </div>
                </div>
              );
            }
            return (
              <div key={s.key} style={rowStyle}>
                <div style={colStyle}>
                  <div style={labelCellStyle}>
                    <span className={`reconstruct-stage-dot stage-${s.key}`} style={{ marginRight: 4 }} />
                    {(isZh ? s.labelZh : s.labelEn)}
                  </div>
                  <div>{fmtStage(s.msA)}</div>
                  <div style={subStyle}>
                    {s.htmA !== null ? `${s.htmA} htm · ${fmtTps(s.msA, s.htmA)} tps` : '—'}
                  </div>
                  {s.caseA && (
                    <div style={{ ...subStyle, color: caseDiff ? '#d4885a' : '#888' }}>
                      {s.caseA}
                    </div>
                  )}
                </div>
                <div style={colStyle}>
                  <div style={labelCellStyle}>&nbsp;</div>
                  <div>{fmtStage(s.msB)}</div>
                  <div style={subStyle}>
                    {s.htmB !== null ? `${s.htmB} htm · ${fmtTps(s.msB, s.htmB)} tps` : '—'}
                  </div>
                  {s.caseB && (
                    <div style={{ ...subStyle, color: caseDiff ? '#d4885a' : '#888' }}>
                      {s.caseB}
                    </div>
                  )}
                </div>
                <div style={colStyle}>
                  <div style={labelCellStyle}>{tr({ zh: '差异', en: 'Δ'
                })}</div>
                  <div>{renderMsDelta(s.msA, s.msB, isZh)}</div>
                  <div style={subStyle}>
                    {tr({ zh: '步数 ', en: 'htm '
                    })}{renderHtmDelta(s.htmA, s.htmB)}
                    {' · '}
                    tps {renderTpsDelta(fmtTpsValue(s.msA, s.htmA), fmtTpsValue(s.msB, s.htmB))}
                  </div>
                </div>
              </div>
            );
          })}

          {isMobile ? (
            <div style={{ ...rowStyle, borderBottom: 'none', marginTop: 4 }}>
              <div style={{ ...labelCellStyle, marginBottom: 4 }}>{tr({ zh: '合计', en: 'Total'
            })}</div>
              <div style={mobileLineStyle}>
                <span style={mobileTagStyle}>A</span>
                <span style={{ color: '#eee' }}>{totalHtmA !== null ? `${totalHtmA} htm` : '—'}</span>
                <span style={{ color: '#888' }}>· {tpsA !== null ? `${tpsA.toFixed(2)} tps` : '—'}</span>
              </div>
              <div style={mobileLineStyle}>
                <span style={mobileTagStyle}>B</span>
                <span style={{ color: '#eee' }}>{totalHtmB !== null ? `${totalHtmB} htm` : '—'}</span>
                <span style={{ color: '#888' }}>· {tpsB !== null ? `${tpsB.toFixed(2)} tps` : '—'}</span>
              </div>
              <div style={mobileLineStyle}>
                <span style={mobileTagStyle}>Δ</span>
                <span style={{ color: '#888' }}>{tr({ zh: '步数 ', en: 'htm '
                })}</span>
                {renderHtmDelta(totalHtmA, totalHtmB)}
                <span style={{ color: '#888' }}>· tps</span>
                {renderTpsDelta(tpsA, tpsB)}
              </div>
            </div>
          ) : (
            <div style={{ ...rowStyle, borderBottom: 'none', marginTop: 4 }}>
              <div style={colStyle}>
                <div style={labelCellStyle}>{tr({ zh: '合计', en: 'Total'
                })}</div>
                <div>{totalHtmA !== null ? `${totalHtmA} htm` : '—'}</div>
                <div style={subStyle}>
                  {tpsA !== null ? `${tpsA.toFixed(2)} tps` : '—'}
                </div>
              </div>
              <div style={colStyle}>
                <div style={labelCellStyle}>&nbsp;</div>
                <div>{totalHtmB !== null ? `${totalHtmB} htm` : '—'}</div>
                <div style={subStyle}>
                  {tpsB !== null ? `${tpsB.toFixed(2)} tps` : '—'}
                </div>
              </div>
              <div style={colStyle}>
                <div style={labelCellStyle}>{tr({ zh: '差异', en: 'Δ'
                })}</div>
                <div>{renderHtmDelta(totalHtmA, totalHtmB)}</div>
                <div style={subStyle}>tps {renderTpsDelta(tpsA, tpsB)}</div>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, fontSize: 11, color: '#666', margin: '0 0 12px',
          }}
        >
          <span>A</span>
          <ArrowRight size={12} />
          <span>B</span>
          <span style={{ marginLeft: 6 }}>
            {tr({ zh: '(绿色 = B 更快)', en: '(green = B faster)'
            })}
          </span>
        </div>

        <div className="modal-actions">
          <button className="modal-action-btn" ref={closeBtnRef} onClick={onClose}>
            {tr({ zh: '关闭', en: 'Close'
            })}
          </button>
        </div>
      </div>
    </div>
  );
}
