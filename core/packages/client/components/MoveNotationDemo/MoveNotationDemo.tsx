'use client';

import { useState, type ReactNode } from 'react';
import type { AlgPuzzle } from '@cuberoot/shared';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { useT } from '@/hooks/useT';
import './move-notation-demo.css';

export interface MoveNotationOption {
  move: string;
  symbol?: ReactNode;
  caption: ReactNode;
}

export interface MoveNotationDemoProps {
  puzzle: AlgPuzzle;
  moves: MoveNotationOption[];
  variant?: 'list' | 'compact';
  showReplay?: boolean;
}

/** One shared player per move family; selecting a row swaps the demonstrated move. */
export default function MoveNotationDemo({ puzzle, moves, variant = 'list', showReplay = true }: MoveNotationDemoProps) {
  const t = useT();
  const [selectedMove, setSelectedMove] = useState(moves[0]?.move ?? '');
  const [playRequest, setPlayRequest] = useState(0);
  const selected = moves.find(option => option.move === selectedMove) ?? moves[0];

  if (!selected) return null;

  // /sim's in-house engine covers these teaching grammars. Megaminx's R++/D++
  // column turns use the compatible cubing renderer, just as the full simulator does.
  const engine = puzzle === 'megaminx' ? 'twisty' : 'sim';

  return (
    <div className={`move-notation-demo is-${variant}`}>
      <div className="move-notation-stage">
        <AlgPlayer
          alg={selected.move}
          puzzle={puzzle}
          set=""
          startSolved
          autoPlay
          playRequest={playRequest}
          controlMode={showReplay ? 'replay' : 'none'}
          engine={engine}
          size={260}
        />
      </div>

      <div className="move-notation-options" aria-label={t('选择要演示的记号', 'Choose a move to demonstrate')}>
        {moves.map(option => {
          const active = option.move === selected.move;
          return (
            <button
              key={option.move}
              type="button"
              className={`move-notation-option${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => {
                setSelectedMove(option.move);
                setPlayRequest(request => request + 1);
              }}
            >
              <code>{option.symbol ?? option.move}</code>
              <span>{option.caption}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
