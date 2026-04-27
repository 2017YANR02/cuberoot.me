/**
 * ReconstructModal — display Bluetooth-recorded move stream for a solve.
 *
 * Shows the four headline metrics (HTM, QTM, first-move latency, longest
 * pause) in a 2x2 grid, then a scrollable list of every move with its
 * absolute time and gap from the previous move. BLD splits the move list
 * implicitly via `firstMoveLatencyMs` (rebased to memo end).
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import type { Solve } from '../types';
import { effectiveMs } from '../types';
import { formatMs } from '../stats';
import { sliceReconstruction } from '../reconstruct/slice';
import { encodeReplayUrl } from '../share/encode';
import './reconstruct.css';

interface Props {
  solve: Solve;
  isZh: boolean;
  onClose: () => void;
}

function formatSec(ms: number, digits = 2): string {
  return (ms / 1000).toFixed(digits) + 's';
}

export default function ReconstructModal({ solve, isZh, onClose }: Props) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const moves = solve.moves ?? [];
  const slices = useMemo(
    () => sliceReconstruction(moves, solve.timeMs, solve.bld?.memoMs),
    [moves, solve.timeMs, solve.bld?.memoMs],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { closeBtnRef.current?.focus(); }, []);

  const [copied, setCopied] = useState(false);
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

        <div className="reconstruct-section">
          <div className="reconstruct-section-title">
            {isZh ? `动作序列 (${moves.length})` : `Move stream (${moves.length})`}
          </div>
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
        </div>

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
