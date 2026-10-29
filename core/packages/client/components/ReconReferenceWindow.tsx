'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ResizeDivider } from '@app-foundation/navigation-ui/resize-divider';
import '@app-foundation/navigation-ui/resize-divider.css';
import AppLink from './AppLink';
import { ReconNotationBlock } from './ReconNotationBlock';
import { getRecon } from '@/lib/recon-api';
import { buildCaptionHeader } from '@/lib/recon-stats';
import { countMovesExpanded } from '@/lib/recon-alg-utils';
import { buildNormalizedSolution, findCrossLineIndex, hasNormalizableCrossMove } from '@/lib/recon-norm-cross-extract';
import { tr } from '@/i18n/tr';

export function ReconReferenceWindow({ source, onClose }: {
  source: { id: number; scramble: string; solution: string }; onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const playerRef = useRef(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const resizeEdge = (edge: string, requested: number) => {
    if (!panel.current) return;
    const rect = panel.current.getBoundingClientRect();
    const horizontal = edge === 'left' || edge === 'right';
    const backwards = edge === 'left' || edge === 'top';
    const end = horizontal ? rect.right : rect.bottom;
    const start = horizontal ? rect.left : rect.top;
    const available = backwards ? end - 8 : (horizontal ? innerWidth : innerHeight) - start - 8;
    const value = Math.max(Math.min(horizontal ? 240 : 140, available), Math.min(requested, available));
    setPosition({ left: horizontal && backwards ? end - value : rect.left, top: !horizontal && backwards ? end - value : rect.top });
    setSize({ width: horizontal ? value : rect.width, height: horizontal ? rect.height : value });
    return value;
  };
  const [solve, setSolve] = useState<Awaited<ReturnType<typeof getRecon>> | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [crossNormalized, setCrossNormalized] = useState(true);
  useEffect(() => {
    let active = true;
    setSolve(null); setError(false); setCrossNormalized(true);
    void getRecon(source.id).then(value => { if (active) setSolve(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [source.id, retry]);
  const canToggle = hasNormalizableCrossMove(source.solution);
  const text = crossNormalized && canToggle ? buildNormalizedSolution(source.solution) ?? source.solution : source.solution;
  const header = solve ? buildCaptionHeader(source.solution, solve.rawTime ?? 0, '333') : '';
  const tag = solve?.optimalScramble === source.scramble ? ` (${countMovesExpanded(source.scramble)}h*)` : '';
  return <aside ref={panel} className="recon-test-reference" data-no-timer data-site-surface="panel"
    style={{ ...(position ? { ...position, bottom: 'auto' } : {}), ...(size ? { ...size, maxHeight: 'calc(100dvh - 16px)' } : {}) }}
    aria-label={tr({ zh: '复盘参考', en: 'Reconstruction reference' })}>
    <div className="recon-test-reference-content">
    <div className="recon-test-heading recon-test-reference-drag"
      onPointerDown={event => {
        if (event.button !== 0 || (event.target as Element).closest('button,a')) return;
        const rect = panel.current!.getBoundingClientRect();
        drag.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!drag.current || !panel.current) return;
        const rect = panel.current.getBoundingClientRect();
        setPosition({ left: Math.max(8, Math.min(innerWidth - rect.width - 8, event.clientX - drag.current.x)),
          top: Math.max(8, Math.min(innerHeight - rect.height - 8, event.clientY - drag.current.y)) });
      }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <AppLink href={`/recon/${source.id}`} target="_blank" rel="noopener noreferrer" prefetch={false}>#{source.id}</AppLink>
      <button type="button" className="recon-test-reference-close" onClick={onClose}
        aria-label={tr({ zh: '关闭复盘参考', en: 'Close reconstruction reference' })}><X size={16} aria-hidden="true" /></button>
    </div>
    {error && <button type="button" className="recon-test-control" onClick={() => setRetry(value => value + 1)}>
      {tr({ zh: '加载详情失败，重试', en: 'Details failed to load. Retry' })}</button>}
    <div className="detail-scramble-solution">
      <ReconNotationBlock captionHeader={header} scramble={source.scramble} scrambleCubeOrder={3}
        displayScramble={source.scramble} optimalScrambleTag={tag} solutionText={source.solution}
        displayText={text} rawDisplayText={text} solve={{ event: '333' }} playerRef={playerRef}
        canToggle={canToggle} crossLineIdx={findCrossLineIndex(text)} crossNormalized={crossNormalized} setCrossNormalized={setCrossNormalized} />
    </div>
    </div>
    {(['left', 'right', 'top', 'bottom'] as const).map(edge => <ResizeDivider key={edge}
      className={`recon-test-reference-resize recon-test-reference-resize--${edge}`}
      label={tr({ zh: '调整复盘窗口大小', en: 'Resize reconstruction window' })}
      orientation={edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal'}
      direction={edge === 'left' || edge === 'top' ? -1 : 1}
      getSize={() => { const rect = panel.current!.getBoundingClientRect(); return edge === 'left' || edge === 'right' ? rect.width : rect.height; }}
      onResize={(_, requested) => resizeEdge(edge, requested)} />)}
  </aside>;
}
