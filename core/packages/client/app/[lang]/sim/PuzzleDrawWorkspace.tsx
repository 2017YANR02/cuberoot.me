'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DrawPreviewHostContext } from '@/components/puzzle-draw/DrawCanvas';
import CubeDrawPanel from '@/components/puzzle-draw/CubeDrawPanel';
import FtoDrawPanel, { type FtoDrawPanelProps } from '@/components/puzzle-draw/FtoDrawPanel';
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
  fto?: Omit<FtoDrawPanelProps, 'onDocumentChange'>;
}

/** `/sim` free-drawing surface. All puzzle panels stay mounted after first load. */
export default function PuzzleDrawWorkspace({
  active,
  puzzle,
  order,
  onDocumentChange,
  exportPanel,
  fto,
}: PuzzleDrawWorkspaceProps) {
  const [previewHost, setPreviewHost] = useState<HTMLDivElement | null>(null);
  const current: DrawPuzzle = typeof puzzle === 'number' ? 'cube' : puzzle;
  const currentRef = useRef<DrawPuzzle>(current);
  currentRef.current = current;
  const documentsRef = useRef<Partial<Record<DrawPuzzle, DrawExport | null>>>({});

  useEffect(() => {
    if (!active) return;
    onDocumentChange(documentsRef.current[current] ?? null);
  }, [active, current, onDocumentChange]);

  const receiveDocument = useCallback((source: DrawPuzzle, document: DrawExport | null) => {
    documentsRef.current[source] = document;
    if (active && currentRef.current === source) onDocumentChange(document);
  }, [active, onDocumentChange]);
  const receiveCube = useCallback((doc: DrawExport) => receiveDocument('cube', doc), [receiveDocument]);
  const receiveSq1 = useCallback((doc: DrawExport) => receiveDocument('sq1', doc), [receiveDocument]);
  const receiveMegaminx = useCallback((doc: DrawExport) => receiveDocument('megaminx', doc), [receiveDocument]);
  const receiveSkewb = useCallback((doc: DrawExport) => receiveDocument('skewb', doc), [receiveDocument]);
  const receivePyraminx = useCallback((doc: DrawExport) => receiveDocument('pyraminx', doc), [receiveDocument]);
  const receiveFto = useCallback((doc: DrawExport | null) => receiveDocument('fto', doc), [receiveDocument]);

  const panels: { key: DrawPuzzle; content: ReactNode }[] = [
    { key: 'cube', content: <CubeDrawPanel order={Math.max(2, Math.min(20, order))} onDocumentChange={receiveCube} /> },
    { key: 'sq1', content: <Sq1DrawPanel onDocumentChange={receiveSq1} /> },
    { key: 'megaminx', content: <MegaminxDrawPanel onDocumentChange={receiveMegaminx} /> },
    { key: 'skewb', content: <SkewbDrawPanel onDocumentChange={receiveSkewb} /> },
    { key: 'pyraminx', content: <PyraminxDrawPanel onDocumentChange={receivePyraminx} /> },
    { key: 'fto', content: <FtoDrawPanel {...fto} onDocumentChange={receiveFto} /> },
  ];

  return (
    <div className="sim-body sim-draw-workspace">
      <div className="sim-stage sim-draw-stage" ref={setPreviewHost} />
      <aside className="sim-side sim-draw-side" data-site-surface="panel">
        {panels.map(({ key, content }) => (
          <DrawPreviewHostContext.Provider key={key} value={current === key ? previewHost : null}>
            <div className="sim-draw-panel" hidden={current !== key}>{content}</div>
          </DrawPreviewHostContext.Provider>
        ))}
        {exportPanel && <div className="sim-draw-exports">{exportPanel}</div>}
      </aside>
    </div>
  );
}
