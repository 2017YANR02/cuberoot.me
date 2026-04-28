/**
 * SolverHints — collapsible panel that shows optimal Cross (for all 6
 * orientations), F2L pair status per orientation, and OLL/PLL recognition
 * (when applicable). Computation is deferred to a microtask via setTimeout
 * so the first paint isn't blocked (BFS can take 50-200ms depending on
 * scramble difficulty).
 */

import { useEffect, useMemo, useState } from 'react';
import { Star, CheckCircle2, Link2, Layers } from 'lucide-react';
import { solveCross, type CrossSolution, type Orientation } from '../solver/cross';
import { solveEOLine, type EOLineSolution } from '../solver/eoline';
import { solveCFOP, type SolveResult } from '../solver/methods';
import { recognizeForOrientation, type CfopRecognition } from './cfop_recognize';

interface Props {
  scramble: string;
  isZh: boolean;
}

interface Computed {
  cross: CrossSolution[];
  eoline: EOLineSolution;
  /** F2L / OLL / PLL recognition, keyed by orientation. */
  recog: Record<Orientation, CfopRecognition>;
}

const ORIENT_LABEL_ZH: Record<string, string> = {
  D: '白(D)',
  U: '黄(U)',
  F: '绿(F)',
  B: '蓝(B)',
  L: '橙(L)',
  R: '红(R)',
};

const ORIENT_LABEL_EN: Record<string, string> = {
  D: 'D (white)',
  U: 'U (yellow)',
  F: 'F (green)',
  B: 'B (blue)',
  L: 'L (orange)',
  R: 'R (red)',
};

export default function SolverHints({ scramble, isZh }: Props) {
  const [open, setOpen] = useState(false);
  const [computed, setComputed] = useState<Computed | null>(null);
  const [computing, setComputing] = useState(false);

  const [cfopOpen, setCfopOpen] = useState(false);
  const [cfopResult, setCfopResult] = useState<SolveResult | null>(null);
  const [cfopComputing, setCfopComputing] = useState(false);

  // Recompute whenever scramble changes AND the panel is open. We also reset
  // the cached value so an old result doesn't flash for a new scramble.
  const cacheKey = useMemo(() => scramble, [scramble]);

  useEffect(() => {
    if (!open) {
      setComputed(null);
      return;
    }
    setComputing(true);
    setComputed(null);
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        const cross = solveCross(scramble);
        const eoline = solveEOLine(scramble);
        const recog = {} as Record<Orientation, CfopRecognition>;
        for (const sol of cross) {
          recog[sol.orientation] = recognizeForOrientation(scramble, sol.orientation, sol.moves);
        }
        if (!cancelled) {
          setComputed({ cross, eoline, recog });
          setComputing(false);
        }
      } catch {
        if (!cancelled) {
          setComputed({
            cross: [],
            eoline: { moves: '—', length: -1 },
            recog: {} as Record<Orientation, CfopRecognition>,
          });
          setComputing(false);
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, cacheKey, scramble]);

  // CFOP step-by-step — lazy, independent of the main hints panel.
  useEffect(() => {
    if (!cfopOpen) {
      setCfopResult(null);
      return;
    }
    setCfopComputing(true);
    setCfopResult(null);
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        const r = solveCFOP(scramble);
        if (!cancelled) {
          setCfopResult(r);
          setCfopComputing(false);
        }
      } catch {
        if (!cancelled) {
          setCfopResult({ stages: [], totalMoves: 0 });
          setCfopComputing(false);
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [cfopOpen, scramble]);

  const labels = isZh ? ORIENT_LABEL_ZH : ORIENT_LABEL_EN;
  const title = isZh ? '解法提示' : 'Solver hints';
  const cfopTitle = isZh ? 'CFOP 分步' : 'CFOP step-by-step';

  // Min cross length across all 6 orientations (ignoring failed solves).
  const minCrossLen = useMemo(() => {
    if (!computed) return -1;
    let min = Infinity;
    for (const s of computed.cross) {
      if (s.length >= 0 && s.length < min) min = s.length;
    }
    return min === Infinity ? -1 : min;
  }, [computed]);

  return (
    <div style={wrapperStyle}>
      <div className="solver-hints" style={hintsStyle}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={toggleBtnStyle}
          aria-expanded={open}
        >
          <span>{title}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{open ? '▾' : '▸'}</span>
        </button>
        {open && (
          <div style={bodyStyle}>
            {computing && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>
                {isZh ? '计算中…' : 'Computing…'}
              </div>
            )}
            {computed && (
              <>
                {computed.cross.map(sol => {
                  const isBest = sol.length >= 0 && sol.length === minCrossLen;
                  const recog = computed.recog[sol.orientation];
                  return (
                    <CrossRow
                      key={sol.orientation}
                      sol={sol}
                      label={labels[sol.orientation]}
                      isBest={isBest}
                      recog={recog}
                      isZh={isZh}
                    />
                  );
                })}
                <div style={rowStyle}>
                  <span style={labelStyle}>EOLine</span>
                  <span style={countStyle}>
                    {computed.eoline.length < 0 ? '—' : `${computed.eoline.length}`}
                  </span>
                  <span style={algStyle}>{computed.eoline.moves}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <div className="solver-hints" style={hintsStyle}>
        <button
          type="button"
          onClick={() => setCfopOpen(o => !o)}
          style={toggleBtnStyle}
          aria-expanded={cfopOpen}
        >
          <span>{cfopTitle}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{cfopOpen ? '▾' : '▸'}</span>
        </button>
        {cfopOpen && (
          <div style={bodyStyle}>
            {cfopComputing && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>
                {isZh ? '计算中…' : 'Computing…'}
              </div>
            )}
            {cfopResult && (
              <>
                {cfopResult.stages.map(s => (
                  <div key={s.head} style={rowStyle}>
                    <span style={labelStyle}>{s.head}</span>
                    <span style={countStyle}>
                      {s.failed ? '—' : s.moves.length}
                    </span>
                    <span style={algStyle}>
                      {s.failed
                        ? (isZh ? '未找到' : 'no solution')
                        : (s.moves.length === 0 ? (isZh ? '(跳过)' : '(skip)') : s.moves.join(' '))}
                    </span>
                  </div>
                ))}
                <div style={rowStyle}>
                  <span style={labelBestStyle}>{isZh ? '总计' : 'Total'}</span>
                  <span style={countBestStyle}>{cfopResult.totalMoves}</span>
                  <span style={algStyle} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface CrossRowProps {
  sol: CrossSolution;
  label: string;
  isBest: boolean;
  recog: CfopRecognition | undefined;
  isZh: boolean;
}

function CrossRow({ sol, label, isBest, recog, isZh }: CrossRowProps) {
  const f2lText = recog && recog.crossOk
    ? `${recog.f2l.solved}/${recog.f2l.paired}/${recog.f2l.unpaired}`
    : '—';

  // OLL/PLL — only meaningful if F2L is already done in the scrambled state
  // (rare for normal WCA scrambles). Show only if non-trivial.
  const showStage = recog && recog.crossOk && recog.stage !== 'cross';
  const stageLabel = (() => {
    if (!showStage || !recog) return null;
    if (recog.stage === 'pll') return isZh ? '已完成' : 'Solved';
    if (recog.stage === 'oll') return recog.pllLabel ?? (isZh ? 'OLL 完成' : 'OLL done');
    if (recog.stage === 'f2l') return recog.ollLabel ?? (isZh ? 'F2L 完成' : 'F2L done');
    return null;
  })();

  return (
    <div style={crossBlockStyle}>
      <div style={rowStyle}>
        <span style={isBest ? labelBestStyle : labelStyle}>
          {isBest && <Star size={12} style={{ verticalAlign: '-1px', marginRight: 3 }} />}
          {isZh ? '十字' : 'Cross'} {label}
        </span>
        <span style={isBest ? countBestStyle : countStyle}>
          {sol.length < 0 ? '—' : `${sol.length}`}
        </span>
        <span style={isBest ? algBestStyle : algStyle}>{sol.moves}</span>
      </div>
      <div style={subRowStyle}>
        <span style={subLabelStyle}>
          <Link2 size={11} style={{ verticalAlign: '-1px', marginRight: 3, opacity: 0.7 }} />
          F2L
        </span>
        <span style={f2lTextStyle} title={isZh ? 'solved / paired / unpaired' : 'solved / paired / unpaired'}>
          {f2lText}
        </span>
        {showStage && stageLabel && (
          <span style={stageBadgeStyle}>
            {recog && recog.stage === 'pll' ? (
              <CheckCircle2 size={11} style={{ verticalAlign: '-1px', marginRight: 3 }} />
            ) : (
              <Layers size={11} style={{ verticalAlign: '-1px', marginRight: 3 }} />
            )}
            {stageLabel}
          </span>
        )}
      </div>
    </div>
  );
}

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const hintsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid var(--border, #333)',
  borderRadius: 6,
  background: 'var(--panel-bg, rgba(255,255,255,0.03))',
  fontSize: 13,
};

const toggleBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13,
  width: '100%',
  textAlign: 'left',
};

const bodyStyle: React.CSSProperties = {
  padding: '4px 10px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const crossBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
};

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '110px 32px 1fr',
  gap: 8,
  alignItems: 'baseline',
};

const subRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '110px 60px 1fr',
  gap: 8,
  alignItems: 'baseline',
  fontSize: 11.5,
  opacity: 0.75,
  paddingLeft: 14,
};

const subLabelStyle: React.CSSProperties = {
  opacity: 0.85,
};

const f2lTextStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
};

const stageBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.85,
};

const labelStyle: React.CSSProperties = {
  opacity: 0.85,
};

const countStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  opacity: 0.7,
};

const algStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 12.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const labelBestStyle: React.CSSProperties = {
  ...labelStyle,
  opacity: 1,
  fontWeight: 600,
  color: 'var(--accent, #f5b400)',
};

const countBestStyle: React.CSSProperties = {
  ...countStyle,
  opacity: 1,
  fontWeight: 600,
  color: 'var(--accent, #f5b400)',
};

const algBestStyle: React.CSSProperties = {
  ...algStyle,
  fontWeight: 600,
  color: 'var(--accent, #f5b400)',
};
