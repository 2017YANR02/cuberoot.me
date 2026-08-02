/**
 * ReconstructModal — a dialog with nothing in it but the report.
 *
 * The report itself lives in ReconstructReport, because 成绩详情 renders it
 * inline (2026-08-02: «查看复盘» used to be a second click, and a report nobody
 * clicks through to is a report nobody reads). What's left here is the shell,
 * for the two callers that have no solve page to sit inside:
 *
 *   ?replay= deep links — an ephemeral solve decoded from the URL, not in the
 *     store, with no penalty to change and no comment to write.
 *   1v1 history        — the opponent's solve, read-only.
 */

'use client';

import { useEffect, useId, useRef } from 'react';
import type { Solve } from '../_lib/types';
import ReconstructReport from './ReconstructReport';
import { tr } from '@/i18n/tr';

interface Props {
  solve: Solve;
  isZh: boolean;
  onClose: () => void;
  /** Recent solves of the same event for personal-average comparison. */
  history?: Solve[];
  /** Write back an auto-detected BLD memo split. */
  onMemoApply?: (ms: number) => void;
  /** Load this solve's scramble into the timer. Dismisses the dialog too —
   *  the timer it just loaded into is behind this overlay. */
  onUseScramble?: (scramble: string) => void;
  /** Record whether the reconstruction matched reality. */
  onReconFeedback?: (ok: boolean | undefined) => void;
}

export default function ReconstructModal({
  solve, isZh, onClose, history, onMemoApply, onUseScramble, onReconFeedback,
}: Props) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus lands in the dialog for the keyboard, but WITHOUT scrolling to it:
  // the close button is the last thing in a report that is now taller than the
  // modal, and a plain focus() scrolls the first screen straight out of view.
  useEffect(() => { closeBtnRef.current?.focus({ preventScroll: true }); }, []);

  return (
    <div className="timer-modal-overlay reconstruct-overlay" onClick={onClose}>
      <div
        className="timer-modal reconstruct-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{tr({ zh: '复盘', en: 'Reconstruct' })}</h2>

        <ReconstructReport
          solve={solve}
          isZh={isZh}
          history={history}
          onMemoApply={onMemoApply}
          onUseScramble={onUseScramble && ((s) => { onUseScramble(s); onClose(); })}
          onReconFeedback={onReconFeedback}
        />

        <div className="modal-actions">
          <button className="modal-action-btn" ref={closeBtnRef} onClick={onClose}>
            {tr({ zh: '关闭', en: 'Close' })}
          </button>
        </div>
      </div>
    </div>
  );
}
