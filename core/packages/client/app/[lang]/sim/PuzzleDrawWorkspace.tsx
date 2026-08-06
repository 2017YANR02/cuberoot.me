'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import NumberCommitInput from '@/components/NumberCommitInput';
import CubeDrawPanel from '@/components/puzzle-draw/CubeDrawPanel';
import FtoDrawPanel from '@/components/puzzle-draw/FtoDrawPanel';
import MegaminxDrawPanel from '@/components/puzzle-draw/MegaminxDrawPanel';
import PyraminxDrawPanel from '@/components/puzzle-draw/PyraminxDrawPanel';
import SkewbDrawPanel from '@/components/puzzle-draw/SkewbDrawPanel';
import Sq1DrawPanel from '@/components/puzzle-draw/Sq1DrawPanel';
import type { DrawExport } from '@/components/puzzle-draw/types';
import { useT } from '@/hooks/useT';
import { PuzzleTypeSelect, type SimPuzzle } from './PlayerControls';
import './puzzle-draw-workspace.css';

const DRAW_PUZZLES = ['nxn', 'sq1', 'megaminx', 'skewb', 'pyraminx', 'fto'] as const;
type DrawPuzzle = 'cube' | Exclude<(typeof DRAW_PUZZLES)[number], 'nxn'>;

function drawPuzzleOf(puzzle: SimPuzzle): DrawPuzzle | null {
  if (typeof puzzle === 'number') return 'cube';
  if (puzzle === 'sq1' || puzzle === 'megaminx' || puzzle === 'skewb'
    || puzzle === 'pyraminx' || puzzle === 'fto') return puzzle;
  return null;
}

export interface PuzzleDrawWorkspaceProps {
  active: boolean;
  puzzle: SimPuzzle;
  order: number;
  onPuzzleChange: (puzzle: SimPuzzle) => void;
  onOrderChange: (order: number) => void;
  onDocumentChange: (document: DrawExport | null) => void;
  exportPanel?: ReactNode;
}

/** `/sim` free-drawing surface. All puzzle panels stay mounted after first load. */
export default function PuzzleDrawWorkspace({
  active,
  puzzle,
  order,
  onPuzzleChange,
  onOrderChange,
  onDocumentChange,
  exportPanel,
}: PuzzleDrawWorkspaceProps) {
  const t = useT();
  const { i18n } = useTranslation();
  const selected = drawPuzzleOf(puzzle);
  const current: DrawPuzzle = selected ?? 'cube';
  const currentRef = useRef<DrawPuzzle>(current);
  currentRef.current = current;
  const documentsRef = useRef<Partial<Record<DrawPuzzle, DrawExport>>>({});

  // An unsupported simulator puzzle cannot produce a meaningful drawing. Only
  // normalize while this large view is actually open; the hidden mounted editor
  // must never change the user's simulator selection in the background.
  useEffect(() => {
    if (!active) return;
    if (!selected || (typeof puzzle === 'number' && (puzzle < 2 || puzzle > 20))) {
      onPuzzleChange(3);
    }
  }, [active, onPuzzleChange, puzzle, selected]);

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

  const handlePuzzleSelect = (value: string) => {
    if (value === 'nxn') onPuzzleChange(order >= 2 && order <= 20 ? order : 3);
    else if (value === 'sq1' || value === 'megaminx' || value === 'skewb'
      || value === 'pyraminx' || value === 'fto') onPuzzleChange(value);
  };

  return (
    <div className="sim-draw-workspace">
      <div className="sim-draw-toolbar">
        <PuzzleTypeSelect
          value={current === 'cube' ? 'nxn' : current}
          onChange={handlePuzzleSelect}
          isZh={i18n.language === 'zh'}
          allowedValues={DRAW_PUZZLES}
        />
        {current === 'cube' && (
          <label className="sim-draw-order">
            <span>{t('阶数', 'Order')}</span>
            <NumberCommitInput
              className="sim-draw-order-input"
              value={Math.max(2, Math.min(20, order))}
              min={2}
              max={20}
              onCommit={onOrderChange}
              aria-label={t('魔方阶数', 'Cube order')}
            />
          </label>
        )}
        <p>{t('先选颜色，再点贴纸上色。透明色可删除填色。',
          'Choose a colour, then tap stickers to paint. Use transparent to erase.')}</p>
      </div>

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
