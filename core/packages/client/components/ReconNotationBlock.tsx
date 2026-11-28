'use client';
import type { ComponentProps } from 'react';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { CopySuccessIcon } from './CopySuccessIcon';
import { ScramblePreview2D } from './ScramblePreview2D';
import SolutionView from './SolutionView';

export function ReconNotationBlock({ captionHeader, scramble, scrambleCubeOrder, displayScramble, optimalScrambleTag = '', solutionText, displayText, rawDisplayText, solve, playerRef, playback, openingOrientation, canToggle = false, crossLineIdx = -1, crossNormalized = false, onToggleCross, crossControl, canRemoveWaste = false, wasteRemoved = false, setWasteRemoved = () => {}, cancellationLines, expandedCancellationLine, onToggleCancellation }: {
  captionHeader: string; scramble: string; scrambleCubeOrder: number | null; displayScramble: string; optimalScrambleTag?: string;
  solutionText: string; displayText: string; rawDisplayText: string; solve: { solutionHtml?: string; event: string; pickupTime?: number | null; putdownTime?: number | null };
  playerRef?: ComponentProps<typeof SolutionView>['playerRef']; playback?: ComponentProps<typeof SolutionView>['playback'];
  openingOrientation?: ComponentProps<typeof SolutionView>['openingOrientation'];
  canToggle?: boolean; crossLineIdx?: number; crossNormalized?: boolean;
  onToggleCross?: () => void; crossControl?: ComponentProps<typeof SolutionView>['crossControl'];
  canRemoveWaste?: boolean; wasteRemoved?: boolean; setWasteRemoved?: (update: (value: boolean) => boolean) => void;
  cancellationLines?: ReadonlySet<number>; expandedCancellationLine?: number | null; onToggleCancellation?: (line: number) => void;
}) {
  const { copiedKey, copy: copyScramble } = useCopy();
  const scrambleCopied = copiedKey === scramble;
  const hasTiming = solve.pickupTime != null || solve.putdownTime != null;
  return <>
            {(captionHeader || hasTiming) && (
              <div className="detail-caption-header">
                {captionHeader && <span>{captionHeader}</span>}
                {hasTiming && <span className={`detail-caption-timing${captionHeader ? ' is-separated' : ''}`}>
                  {solve.pickupTime != null && <span title={tr({ zh: '起表到第一步', en: 'Timer start to first move' })}>{tr({ zh: '起表', en: 'Pickup' })} {solve.pickupTime.toFixed(3)}</span>}
                  {solve.putdownTime != null && <span title={tr({ zh: '最后一步到拍表', en: 'Last move to timer stop' })}>{tr({ zh: '拍表', en: 'Putdown' })} {solve.putdownTime.toFixed(3)}</span>}
                </span>}
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
              {scramble ? (
                <button type="button" className="recon-case-line-text recon-scramble-copy"
                  aria-label={`${tr({ zh: '复制打乱', en: 'Copy scramble' })} ${displayScramble}${optimalScrambleTag}`}
                  onClick={() => copyScramble(scramble, scramble)}>
                  {displayScramble}{optimalScrambleTag}
                  {scrambleCopied && <CopySuccessIcon className="recon-scramble-copy-check" />}
                </button>
              ) : <span className="recon-case-line-text">{tr({ zh: '暂无打乱', en: 'No scramble available' })}</span>}
              </span>
              <span className="sr-only" role="status">{scrambleCopied ? tr({ zh: '已复制', en: 'Copied' }) : ''}</span>
            </div>
            {solutionText && (
              <SolutionView
                cancellationLines={cancellationLines} expandedCancellationLine={expandedCancellationLine} onToggleCancellation={onToggleCancellation}
                autoWaste
                text={displayText}
                html={solve.solutionHtml}
                event={solve.event}
                scramble={scramble}
                sourceText={rawDisplayText}
                playerRef={playerRef}
                playback={playback}
                openingOrientation={openingOrientation}
                crossLineIdx={canToggle ? crossLineIdx : -1}
                crossNormalized={crossNormalized}
                onToggleCross={onToggleCross} crossControl={crossControl}
              />
            )}
  </>;
}
