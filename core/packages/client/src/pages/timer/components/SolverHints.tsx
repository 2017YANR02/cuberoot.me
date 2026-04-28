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
import {
  solveByMethodId,
  METHOD_REGISTRY,
  type MethodId,
  type SolveResult,
} from '../solver/methods';
import { recognizeForOrientation, type CfopRecognition } from './cfop_recognize';
import SolverCompareModal from './SolverCompareModal';

const METHOD_LS_KEY = 'timer.solverHints.method';

function loadSavedMethod(): MethodId {
  try {
    const v = localStorage.getItem(METHOD_LS_KEY);
    if (v && METHOD_REGISTRY.some(m => m.id === v)) return v as MethodId;
  } catch {
    // ignore
  }
  return 'cfop';
}

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

  const [stepOpen, setStepOpen] = useState(false);
  const [methodId, setMethodId] = useState<MethodId>(loadSavedMethod);
  // Cache solutions per (scramble, method) so switching tabs doesn't recompute.
  const [stepResults, setStepResults] = useState<Record<MethodId, SolveResult | null>>(
    () => ({ cfop: null, roux: null, petrus: null, zz: null, eodr: null }),
  );
  const [stepComputing, setStepComputing] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // Persist method choice.
  useEffect(() => {
    try { localStorage.setItem(METHOD_LS_KEY, methodId); } catch { /* ignore */ }
  }, [methodId]);

  // Reset cached results whenever the scramble changes.
  useEffect(() => {
    setStepResults({ cfop: null, roux: null, petrus: null, zz: null, eodr: null });
  }, [scramble]);

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

  // Step-by-step — lazy: only compute the active method when the section is
  // open AND we don't already have a cached result for (scramble, method).
  useEffect(() => {
    if (!stepOpen) return;
    if (stepResults[methodId]) return;
    setStepComputing(true);
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        const r = solveByMethodId(scramble, methodId);
        if (!cancelled) {
          setStepResults(prev => ({ ...prev, [methodId]: r }));
          setStepComputing(false);
        }
      } catch {
        if (!cancelled) {
          setStepResults(prev => ({ ...prev, [methodId]: { stages: [], totalMoves: 0 } }));
          setStepComputing(false);
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [stepOpen, scramble, methodId, stepResults]);

  const stepResult = stepResults[methodId];

  const labels = isZh ? ORIENT_LABEL_ZH : ORIENT_LABEL_EN;
  const title = isZh ? '解法提示' : 'Solver hints';
  const stepTitle = isZh ? '分步解法' : 'Step-by-step';

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
          onClick={() => setStepOpen(o => !o)}
          style={toggleBtnStyle}
          aria-expanded={stepOpen}
        >
          <span>{stepTitle}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{stepOpen ? '▾' : '▸'}</span>
        </button>
        {stepOpen && (
          <div style={bodyStyle}>
            <div style={tabStripStyle}>
              {METHOD_REGISTRY.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethodId(m.id)}
                  style={methodId === m.id ? tabActiveStyle : tabStyle}
                >
                  {isZh ? m.nameZh : m.nameEn}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                style={compareBtnStyle}
              >
                {isZh ? '对比全部' : 'Compare all'}
              </button>
            </div>
            {stepComputing && !stepResult && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>
                {isZh ? '计算中…' : 'Computing…'}
              </div>
            )}
            {stepResult && (
              <>
                {stepResult.stages.map(s => (
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
                  <span style={countBestStyle}>{stepResult.totalMoves}</span>
                  <span style={algStyle} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {compareOpen && (
        <SolverCompareModal
          scramble={scramble}
          isZh={isZh}
          onClose={() => setCompareOpen(false)}
        />
      )}
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

const tabStripStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  alignItems: 'center',
  marginBottom: 4,
};

const tabStyle: React.CSSProperties = {
  padding: '3px 8px',
  background: 'transparent',
  border: '1px solid var(--border, #333)',
  borderRadius: 4,
  color: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  opacity: 0.75,
};

const tabActiveStyle: React.CSSProperties = {
  ...tabStyle,
  background: 'var(--accent, #f5b400)',
  color: '#111',
  borderColor: 'var(--accent, #f5b400)',
  fontWeight: 600,
  opacity: 1,
};

const compareBtnStyle: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '3px 8px',
  background: 'transparent',
  border: '1px dashed var(--border, #555)',
  borderRadius: 4,
  color: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  opacity: 0.85,
};
