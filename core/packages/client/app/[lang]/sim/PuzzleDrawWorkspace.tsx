'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import CubeDrawPanel from '@/components/puzzle-draw/CubeDrawPanel';
import FtoDrawPanel from '@/components/puzzle-draw/FtoDrawPanel';
import MegaminxDrawPanel from '@/components/puzzle-draw/MegaminxDrawPanel';
import PyraminxDrawPanel from '@/components/puzzle-draw/PyraminxDrawPanel';
import SkewbDrawPanel from '@/components/puzzle-draw/SkewbDrawPanel';
import Sq1DrawPanel from '@/components/puzzle-draw/Sq1DrawPanel';
import type { DrawExport } from '@/components/puzzle-draw/types';
import './puzzle-draw-workspace.css';

import type { DrawPuzzleSelection } from './puzzleOptions';
type DrawPuzzle = 'cube' | Exclude<DrawPuzzleSelection, number>;

export interface PuzzleDrawWorkspaceProps {
  active: boolean;
  puzzle: DrawPuzzleSelection;
  order: number;
  onDocumentChange: (document: DrawExport | null) => void;
  exportPanel?: ReactNode;
}

/** `/sim` free-drawing surface. All puzzle panels stay mounted after first load. */
export default function PuzzleDrawWorkspace({
  active,
  puzzle,
  order,
  onDocumentChange,
  exportPanel,
}: PuzzleDrawWorkspaceProps) {
  const current: DrawPuzzle = typeof puzzle === 'number' ? 'cube' : puzzle;
  const currentRef = useRef<DrawPuzzle>(current);
  currentRef.current = current;
  const documentsRef = useRef<Partial<Record<DrawPuzzle, DrawExport>>>({});

  useEffect(() => {
    if (!active) return;
    onDocumentChange(documentsRef.current[current] ?? null);
  }, [active, current, onDocumentChange]);

  const receiveDocument = useCallback((source: DrawPuzzle, document: DrawExport) => {
    documentsRef.current[source] = document;
    if (active && currentRef.current === source) onDocumentChange(document);
  }, [active, onDocumentChange]);
  const receiveCube = useCallback((doc: DrawExport) => receiveDocument('cube', doc), [receiveDocument]);
  const receiveSq1 = useCallback((doc: DrawExport) => receiveDocument('sq1', doc), [receiveDocument]);
  const receiveMegaminx = useCallback((doc: DrawExport) => receiveDocument('megaminx', doc), [receiveDocument]);
  const receiveSkewb = useCallback((doc: DrawExport) => receiveDocument('skewb', doc), [receiveDocument]);
  const receivePyraminx = useCallback((doc: DrawExport) => receiveDocument('pyraminx', doc), [receiveDocument]);
  const receiveFto = useCallback((doc: DrawExport) => receiveDocument('fto', doc), [receiveDocument]);

  return (
    <div className="sim-draw-workspace">
      <div className="sim-draw-panel" hidden={current !== 'cube'}>
        <CubeDrawPanel order={Math.max(2, Math.min(20, order))} onDocumentChange={receiveCube} />
      </div>
      <div className="sim-draw-panel" hidden={current !== 'sq1'}>
        <Sq1DrawPanel onDocumentChange={receiveSq1} />
      </div>
      <div className="sim-draw-panel" hidden={current !== 'megaminx'}>
        <MegaminxDrawPanel onDocumentChange={receiveMegaminx} />
      </div>
      <div className="sim-draw-panel" hidden={current !== 'skewb'}>
        <SkewbDrawPanel onDocumentChange={receiveSkewb} />
      </div>
      <div className="sim-draw-panel" hidden={current !== 'pyraminx'}>
        <PyraminxDrawPanel onDocumentChange={receivePyraminx} />
      </div>
      <div className="sim-draw-panel" hidden={current !== 'fto'}>
        <FtoDrawPanel onDocumentChange={receiveFto} />
      </div>

      {exportPanel && <div className="sim-draw-exports">{exportPanel}</div>}
    </div>
  );
}
