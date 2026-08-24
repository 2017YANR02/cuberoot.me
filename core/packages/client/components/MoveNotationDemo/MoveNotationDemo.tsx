'use client';

import { useState, type ReactNode } from 'react';
import type { AlgPuzzle } from '@cuberoot/shared';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { useT } from '@/hooks/useT';
import { formatCubeMoveDescription } from '@/lib/alg-notation-display';
import { notationMoveGroup } from '@/lib/move-notation-catalog';
import './move-notation-demo.css';

export interface MoveNotationOption {
  move: string;
  /** Optional localized alias shown beside the canonical move notation. */
  symbol?: ReactNode;
  /** Omit for cube notation to use the shared foolproof description. */
  caption?: ReactNode;
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
  const groupCounts = new Map<string, number>();
  for (const option of moves) {
    const group = notationMoveGroup(option.move);
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
  }

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
        {moves.map((option, index) => {
          const active = option.move === selected.move;
          const group = notationMoveGroup(option.move);
          const previousGroup = index > 0 ? notationMoveGroup(moves[index - 1].move) : group;
          const groupStart = index > 0 && group !== previousGroup && (groupCounts.get(group) ?? 0) > 1;
          const caption = option.caption ?? t(
            formatCubeMoveDescription(option.move, 'zh'),
            formatCubeMoveDescription(option.move, 'en'),
          );
          return (
            <button
              key={option.move}
              type="button"
              className={`move-notation-option${active ? ' is-active' : ''}${groupStart ? ' is-group-start' : ''}`}
              aria-pressed={active}
              onClick={() => {
                setSelectedMove(option.move);
                setPlayRequest(request => request + 1);
              }}
            >
              <code>
                <span className="move-notation-standard">{option.move}</span>
                {option.symbol != null && (
                  <span className="move-notation-alias">{option.symbol}</span>
                )}
              </code>
              <span>{caption}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
