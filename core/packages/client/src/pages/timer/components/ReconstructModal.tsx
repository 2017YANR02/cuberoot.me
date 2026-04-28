/**
 * ReconstructModal — display Bluetooth-recorded move stream for a solve.
 *
 * Shows the four headline metrics (HTM, QTM, first-move latency, longest
 * pause) in a 2x2 grid, then a scrollable list of every move with its
 * absolute time and gap from the previous move. BLD splits the move list
 * implicitly via `firstMoveLatencyMs` (rebased to memo end).
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link2, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import type { Solve, EventId } from '../types';
import { effectiveMs } from '../types';
import { formatMs } from '../stats';
import { sliceReconstruction, detectMemoPause } from '../reconstruct/slice';
import { computeStageAverages, computeStageSegments } from '../reconstruct/stage_segments';
import type { StageAverages } from '../reconstruct/stage_segments';
import { encodeReplayUrl } from '../share/encode';
import { nxnSizeForEvent } from '../cube';
import { memoize3bld } from '../solver/bld_helper';
import PlaybackPanel from './PlaybackPanel';
import './reconstruct.css';

interface Props {
  solve: Solve;
  isZh: boolean;
  onClose: () => void;
  /** Recent solves of the same event for personal-average comparison.
   *  When provided and contains at least 5 solves with stageSegments,
   *  per-stage cells render a ±% label vs the user's ao12 / ao100 stage
   *  averages. Excludes the current solve implicitly via id match. */
  history?: Solve[];
  /** Optional callback for the BLD auto-memo "Apply" button. When provided
   *  and the solve is a BLD-class event without a manually-set memoMs, the
   *  modal shows an inline hint with the auto-detected value plus a button
   *  that calls back with that ms value. Caller is responsible for writing
   *  the value into solve.bld.memoMs. When omitted, the hint is read-only. */
  onMemoApply?: (ms: number) => void;
}

const BLD_AUTO_DETECT_EVENTS = new Set<EventId>(['333bld', '444bld', '555bld', '333mbld']);
// Events that get a Speffz letter-pair memo panel. Currently 3BLD only —
// 4BLD/5BLD have wings/x-centers/+centers that the 3x3 helper can't handle.
const BLD_MEMO_EVENTS = new Set<EventId>(['333bld', '333ni']);

function formatSec(ms: number, digits = 2): string {
  return (ms / 1000).toFixed(digits) + 's';
}

/** True iff viewport ≤ 768px. Used to gate the mobile accordion behavior;
 *  desktop renders all sections expanded with no toggle. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

interface AccordionSectionProps {
  title: ReactNode;
  /** When true, this section is collapsible with a chevron header.
   *  When false, the title still renders but content is always shown. */
  collapsible: boolean;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
  children: ReactNode;
}

function AccordionSection({
  title, collapsible, expanded, onToggle, className, children,
}: AccordionSectionProps) {
  const cls = `reconstruct-section${className ? ' ' + className : ''}${collapsible ? ' reconstruct-section-collapsible' : ''}`;
  if (!collapsible) {
    return (
      <div className={cls}>
        <div className="reconstruct-section-title">{title}</div>
        {children}
      </div>
    );
  }
  return (
    <div className={cls}>
      <button
        type="button"
        className="reconstruct-section-header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {expanded
          ? <ChevronDown size={14} />
          : <ChevronRight size={14} />}
        <span className="reconstruct-section-title reconstruct-section-title-inline">
          {title}
        </span>
      </button>
      {expanded && children}
    </div>
  );
}

export default function ReconstructModal({ solve, isZh, onClose, history, onMemoApply }: Props) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const moves = solve.moves ?? [];
  const slices = useMemo(
    () => sliceReconstruction(moves, solve.timeMs, solve.bld?.memoMs),
    [moves, solve.timeMs, solve.bld?.memoMs],
  );
  const stageSegs = useMemo(
    () => computeStageSegments(solve.scramble, moves, solve.timeMs),
    [solve.scramble, moves, solve.timeMs],
  );

  // Personal stage averages computed from the caller-provided history.
  // We exclude the current solve so a fresh solve isn't compared against
  // itself. Both windows require at least 5 eligible samples to render
  // — below that the comparison would be too noisy to be useful.
  const stageAvgs = useMemo(() => {
    if (!history || history.length === 0) return null;
    const eligible = history.filter(s => s.id !== solve.id);
    const ao12 = computeStageAverages(eligible, 12);
    const ao100 = computeStageAverages(eligible, 100);
    if (ao12.sampleSize < 5) return null;
    return { ao12, ao100 };
  }, [history, solve.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { closeBtnRef.current?.focus(); }, []);

  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const [playbackExpanded, setPlaybackExpanded] = useState(false);
  // Mobile-only accordion state. On desktop these flags are ignored —
  // AccordionSection renders open when `collapsible=false`.
  const [stagesExpanded, setStagesExpanded] = useState(true);
  const [moveListExpanded, setMoveListExpanded] = useState(false);
  const playbackAvailable = moves.length > 0 && nxnSizeForEvent(solve.event) !== null;
  const canShare = moves.length > 0;
  const handleCopyShare = async () => {
    try {
      const url = encodeReplayUrl(solve);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('[reconstruct] copy share link failed:', err);
    }
  };

  const eff = effectiveMs(solve);
  const dt = new Date(solve.ts);
  const memoMs = solve.bld?.memoMs;

  // Auto-detect memo pause for BLD-class solves that haven't had a memoMs
  // set manually. The hint surfaces at the top of the modal; user can apply
  // (callback) or just read the value. Skipped entirely once memoMs exists.
  const autoMemoMs = useMemo<number | null>(() => {
    if (memoMs !== undefined && memoMs !== null) return null;
    if (!BLD_AUTO_DETECT_EVENTS.has(solve.event)) return null;
    if (moves.length < 2) return null;
    return detectMemoPause(moves, solve.timeMs);
  }, [memoMs, solve.event, moves, solve.timeMs]);

  // Speffz letter-pair memo (3BLD only). Computed defensively — invalid
  // scrambles (empty / non-3x3 tokens) just yield empty pairs and we hide the
  // panel. Event gate keeps the panel off for non-BLD solves entirely.
  const bldMemo = useMemo(() => {
    if (!BLD_MEMO_EVENTS.has(solve.event)) return null;
    if (!solve.scramble || !solve.scramble.trim()) return null;
    try {
      return memoize3bld(solve.scramble);
    } catch (err) {
      console.warn('[reconstruct] bld memo failed:', err);
      return null;
    }
  }, [solve.event, solve.scramble]);

  return (
    <div className="timer-modal-overlay reconstruct-overlay" onClick={onClose}>
      <div
        className="timer-modal reconstruct-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>
          {isZh ? '复盘' : 'Reconstruct'} · {formatMs(eff)}
          <span className="reconstruct-date"> · {dt.toLocaleString()}</span>
        </h2>

        {autoMemoMs !== null && (
          <div
            className="reconstruct-auto-memo-hint"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              margin: '6px 0',
              fontSize: '0.85em',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
            }}
          >
            <span>
              {isZh ? '自动检测记忆时长' : 'auto-detected memo'}: {(autoMemoMs / 1000).toFixed(2)}s
            </span>
            {onMemoApply && (
              <button
                type="button"
                onClick={() => onMemoApply(autoMemoMs)}
                style={{ padding: '2px 8px', fontSize: '0.9em' }}
              >
                {isZh ? '应用' : 'Apply'}
              </button>
            )}
          </div>
        )}

        {bldMemo && (
          <div
            className="reconstruct-bld-memo"
            style={{
              padding: '8px 10px',
              margin: '6px 0',
              fontSize: '0.85em',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>
                {isZh ? '盲拧记忆 (Speffz)' : 'BLD memo (Speffz)'}
              </span>
              <span style={{ opacity: 0.6, fontSize: '0.9em' }}>
                {isZh ? `缓冲块: 角 UFR / 棱 UF` : 'buffers: corner UFR / edge UF'}
                {bldMemo.parity ? (isZh ? ' · 奇偶' : ' · parity') : ''}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }}>
              <span style={{ opacity: 0.7 }}>{isZh ? '角块' : 'Corners'}:</span>
              <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                {bldMemo.cornerPairs || (isZh ? '(无)' : '(none)')}
              </span>
              <span style={{ opacity: 0.7 }}>{isZh ? '棱块' : 'Edges'}:</span>
              <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                {bldMemo.edgePairs || (isZh ? '(无)' : '(none)')}
              </span>
              {bldMemo.twistedCorners.length > 0 && (
                <>
                  <span style={{ opacity: 0.7 }}>{isZh ? '角扭' : 'Twisted'}:</span>
                  <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                    {bldMemo.twistedCorners.join(' ')}
                  </span>
                </>
              )}
              {bldMemo.flippedEdges.length > 0 && (
                <>
                  <span style={{ opacity: 0.7 }}>{isZh ? '棱翻' : 'Flipped'}:</span>
                  <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                    {bldMemo.flippedEdges.join(' ')}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {memoMs !== undefined && (
          <div className="reconstruct-bld-bar">
            <span className="reconstruct-bld-seg memo">
              {isZh ? '记忆' : 'Memo'} {formatMs(memoMs)}
            </span>
            <span className="reconstruct-bld-seg exec">
              {isZh ? '执行' : 'Execution'} {formatMs(slices.executionMs)}
            </span>
          </div>
        )}

        <div className="reconstruct-stats">
          <div className="reconstruct-stat">
            <div className="reconstruct-stat-num">{slices.htmCount}</div>
            <div className="reconstruct-stat-label">HTM</div>
            <div className="reconstruct-stat-sub">{slices.htps.toFixed(2)} {isZh ? '步/秒' : 'tps'}</div>
          </div>
          <div className="reconstruct-stat">
            <div className="reconstruct-stat-num">{slices.qtmCount}</div>
            <div className="reconstruct-stat-label">QTM</div>
            <div className="reconstruct-stat-sub">{slices.qtps.toFixed(2)} {isZh ? '步/秒' : 'tps'}</div>
          </div>
          <div className="reconstruct-stat">
            <div className="reconstruct-stat-num">{formatSec(slices.firstMoveLatencyMs)}</div>
            <div className="reconstruct-stat-label">{isZh ? '首动延迟' : 'First move'}</div>
            <div className="reconstruct-stat-sub">
              {memoMs !== undefined ? (isZh ? '记忆后' : 'after memo') : (isZh ? '从计时开始' : 'from start')}
            </div>
          </div>
          <div className="reconstruct-stat">
            <div className="reconstruct-stat-num">{formatSec(slices.longestPauseMs)}</div>
            <div className="reconstruct-stat-label">{isZh ? '最长停顿' : 'Longest pause'}</div>
            <div className="reconstruct-stat-sub">{slices.pauseCount} × &gt;0.5s</div>
          </div>
        </div>

        {stageSegs && memoMs === undefined && (
          <StageSegmentsPanel
            segs={stageSegs}
            totalMs={solve.timeMs}
            isZh={isZh}
            ao12={stageAvgs?.ao12 ?? null}
            ao100={stageAvgs?.ao100 ?? null}
            collapsible={isMobile}
            expanded={stagesExpanded}
            onToggle={() => setStagesExpanded(v => !v)}
          />
        )}

        {playbackAvailable && (
          <div className="reconstruct-section">
            <button
              type="button"
              className="reconstruct-playback-toggle"
              onClick={() => setPlaybackExpanded(v => !v)}
              aria-expanded={playbackExpanded}
            >
              {playbackExpanded
                ? <ChevronDown size={14} />
                : <ChevronRight size={14} />}
              <span>
                {playbackExpanded
                  ? (isZh ? '3D 回放' : '3D playback')
                  : (isZh ? '显示 3D 回放' : 'Show 3D playback')}
              </span>
            </button>
            {playbackExpanded && (
              <PlaybackPanel
                event={solve.event}
                scramble={solve.scramble}
                moves={moves}
                totalMs={solve.timeMs}
                isZh={isZh}
              />
            )}
          </div>
        )}

        <AccordionSection
          title={isZh ? `动作序列 (${moves.length})` : `Move stream (${moves.length})`}
          collapsible={isMobile}
          expanded={moveListExpanded}
          onToggle={() => setMoveListExpanded(v => !v)}
        >
          {moves.length === 0 ? (
            <div className="reconstruct-empty">
              {isZh ? '此次成绩未记录蓝牙动作。' : 'No bluetooth moves recorded for this solve.'}
            </div>
          ) : (
            <ol className="reconstruct-move-list">
              {moves.map((mv, i) => {
                const prev = i > 0 ? moves[i - 1].ts : null;
                const gap = prev !== null ? mv.ts - prev : null;
                const slow = gap !== null && gap > 500;
                return (
                  <li key={i} className={`reconstruct-move-row ${slow ? 'slow' : ''}`}>
                    <span className="reconstruct-move-idx">{i + 1}</span>
                    <span className="reconstruct-move-token">{mv.m}</span>
                    <span className="reconstruct-move-ts">t={formatSec(mv.ts)}</span>
                    <span className="reconstruct-move-gap">
                      {gap !== null ? `Δ=+${formatSec(gap)}` : '—'}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </AccordionSection>

        <div className="modal-actions">
          <button
            type="button"
            onClick={handleCopyShare}
            disabled={!canShare}
            title={!canShare
              ? (isZh ? '没有动作记录，无法分享回放' : 'No move log — share unavailable')
              : (isZh ? '复制分享链接' : 'Copy share link')}
          >
            <Link2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {copied
              ? (isZh ? '已复制' : 'Copied')
              : (isZh ? '复制分享链接' : 'Copy share link')}
          </button>
          <button ref={closeBtnRef} onClick={onClose}>
            {isZh ? '关闭' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface StagePanelProps {
  segs: NonNullable<ReturnType<typeof computeStageSegments>>;
  totalMs: number;
  isZh: boolean;
  /** Personal stage averages over the last 12 / 100 eligible solves.
   *  When non-null, each stage cell shows ±% vs avg below the time. */
  ao12: StageAverages | null;
  ao100: StageAverages | null;
  collapsible: boolean;
  expanded: boolean;
  onToggle: () => void;
}

type StageKey = 'cross' | 'f2l' | 'oll' | 'pll';

function pickAvg(avgs: StageAverages | null, key: StageKey): number | null {
  if (!avgs) return null;
  switch (key) {
    case 'cross': return avgs.crossMs;
    case 'f2l':   return avgs.f2lMs;
    case 'oll':   return avgs.ollMs;
    case 'pll':   return avgs.pllMs;
  }
}

function StageSegmentsPanel({
  segs, totalMs, isZh, ao12, ao100, collapsible, expanded, onToggle,
}: StagePanelProps) {
  const stages: Array<{
    key: StageKey;
    labelEn: string;
    labelZh: string;
    ms: number | null;
    htm: number | null;
    caseLabel: string | null;
  }> = [
    { key: 'cross', labelEn: 'Cross', labelZh: '十字', ms: segs.crossMs, htm: segs.crossHtm, caseLabel: segs.crossSide },
    { key: 'f2l',   labelEn: 'F2L',   labelZh: 'F2L',  ms: segs.f2lMs,   htm: segs.f2lHtm,   caseLabel: null },
    { key: 'oll',   labelEn: 'OLL',   labelZh: 'OLL',  ms: segs.ollMs,   htm: segs.ollHtm,   caseLabel: segs.ollCase },
    { key: 'pll',   labelEn: 'PLL',   labelZh: 'PLL',  ms: segs.pllMs,   htm: segs.pllHtm,   caseLabel: segs.pllCase },
  ];

  // Bar widths: proportional to per-stage ms over solve total. Stages that
  // weren't reached get 0 width — the unsolved tail (mid-OLL DNF, etc.) shows
  // as an empty grey "unfinished" remainder so widths still sum to 100%.
  const reachedTotal = stages.reduce((acc, s) => acc + (s.ms ?? 0), 0);
  const denom = totalMs > 0 ? totalMs : Math.max(1, reachedTotal);
  const unfinishedMs = Math.max(0, totalMs - reachedTotal);

  const formatStageTime = (ms: number | null): string =>
    ms === null ? '—' : `${(ms / 1000).toFixed(2)}s`;

  const formatStageTps = (ms: number | null, htm: number | null): string => {
    if (ms === null || htm === null || ms <= 0) return '—';
    return (htm / (ms / 1000)).toFixed(1);
  };

  return (
    <AccordionSection
      className="reconstruct-stages-section"
      title={
        <>
          <Layers size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {isZh ? 'CFOP 分阶段' : 'CFOP stage breakdown'}
        </>
      }
      collapsible={collapsible}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="reconstruct-stage-bar" role="img" aria-label={isZh ? '阶段时间分布' : 'stage time distribution'}>
        {stages.map(s => {
          const pct = denom > 0 ? ((s.ms ?? 0) / denom) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={s.key}
              className={`reconstruct-stage-seg stage-${s.key}`}
              style={{ width: `${pct}%` }}
              title={`${isZh ? s.labelZh : s.labelEn}: ${formatStageTime(s.ms)}`}
            />
          );
        })}
        {unfinishedMs > 0 && (
          <div
            className="reconstruct-stage-seg stage-unfinished"
            style={{ width: `${(unfinishedMs / denom) * 100}%` }}
            title={isZh ? '未完成' : 'unfinished'}
          />
        )}
      </div>

      <div className="reconstruct-stage-grid">
        {stages.map(s => {
          const ao12Avg = pickAvg(ao12, s.key);
          const ao100Avg = pickAvg(ao100, s.key);
          const renderDelta = (avg: number | null, windowLabel: string) => {
            if (s.ms === null || avg === null || avg <= 0) return null;
            const pct = ((s.ms - avg) / avg) * 100;
            const cls = pct < -1 ? 'faster' : pct > 1 ? 'slower' : 'neutral';
            const sign = pct > 0 ? '+' : '';
            return (
              <span className={`reconstruct-stage-delta ${cls}`}>
                {sign}{pct.toFixed(0)}% {isZh ? `vs ${windowLabel}` : `vs ${windowLabel}`}
              </span>
            );
          };
          return (
            <div key={s.key} className="reconstruct-stage-cell">
              <div className={`reconstruct-stage-dot stage-${s.key}`} />
              <div className="reconstruct-stage-label">{isZh ? s.labelZh : s.labelEn}</div>
              <div className="reconstruct-stage-time">{formatStageTime(s.ms)}</div>
              {s.caseLabel ? (
                <div className="reconstruct-stage-case">{s.caseLabel}</div>
              ) : null}
              <div className="reconstruct-stage-tps">
                {s.htm !== null ? `${s.htm} ${isZh ? '步' : 'htm'}` : '—'}
                {' · '}
                {formatStageTps(s.ms, s.htm)} {isZh ? '步/秒' : 'tps'}
              </div>
              {(ao12Avg !== null || ao100Avg !== null) && s.ms !== null && (
                <div className="reconstruct-stage-deltas">
                  {renderDelta(ao12Avg, 'ao12')}
                  {ao100 && ao100.sampleSize >= 12 && renderDelta(ao100Avg, 'ao100')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AccordionSection>
  );
}
