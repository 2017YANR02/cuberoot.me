'use client';

import { useState } from 'react';
import { Check, Forward } from 'lucide-react';
import type { Solve } from '@cuberoot/shared/timer';
import type { ReconstructHost } from './ReconstructHost';

interface ReconstructActionsProps {
  host: ReconstructHost;
  solve: Solve;
  onUseScramble?: (scramble: string) => void;
  placement: 'report' | 'recap';
}

/** Share and retry actions shared by the inline recap and the full report. */
export default function ReconstructActions({
  host, solve, onUseScramble, placement,
}: ReconstructActionsProps) {
  const tr = host.localize;
  const [copied, setCopied] = useState(false);
  const canShare = (solve.moves?.length ?? 0) > 0;
  const shareLabel = !canShare
    ? tr({ zh: '没有动作记录，无法分享回放', en: 'No move log — share unavailable' })
    : copied
      ? tr({ zh: '链接已复制', en: 'Link copied' })
      : tr({ zh: '复制分享链接', en: 'Copy share link' });

  const handleCopyShare = async () => {
    try {
      await host.writeClipboardText(host.replayUrl(solve));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('[reconstruct] copy share link failed:', err);
    }
  };

  const shareClassName = placement === 'recap'
    ? 'shell-recap-btn shell-recap-btn--icon'
    : 'rc-action rc-action--ghost rc-action--icon';
  const useClassName = placement === 'recap'
    ? 'shell-recap-btn shell-recap-btn--primary'
    : 'rc-action';
  const actions = (
    <>
      <button
        type="button"
        className={shareClassName}
        onClick={handleCopyShare}
        disabled={!canShare}
        aria-label={shareLabel}
        title={shareLabel}
      >
        {copied ? <Check size={15} /> : <Forward size={15} />}
      </button>
      {onUseScramble && (solve.scramble ?? '').trim() !== '' && (
        <button
          type="button"
          className={useClassName}
          onClick={() => onUseScramble(solve.scramble)}
        >
          {tr({ zh: '用这条打乱', en: 'Use this scramble' })}
        </button>
      )}
    </>
  );

  return placement === 'report' ? <div className="rc-actions">{actions}</div> : actions;
}
