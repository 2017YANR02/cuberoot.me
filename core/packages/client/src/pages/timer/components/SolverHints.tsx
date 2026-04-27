/**
 * SolverHints — collapsible panel that shows optimal Cross (for all 6
 * orientations) and EOLine solutions for the current scramble. Computation is
 * deferred to a microtask via setTimeout so the first paint isn't blocked
 * (BFS can take 50–200ms depending on scramble difficulty).
 */

import { useEffect, useMemo, useState } from 'react';
import { solveCross, type CrossSolution } from '../solver/cross';
import { solveEOLine, type EOLineSolution } from '../solver/eoline';

interface Props {
  scramble: string;
  isZh: boolean;
}

interface Computed {
  cross: CrossSolution[];
  eoline: EOLineSolution;
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
        if (!cancelled) {
          setComputed({ cross, eoline });
          setComputing(false);
        }
      } catch {
        if (!cancelled) {
          setComputed({
            cross: [],
            eoline: { moves: '—', length: -1 },
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

  const labels = isZh ? ORIENT_LABEL_ZH : ORIENT_LABEL_EN;
  const title = isZh ? '解法提示' : 'Solver hints';

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
                return (
                  <div key={sol.orientation} style={rowStyle}>
                    <span style={isBest ? labelBestStyle : labelStyle}>
                      {isBest ? '★ ' : ''}
                      {isZh ? '十字' : 'Cross'} {labels[sol.orientation]}
                    </span>
                    <span style={isBest ? countBestStyle : countStyle}>
                      {sol.length < 0 ? '—' : `${sol.length}`}
                    </span>
                    <span style={isBest ? algBestStyle : algStyle}>{sol.moves}</span>
                  </div>
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
  );
}

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
  gap: 3,
};

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '110px 32px 1fr',
  gap: 8,
  alignItems: 'baseline',
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
