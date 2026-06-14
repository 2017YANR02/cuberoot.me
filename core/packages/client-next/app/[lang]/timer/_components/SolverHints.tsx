'use client';

/**
 * SolverHints — collapsible panel that shows optimal Cross (for all 6
 * orientations), F2L pair status per orientation, and OLL/PLL recognition
 * (when applicable). Computation is deferred to a microtask via setTimeout
 * so the first paint isn't blocked (BFS can take 50-200ms depending on
 * scramble difficulty).
 *
 * When `event` is '222', 'pyra', or 'skewb' the panel switches to a much
 * simpler view: optimal full-solve length plus per-face / per-V solver
 * lengths.
 */

import { useEffect, useMemo, useState } from 'react';
import { Star, ChevronRight } from 'lucide-react';
import {
  solveByMethodId,
  METHOD_REGISTRY,
  type MethodId,
  type SolveResult,
} from '../_lib/solver/methods';
import { solve2x2, solve2x2Face } from '../_lib/solver/cube2x2';
import { solvePyra, solvePyraV } from '../_lib/solver/pyra';
import { solveSkewb, solveSkewbFace } from '../_lib/solver/skewb';
import { solveSq1, type Sq1Result } from '../_lib/solver/sq1';
import { solveMega, type MegaSolveResult } from '../_lib/solver/mega';
import SolverCompareModal from './SolverCompareModal';
import StageSolverModal from './StageSolverModal';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

type SmallEvent = '222' | 'pyra' | 'skewb';
type Sq1Event = 'sq1';
type MegaEvent = 'mega';

const METHOD_LS_KEY = 'timer.solverHints.method';

function loadSavedMethod(): MethodId {
  try {
    const v = localStorage.getItem(METHOD_LS_KEY);
    if (v && METHOD_REGISTRY.some(m => m.id === v)) return v as MethodId;
  } catch {
    /* ignore */
  }
  return 'cfop';
}

interface Props {
  scramble: string;
  isZh: boolean;
  /** Optional — when '222' / 'pyra' / 'skewb' / 'sq1' / 'mega', show that
   *  puzzle's hints instead of the 3x3 ones. Defaults to '333'. */
  event?: '333' | SmallEvent | Sq1Event | MegaEvent;
}

export default function SolverHints({ scramble, isZh, event = '333' }: Props) {
  if (event === 'sq1') {
    return <Sq1Hints scramble={scramble} isZh={isZh} />;
  }
  if (event === 'mega') {
    return <MegaHints scramble={scramble} isZh={isZh} />;
  }
  if (event !== '333') {
    return <SmallPuzzleHints scramble={scramble} isZh={isZh} event={event} />;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [stageOpen, setStageOpen] = useState(false);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [stepOpen, setStepOpen] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [methodId, setMethodId] = useState<MethodId>(loadSavedMethod);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [stepResults, setStepResults] = useState<Record<MethodId, SolveResult | null>>(
    () => ({ cfop: null, roux: null, petrus: null, zz: null, eodr: null, thistle: null }),
  );
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [stepComputing, setStepComputing] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [compareOpen, setCompareOpen] = useState(false);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    try { localStorage.setItem(METHOD_LS_KEY, methodId); } catch { /* ignore */ }
  }, [methodId]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setStepResults({ cfop: null, roux: null, petrus: null, zz: null, eodr: null, thistle: null });
  }, [scramble]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
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

  const title = tr({ zh: '解法提示', en: 'Solver hints' });
  const stepTitle = tr({ zh: '分步解法', en: 'Step-by-step' });

  return (
    <div style={wrapperStyle}>
      <div className="solver-hints" style={hintsStyle}>
        <button
          type="button"
          onClick={() => setStageOpen(true)}
          style={toggleBtnStyle}
        >
          <span>{title}</span>
          <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.7 }} />
        </button>
      </div>
      <div className="solver-hints" style={hintsStyle}>
        <button
          type="button"
          onClick={() => setStepOpen(o => !o)}
          style={toggleBtnStyle}
          aria-expanded={stepOpen}
        >
          <span>{stepTitle}</span>
          <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.7, transform: stepOpen ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} />
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
                  {(isZh ? m.nameZh : m.nameEn)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                style={compareBtnStyle}
              >
                {tr({ zh: '对比全部', en: 'Compare all'
                })}
              </button>
            </div>
            {stepComputing && !stepResult && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>
                {tr({ zh: '计算中…', en: 'Computing…'
                })}
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
                        ? (tr({ zh: '未找到', en: 'no solution' }))
                        : (s.moves.length === 0 ? (tr({ zh: '(跳过)', en: '(skip)'
                        })) : s.moves.join(' '))}
                    </span>
                  </div>
                ))}
                <div style={rowStyle}>
                  <span style={labelBestStyle}>{tr({ zh: '总计', en: 'Total'
                })}</span>
                  <span style={countBestStyle}>{stepResult.totalMoves}</span>
                  <span style={algStyle} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {stageOpen && (
        <StageSolverModal
          scramble={scramble}
          isZh={isZh}
          onClose={() => setStageOpen(false)}
        />
      )}
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

interface SmallProps {
  scramble: string;
  isZh: boolean;
  event: SmallEvent;
}

interface SmallComputed {
  full: { moves: string[]; length: number };
  faces: { face: string; moves: string[] }[];
}

const SMALL_TITLE_ZH: Record<SmallEvent, string> = {
  '222': '二阶解法提示',
  'pyra': '金字塔解法提示',
  'skewb': '斜转解法提示',
};
const SMALL_TITLE_EN: Record<SmallEvent, string> = {
  '222': '2x2 solver hints',
  'pyra': 'Pyraminx solver hints',
  'skewb': 'Skewb solver hints',
};

const FACE_SECTION_ZH: Record<SmallEvent, string> = {
  '222': '六个面',
  'pyra': '四个面 (V)',
  'skewb': '六个面',
};
const FACE_SECTION_EN: Record<SmallEvent, string> = {
  '222': 'Per-face',
  'pyra': 'Per-face V',
  'skewb': 'Per-face',
};

function SmallPuzzleHints({ scramble, isZh, event }: SmallProps) {
  const [open, setOpen] = useState(false);
  const [computed, setComputed] = useState<SmallComputed | null>(null);
  const [computing, setComputing] = useState(false);

  const cacheKey = useMemo(() => `${event}::${scramble}`, [event, scramble]);

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
        let full: { moves: string[]; length: number };
        let faces: { face: string; moves: string[] }[];
        if (event === '222') {
          full = solve2x2(scramble);
          faces = solve2x2Face(scramble);
        } else if (event === 'pyra') {
          full = solvePyra(scramble);
          faces = solvePyraV(scramble);
        } else {
          full = solveSkewb(scramble);
          faces = solveSkewbFace(scramble);
        }
        if (!cancelled) {
          setComputed({ full, faces });
          setComputing(false);
        }
      } catch {
        if (!cancelled) {
          setComputed({ full: { moves: [], length: -1 }, faces: [] });
          setComputing(false);
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, cacheKey, event, scramble]);

  const title = (isZh ? SMALL_TITLE_ZH[event] : SMALL_TITLE_EN[event]);
  const fullLabel = tr({ zh: '完整还原', en: 'Full solve'
});
  const sectionLabel = (isZh ? FACE_SECTION_ZH[event] : FACE_SECTION_EN[event]);

  const minFaceLen = useMemo(() => {
    if (!computed) return -1;
    let min = Infinity;
    for (const f of computed.faces) {
      if (f.moves.length > 0 && f.moves.length < min) min = f.moves.length;
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
          <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.7, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} />
        </button>
        {open && (
          <div style={bodyStyle}>
            {computing && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>
                {tr({ zh: '计算中…', en: 'Computing…'
                })}
              </div>
            )}
            {computed && (
              <>
                <div style={rowStyle}>
                  <span style={labelBestStyle}>
                    <Star size={12} style={{ verticalAlign: '-1px', marginRight: 3 }} />
                    {fullLabel}
                  </span>
                  <span style={countBestStyle}>
                    {computed.full.length < 0 ? '—' : `${computed.full.length}`}
                  </span>
                  <span style={algBestStyle}>{computed.full.moves.join(' ')}</span>
                </div>
                <div style={{ ...subLabelStyle, marginTop: 6 }}>{sectionLabel}</div>
                {computed.faces.map(f => {
                  const isBest = f.moves.length > 0 && f.moves.length === minFaceLen;
                  return (
                    <div key={f.face} style={rowStyle}>
                      <span style={isBest ? labelBestStyle : labelStyle}>
                        {isBest && <Star size={11} style={{ verticalAlign: '-1px', marginRight: 3 }} />}
                        {f.face}
                      </span>
                      <span style={isBest ? countBestStyle : countStyle}>
                        {f.moves.length === 0 ? '—' : f.moves.length}
                      </span>
                      <span style={isBest ? algBestStyle : algStyle}>
                        {f.moves.length === 0 ? (tr({ zh: '未找到', en: 'no solution' })) : f.moves.join(' ')}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface Sq1Props {
  scramble: string;
  isZh: boolean;
}

function Sq1Hints({ scramble, isZh }: Sq1Props) {
  const [open, setOpen] = useState(false);
  const [computed, setComputed] = useState<Sq1Result | null>(null);
  const [computing, setComputing] = useState(false);

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
        const r = solveSq1(scramble);
        if (!cancelled) {
          setComputed(r);
          setComputing(false);
        }
      } catch {
        if (!cancelled) {
          setComputed({ stages: [], totalMoves: 0 });
          setComputing(false);
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, cacheKey, scramble]);

  const title = tr({ zh: 'Square-1 解法提示', en: 'Square-1 solver hints' });
  const stageNameZh: Record<string, string> = {
    'Shape': '形状',
    'Permutation': '颜色还原',
  };

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
          <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.7, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} />
        </button>
        {open && (
          <div style={bodyStyle}>
            {computing && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>
                {tr({ zh: '计算中…', en: 'Computing…'
                })}
              </div>
            )}
            {computed && (
              <>
                {computed.stages.map(s => (
                  <div key={s.head} style={rowStyle}>
                    <span style={labelStyle}>
                      {isZh ? (stageNameZh[s.head] ?? s.head) : s.head}
                    </span>
                    <span style={countStyle}>
                      {s.failed ? '—' : s.moves.length}
                    </span>
                    <span style={algStyle}>
                      {s.failed
                        ? (tr({ zh: '未找到', en: 'no solution' }))
                        : s.moves.join(' ')}
                    </span>
                  </div>
                ))}
                <div style={rowStyle}>
                  <span style={labelBestStyle}>{tr({ zh: '总计 (token)', en: 'Total (tokens)'
                })}</span>
                  <span style={countBestStyle}>{computed.totalMoves}</span>
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

interface MegaProps {
  scramble: string;
  isZh: boolean;
}

function MegaHints({ scramble, isZh }: MegaProps) {
  const [open, setOpen] = useState(false);
  const [computed, setComputed] = useState<MegaSolveResult | null>(null);
  const [computing, setComputing] = useState(false);

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
        const r = solveMega(scramble);
        if (!cancelled) {
          setComputed(r);
          setComputing(false);
        }
      } catch {
        if (!cancelled) {
          setComputed({ solvedPercent: 0, misplaced: 132, total: 132 });
          setComputing(false);
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, cacheKey, scramble]);

  const title = tr({ zh: '五魔解法提示', en: 'Megaminx solver hints' });
  const stateLabel = tr({ zh: '当前状态', en: 'State'
});
  const misplacedLabel = tr({ zh: '错位贴纸', en: 'Misplaced stickers'
});
  const noteLabel = tr({ zh: '完整解法器尚未移植 (见 cstimer/src/js/solver/megaminx.js)', en: 'Full solver not yet ported (see cstimer/src/js/solver/megaminx.js)'
});

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
          <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.7, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} />
        </button>
        {open && (
          <div style={bodyStyle}>
            {computing && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>
                {tr({ zh: '计算中…', en: 'Computing…'
                })}
              </div>
            )}
            {computed && (
              <>
                <div style={rowStyle}>
                  <span style={labelBestStyle}>
                    <Star size={12} style={{ verticalAlign: '-1px', marginRight: 3 }} />
                    {stateLabel}
                  </span>
                  <span style={countBestStyle}>{computed.solvedPercent}%</span>
                  <span style={algStyle}>
                    {isZh
                      ? `${computed.total - computed.misplaced} / ${computed.total} 已就位`
                      : `${computed.total - computed.misplaced} / ${computed.total} in place`}
                  </span>
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>{misplacedLabel}</span>
                  <span style={countStyle}>{computed.misplaced}</span>
                  <span style={algStyle} />
                </div>
                <div style={{ ...subLabelStyle, fontSize: 11, marginTop: 4 }}>
                  {noteLabel}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'flex-start',
  gap: 8,
};

// Frameless: no border/background/radius — the open body lays out as a quiet
// list under a compact pill trigger (project rule: no decorative card framing).
const hintsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  minWidth: 0,
  fontSize: 13,
};

const toggleBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 12px',
  background: 'var(--shell-chip)',
  border: '1px solid var(--shell-divider)',
  borderRadius: 999,
  color: 'var(--muted-foreground)',
  cursor: 'pointer',
  fontSize: 13,
  width: 'auto',
  textAlign: 'left',
};

const bodyStyle: React.CSSProperties = {
  padding: '4px 10px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '110px 32px 1fr',
  gap: 8,
  alignItems: 'baseline',
};

const subLabelStyle: React.CSSProperties = {
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
  fontFamily: 'var(--font-mono)',
  fontSize: 12.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const labelBestStyle: React.CSSProperties = {
  ...labelStyle,
  opacity: 1,
  fontWeight: 600,
  color: 'var(--accent)',
};

const countBestStyle: React.CSSProperties = {
  ...countStyle,
  opacity: 1,
  fontWeight: 600,
  color: 'var(--accent)',
};

const algBestStyle: React.CSSProperties = {
  ...algStyle,
  fontWeight: 600,
  color: 'var(--accent)',
};

const tabStripStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  alignItems: 'center',
  marginBottom: 4,
};

const tabStyle: React.CSSProperties = {
  padding: '3px 10px',
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 999,
  color: 'var(--muted-foreground)',
  fontSize: 12,
  cursor: 'pointer',
};

const tabActiveStyle: React.CSSProperties = {
  ...tabStyle,
  background: 'var(--accent)',
  color: 'var(--accent-foreground)',
  borderColor: 'var(--accent)',
  fontWeight: 600,
};

const compareBtnStyle: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '3px 10px',
  background: 'transparent',
  border: '1px dashed var(--border-default)',
  borderRadius: 999,
  color: 'var(--muted-foreground)',
  fontSize: 12,
  cursor: 'pointer',
};
