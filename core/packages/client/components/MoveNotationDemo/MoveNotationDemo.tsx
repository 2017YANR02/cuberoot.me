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
}

/** One shared player per move family; selecting a row swaps the demonstrated move. */
export default function MoveNotationDemo({ puzzle, moves, variant = 'list' }: MoveNotationDemoProps) {
  const t = useT();
  const [selectedMove, setSelectedMove] = useState(moves[0]?.move ?? '');
  const [playRequest, setPlayRequest] = useState(0);
  const selected = moves.find(option => option.move === selectedMove) ?? moves[0];

  if (!selected) return null;

  return (
    <div className={`move-notation-demo alg-player-list-layout is-${variant}`}>
      <div className="move-notation-stage alg-player-list-player">
        <AlgPlayer
          alg={selected.move}
          puzzle={puzzle}
          set=""
          startSolved
          autoPlay={playRequest > 0}
          playRequest={playRequest}
          size={260}
        />
      </div>

      <div className="move-notation-options alg-player-list-options" aria-label={t('选择要演示的记号', 'Choose a move to demonstrate')}>
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
