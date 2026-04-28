/**
 * SolverCompareModal — runs all 5 step-by-step methods (CFOP / Roux /
 * Petrus / ZZ / EODR) on the current scramble and lays them out side-by-side
 * with total move counts and per-stage breakdowns. Useful for spotting
 * scrambles where a non-CFOP method would have been a few moves shorter.
 *
 * Computation is sequential per method (each method is itself parallel
 * across its targets). Each method may take 100-500ms on first run while
 * the gSolver builds its prune tables; subsequent runs are cached at the
 * GSolver layer (see methods.ts compiledCache).
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  METHOD_REGISTRY,
  solveByMethodId,
  type MethodId,
  type SolveResult,
} from '../solver/methods';

interface Props {
  scramble: string;
  isZh: boolean;
  onClose: () => void;
}

/** True iff viewport ≤ 480px. Drives accordion-style layout below. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 480px)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 480px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

interface MethodOutcome {
  id: MethodId;
  result: SolveResult | null;
  /** Wall-clock ms for this method's solve. */
  ms: number | null;
  err?: string;
}

export default function SolverCompareModal({ scramble, isZh, onClose }: Props) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const isMobile = useIsMobile();

  const [outcomes, setOutcomes] = useState<MethodOutcome[]>(() =>
    METHOD_REGISTRY.map(m => ({ id: m.id, result: null, ms: null })),
  );
  const [busy, setBusy] = useState(true);
  // On mobile, only one method panel is open at a time (accordion).
  const [openId, setOpenId] = useState<MethodId | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { closeBtnRef.current?.focus(); }, []);

  // Run all methods sequentially via setTimeout chain so each yields back to
  // the event loop (keeps the modal responsive — pruning tables can spike).
  useEffect(() => {
    let cancelled = false;
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
      setTimeout(step, 0);
    }
    setTimeout(step, 0);
    return () => { cancelled = true; };
  }, [scramble]);

  // Best (lowest) total — used to highlight the winner.
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
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={isMobile
          ? { maxWidth: '100%', width: '100%', maxHeight: '90dvh', padding: 14 }
          : { maxWidth: 760 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{isZh ? '解法对比' : 'Method comparison'}</h2>

        <div className="modal-section">
          <div style={scrambleStyle}>{scramble}</div>
        </div>

        {busy && (
          <div className="modal-section" style={{ opacity: 0.6, fontSize: 13 }}>
            {isZh ? '计算中… (首次运行需要构建剪枝表)' : 'Computing… (first run builds prune tables)'}
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
            <div style={gridStyle}>
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

        <div className="modal-actions">
          <button ref={closeBtnRef} className="primary" onClick={onClose}>
            {isZh ? '关闭' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  outcome: MethodOutcome;
  isZh: boolean;
  bestTotal: number | null;
}

function MethodCard({ outcome, isZh, bestTotal }: CardProps) {
  const entry = METHOD_REGISTRY.find(m => m.id === outcome.id)!;
  const r = outcome.result;
  const failed = r ? r.stages.some(s => s.failed) : false;
  const isBest = r != null && !failed && bestTotal != null && r.totalMoves === bestTotal;
  return (
    <div style={isBest ? cardBestStyle : cardStyle}>
      <div style={cardHeadStyle}>
        <span style={isBest ? cardTitleBestStyle : cardTitleStyle}>
          {isZh ? entry.nameZh : entry.nameEn}
        </span>
        <span style={cardTotalStyle}>
          {!r
            ? (isZh ? '…' : '…')
            : failed
              ? (isZh ? '失败' : 'failed')
              : `${r.totalMoves} ${isZh ? '步' : 'moves'}`}
        </span>
      </div>
      {outcome.err && (
        <div style={errStyle}>{outcome.err}</div>
      )}
      {r && (
        <div style={stagesStyle}>
          {r.stages.map(s => (
            <div key={s.head} style={stageRowStyle}>
              <span style={stageLabelStyle}>{s.head}</span>
              <span style={stageCountStyle}>
                {s.failed ? '—' : s.moves.length}
              </span>
              <span style={stageMovesStyle}>
                {s.failed
                  ? (isZh ? '未找到' : 'no solution')
                  : (s.moves.length === 0 ? (isZh ? '(跳过)' : '(skip)') : s.moves.join(' '))}
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
  const entry = METHOD_REGISTRY.find(m => m.id === outcome.id)!;
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
          {isZh ? entry.nameZh : entry.nameEn}
        </span>
        <span style={cardTotalStyle}>
          {!r
            ? (isZh ? '…' : '…')
            : failed
              ? (isZh ? '失败' : 'failed')
              : `${r.totalMoves} ${isZh ? '步' : 'moves'}`}
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
                  <span style={stageLabelStyle}>{s.head}</span>
                  <span style={stageCountStyle}>
                    {s.failed ? '—' : s.moves.length}
                  </span>
                  <span style={stageMovesStyle}>
                    {s.failed
                      ? (isZh ? '未找到' : 'no solution')
                      : (s.moves.length === 0 ? (isZh ? '(跳过)' : '(skip)') : s.moves.join(' '))}
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

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 8,
};

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border, #333)',
  borderRadius: 6,
  padding: '8px 10px',
  background: 'var(--panel-bg, rgba(255,255,255,0.03))',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const cardBestStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: 'var(--accent, #f5b400)',
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
  color: 'var(--accent, #f5b400)',
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
  color: '#e08080',
};
