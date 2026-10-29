'use client';
import type { ComponentProps } from 'react';
import { Check, Copy } from 'lucide-react';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from './ScramblePreview2D';
import SolutionView from './SolutionView';

export function ReconNotationBlock({ captionHeader, scramble, scrambleCubeOrder, displayScramble, optimalScrambleTag = '', solutionText, displayText, rawDisplayText, solve, playerRef, canToggle, crossLineIdx, crossNormalized, setCrossNormalized, canRemoveWaste = false, wasteRemoved = false, setWasteRemoved = () => {} }: {
  captionHeader: string; scramble: string; scrambleCubeOrder: number | null; displayScramble: string; optimalScrambleTag?: string;
  solutionText: string; displayText: string; rawDisplayText: string; solve: { event: string };
  playerRef: ComponentProps<typeof SolutionView>['playerRef']; canToggle: boolean; crossLineIdx: number; crossNormalized: boolean;
  setCrossNormalized: (update: (value: boolean) => boolean) => void;
  canRemoveWaste?: boolean; wasteRemoved?: boolean; setWasteRemoved?: (update: (value: boolean) => boolean) => void;
}) {
  const { copied: scrambleCopied, copy: copyScramble } = useCopy();
  return <>
            {captionHeader && (
              <div className="detail-caption-header">{captionHeader}
            {canRemoveWaste && <button type="button" className={`recon-cross-toggle${wasteRemoved ? ' active' : ''}`}
              aria-pressed={wasteRemoved} onClick={() => setWasteRemoved(value => !value)}>
              {wasteRemoved ? tr({ zh: '恢复废步', en: 'Restore wasted moves' }) : tr({ zh: '消步', en: 'Remove wasted moves' })}
            </button>}
              </div>
            )}
            <div className="detail-scramble-line">
              <span className="recon-case-line">
              {scramble && scrambleCubeOrder && <span className="recon-case-diagram">
                <ScramblePreview2D event={String(scrambleCubeOrder).repeat(3)} scramble={scramble}
                  size={14} enlargeable />
              </span>}
              <span className="recon-case-line-text">
              {scramble ? <>{displayScramble}{optimalScrambleTag}</> : tr({ zh: '暂无打乱', en: 'No scramble available' })}
              {scramble && <> <button
                type="button"
                className="normalized-cross-copy"
                aria-label={scrambleCopied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制打乱', en: 'Copy scramble' })}
                title={scrambleCopied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制打乱', en: 'Copy scramble' })}
                onClick={() => copyScramble(scramble)}
              >
                {scrambleCopied ? <Check size={14} /> : <Copy size={14} />}
              </button></>}
              </span>
              </span>
            </div>
            {solutionText && (
              <SolutionView
                autoWaste
                text={displayText}
                event={solve.event}
                scramble={scramble}
                sourceText={rawDisplayText}
                playerRef={playerRef}
                crossLineIdx={canToggle ? crossLineIdx : -1}
                crossNormalized={crossNormalized}
                onToggleCross={() => setCrossNormalized(v => !v)}
              />
            )}
  </>;
}
