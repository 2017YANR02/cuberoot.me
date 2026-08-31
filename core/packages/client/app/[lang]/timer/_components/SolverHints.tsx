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
import { timerSmallPuzzleHintCopy, type TimerSmallHintEvent } from '@cuberoot/shared/timer';
import { TimerSmallPuzzleHints } from '@cuberoot/timer-ui';
import { cstimerSolveByKey } from '@/lib/cstimer-scramble';
import { sq1MoveCounts } from '@/lib/sq1-metrics';
import { solveMega, type MegaSolveResult } from '../_lib/solver/mega';
import StepSolve from './StepSolve';
import { tr } from '@/i18n/tr';

type SmallEvent = TimerSmallHintEvent;
type Sq1Event = 'sq1';
type MegaEvent = 'mega';

interface Props {
  scramble: string;
  isZh: boolean;
  /** Optional — when '222' / 'pyra' / 'skewb' / 'sq1' / 'mega', show that
   *  puzzle's hints instead of the 3x3 ones. Defaults to '333'. */
  event?: '333' | SmallEvent | Sq1Event | MegaEvent;
}

export default function SolverHints({ scramble, isZh, event = '333' }: Props) {
  if (event === 'sq1') return <Sq1Hints scramble={scramble} isZh={isZh} />;
  if (event === 'mega') return <MegaHints scramble={scramble} isZh={isZh} />;
  if (event !== '333') {
    return (
      <TimerSmallPuzzleHints
        event={event}
        labels={timerSmallPuzzleHintCopy(event, isZh ? 'zh-Hans' : 'en')}
        scramble={scramble}
      />
    );
  }
  // 3x3「分步解法」现常驻在解法提示面板里(StepSolve),不再走这里的内联弹窗。
  return <StepSolve scramble={scramble} isZh={isZh} />;
}

interface Sq1Props {
  scramble: string;
  isZh: boolean;
}

/** Square-1 的解走 worker 里的 cs0x7f sq12phase(和 /scramble/solver?event=sq1 同一个引擎)。
 *  站内原来那份 gsolver 移植分不出同层内的具体块,出的「解」只还原形状与分层 —— 判据见
 *  tests/sq1_solver_oracle.test.ts。 */
function Sq1Hints({ scramble, isZh }: Sq1Props) {
  void isZh;
  const [open, setOpen] = useState(false);
  const [computed, setComputed] = useState<{ solution: string; wca: number } | null>(null);
  const [computing, setComputing] = useState(false);
  const [failed, setFailed] = useState(false);

  const cacheKey = useMemo(() => scramble, [scramble]);

  useEffect(() => {
    if (!open) {
      setComputed(null);
      return;
    }
    setComputing(true);
    setComputed(null);
    setFailed(false);
    let cancelled = false;
    cstimerSolveByKey('sqrs', scramble).then(
      (solution) => {
        if (cancelled) return;
        setComputed({ solution, wca: sq1MoveCounts(solution).wca });
        setComputing(false);
      },
      () => {
        if (cancelled) return;
        setFailed(true);
        setComputing(false);
      },
    );
    return () => { cancelled = true; };
  }, [open, cacheKey, scramble]);

  const title = tr({ zh: 'Square-1 解法提示', en: 'Square-1 solver hints' });

  return (
    <div style={wrapperStyle}>
      <div className="solver-hints" style={hintsStyle}>
        <button
          type="button"
          className="solver-hint-btn"
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
            {failed && !computing && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>
                {tr({ zh: '未找到解', en: 'No solution found' })}
              </div>
            )}
            {computed && (
              <div style={rowStyle}>
                <span style={labelBestStyle}>{tr({ zh: '近最优 (12c4)', en: 'Near-optimal (12c4)' })}</span>
                <span style={countBestStyle}>{computed.wca}</span>
                <span style={algStyle}>
                  {computed.solution || tr({ zh: '已还原', en: 'already solved' })}
                </span>
              </div>
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

function MegaHints({ scramble }: MegaProps) {
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
          className="solver-hint-btn"
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
                    {tr({
                      zh: `${computed.total - computed.misplaced} / ${computed.total} 已就位`,
                      en: `${computed.total - computed.misplaced} / ${computed.total} in place`,
                    })}
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
