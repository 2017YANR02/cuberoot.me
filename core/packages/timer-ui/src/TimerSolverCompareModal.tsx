'use client';

/**
 * SolverCompareModal — runs all 5 step-by-step methods (CFOP / Roux /
 * Petrus / ZZ / EODR) on the current scramble and lays them out side-by-side
 * with total move counts and per-stage breakdowns.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  METHOD_REGISTRY,
  solveByMethodId,
  timer333MethodLabel,
  timer333StageLabel,
  type MethodId,
  type SolveResult,
} from '@cuberoot/puzzle-solvers/timer-333-step';
import { TimerRoomDialog } from './TimerRoomDialog';
import './TimerStepSolve.css';


interface Props {
  scramble: string;
  isZh: boolean;
  onClose: () => void;
}

interface MethodOutcome {
  id: MethodId;
  result: SolveResult | null;
  ms: number | null;
  err?: string;
}

export default function TimerSolverCompareModal(props: Props) {
  return <SolverComparison key={props.scramble} {...props} />;
}
function SolverComparison({ scramble, isZh, onClose }: Props) {
  const tr = (text: { en: string; zh: string }) => text[isZh ? 'zh' : 'en'];
  const subscribe = useCallback((notify: () => void) => {
    const query = window.matchMedia('(max-width: 480px)');
    query.addEventListener('change', notify);
    return () => query.removeEventListener('change', notify);
  }, []);
  const isMobile = useSyncExternalStore(subscribe, () => window.matchMedia('(max-width: 480px)').matches, () => false);

  const [outcomes, setOutcomes] = useState<MethodOutcome[]>(() =>
    METHOD_REGISTRY.map(m => ({ id: m.id, result: null, ms: null })),
  );
  const [busy, setBusy] = useState(true);
  const [openId, setOpenId] = useState<MethodId | null>(null);

  useEffect(() => {
    let cancelled = false;
    let scheduled: ReturnType<typeof setTimeout>;
    const ids = METHOD_REGISTRY.map(m => m.id);
    let i = 0;
    function step() {
      if (cancelled) return;
      if (i >= ids.length) {
        setBusy(false);
        return;
      }
      const id = ids[i++];
      const t0 = performance.now();
      try {
        const r = solveByMethodId(scramble, id);
        const dt = performance.now() - t0;
        if (cancelled) return;
        setOutcomes(prev => prev.map(o =>
          o.id === id ? { ...o, result: r, ms: dt } : o,
        ));
      } catch (e) {
        if (cancelled) return;
        setOutcomes(prev => prev.map(o =>
          o.id === id ? { ...o, err: (e as Error).message ?? 'error' } : o,
        ));
      }
      scheduled = setTimeout(step, 0);
    }
    scheduled = setTimeout(step, 0);
    return () => { cancelled = true; clearTimeout(scheduled); };
  }, [scramble]);

  const bestTotal = useMemo(() => {
    let best = Infinity;
    for (const o of outcomes) {
      if (!o.result) continue;
      const failed = o.result.stages.some(s => s.failed);
      if (failed) continue;
      if (o.result.totalMoves < best) best = o.result.totalMoves;
    }
    return best === Infinity ? null : best;
  }, [outcomes]);

  return (
    <TimerRoomDialog className="timer-solver-compare" language={isZh ? 'zh' : 'en'} title={tr({ zh: '解法对比', en: 'Method comparison' })} onClose={onClose}>
        <div className="modal-section">
          <div style={scrambleStyle}>{scramble}</div>
        </div>

        {busy && (
          <div className="modal-section" style={{ opacity: 0.6, fontSize: 13 }}>
            {tr({ zh: '计算中… (首次运行需要构建剪枝表)', en: 'Computing… (first run builds prune tables)'
            })}
          </div>
        )}

        <div className="modal-section">
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outcomes.map(o => (
                <MethodAccordion
                  key={o.id}
                  outcome={o}
                  isZh={isZh}
                  bestTotal={bestTotal}
                  open={openId === o.id}
                  onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                />
              ))}
            </div>
          ) : (
            <div className="solver-compare-grid">
              {outcomes.map(o => (
                <MethodCard
                  key={o.id}
                  outcome={o}
                  isZh={isZh}
                  bestTotal={bestTotal}
                />
              ))}
            </div>
          )}
        </div>

    </TimerRoomDialog>
  );
}

interface CardProps {
  outcome: MethodOutcome;
  isZh: boolean;
  bestTotal: number | null;
}

function MethodCard({ outcome, isZh, bestTotal }: CardProps) {
  const tr = (text: { en: string; zh: string }) => text[isZh ? 'zh' : 'en'];
  const entry = METHOD_REGISTRY.find(m => m.id === outcome.id)!;
  const language = isZh ? 'zh' : 'en';
  const r = outcome.result;
  const failed = r ? r.stages.some(s => s.failed) : false;
  const isBest = r != null && !failed && bestTotal != null && r.totalMoves === bestTotal;
  return (
    <div style={isBest ? cardBestStyle : cardStyle}>
      <div style={cardHeadStyle}>
        <span style={isBest ? cardTitleBestStyle : cardTitleStyle}>
          {timer333MethodLabel(entry, language)}
        </span>
        <span style={cardTotalStyle}>
          {!r
            ? '…'
            : failed
              ? tr({ zh: '失败', en: 'failed'
                                      })
              : `${r.totalMoves} ${tr({ zh: '步', en: 'moves' })}`}
        </span>
      </div>
      {outcome.err && <div style={errStyle}>{outcome.err}</div>}
      {r && (
        <div style={stagesStyle}>
          {r.stages.map(s => (
            <div key={s.head} style={stageRowStyle}>
              <span style={stageLabelStyle}>{timer333StageLabel(outcome.id, s.head, language)}</span>
              <span style={stageCountStyle}>
                {s.failed ? '—' : s.moves.length}
              </span>
              <span style={stageMovesStyle}>
                {s.failed
                  ? tr({ zh: '未找到', en: 'no solution' })
                  : (s.moves.length === 0 ? tr({ zh: '(跳过)', en: '(skip)'
                                          }) : s.moves.join(' '))}
              </span>
            </div>
          ))}
        </div>
      )}
      {outcome.ms !== null && (
        <div style={timingStyle}>{outcome.ms.toFixed(0)} ms</div>
      )}
    </div>
  );
}

interface AccordionProps extends CardProps {
  open: boolean;
  onToggle: () => void;
}

function MethodAccordion({ outcome, isZh, bestTotal, open, onToggle }: AccordionProps) {
  const tr = (text: { en: string; zh: string }) => text[isZh ? 'zh' : 'en'];
  const entry = METHOD_REGISTRY.find(m => m.id === outcome.id)!;
  const language = isZh ? 'zh' : 'en';
  const r = outcome.result;
  const failed = r ? r.stages.some(s => s.failed) : false;
  const isBest = r != null && !failed && bestTotal != null && r.totalMoves === bestTotal;
  return (
    <div style={isBest ? cardBestStyle : cardStyle}>
      <button
        type="button"
        onClick={onToggle}
        style={accordionHeadStyle}
        aria-expanded={open}
      >
        <span style={isBest ? cardTitleBestStyle : cardTitleStyle}>
          {timer333MethodLabel(entry, language)}
        </span>
        <span style={cardTotalStyle}>
          {!r
            ? '…'
            : failed
              ? tr({ zh: '失败', en: 'failed'
                                      })
              : `${r.totalMoves} ${tr({ zh: '步', en: 'moves' })}`}
        </span>
        <span style={{ marginLeft: 6, opacity: 0.7 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          {outcome.err && <div style={errStyle}>{outcome.err}</div>}
          {r && (
            <div style={stagesStyle}>
              {r.stages.map(s => (
                <div key={s.head} style={stageRowStyle}>
                  <span style={stageLabelStyle}>{timer333StageLabel(outcome.id, s.head, language)}</span>
                  <span style={stageCountStyle}>
                    {s.failed ? '—' : s.moves.length}
                  </span>
                  <span style={stageMovesStyle}>
                    {s.failed
                      ? tr({ zh: '未找到', en: 'no solution' })
                      : (s.moves.length === 0 ? tr({ zh: '(跳过)', en: '(skip)'
                                                  }) : s.moves.join(' '))}
                  </span>
                </div>
              ))}
            </div>
          )}
          {outcome.ms !== null && <div style={timingStyle}>{outcome.ms.toFixed(0)} ms</div>}
        </>
      )}
    </div>
  );
}

const scrambleStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 12.5,
  opacity: 0.85,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  padding: '8px 10px',
  background: 'var(--card)',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const cardBestStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: 'var(--accent)',
};

const cardHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 6,
};

const accordionHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 6,
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  padding: 0,
  width: '100%',
  textAlign: 'left',
  fontSize: 13,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};

const cardTitleBestStyle: React.CSSProperties = {
  ...cardTitleStyle,
  color: 'var(--accent)',
};

const cardTotalStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontVariantNumeric: 'tabular-nums',
  opacity: 0.85,
};

const stagesStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  marginTop: 4,
};

const stageRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '70px 24px 1fr',
  gap: 6,
  alignItems: 'baseline',
  fontSize: 12,
};

const stageLabelStyle: React.CSSProperties = {
  opacity: 0.8,
};

const stageCountStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  opacity: 0.7,
};

const stageMovesStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 11.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const timingStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
  marginTop: 2,
};

const errStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--destructive)',
};
