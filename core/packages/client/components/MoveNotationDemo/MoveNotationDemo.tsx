'use client';

import { useState, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { AlgPuzzle } from '@cuberoot/shared';
import Link from '@/components/AppLink';
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

const SIM_PUZZLE: Record<AlgPuzzle, string> = {
  '2x2': '2',
  '3x3': '3',
  '4x4': '4',
  '5x5': '5',
  sq1: 'sq1',
  megaminx: 'megaminx',
  pyraminx: 'pyraminx',
  skewb: 'skewb',
};

function simHref(puzzle: AlgPuzzle, move: string): string {
  const renderer = puzzle === 'megaminx' ? '&renderer=cubing' : '';
  return `/sim?puzzle=${SIM_PUZZLE[puzzle]}&alg=${encodeURIComponent(move)}${renderer}`;
}

/** One shared player per move family; selecting a row swaps the demonstrated move. */
export default function MoveNotationDemo({ puzzle, moves, variant = 'list' }: MoveNotationDemoProps) {
  const t = useT();
  const [selectedMove, setSelectedMove] = useState(moves[0]?.move ?? '');
  const selected = moves.find(option => option.move === selectedMove) ?? moves[0];

  if (!selected) return null;

  // /sim's in-house engine covers these teaching grammars. Megaminx's R++/D++
  // column turns use the compatible cubing renderer, just as the full simulator does.
  const engine = puzzle === 'megaminx' ? 'twisty' : 'sim';

  return (
    <div className={`move-notation-demo is-${variant}`}>
      <div className="move-notation-stage">
        <div className="move-notation-current" aria-live="polite">
          <code>{selected.symbol ?? selected.move}</code>
          <span>{selected.caption}</span>
        </div>
        <AlgPlayer
          key={`${puzzle}:${selected.move}`}
          alg={selected.move}
          puzzle={puzzle}
          set=""
          startSolved
          autoPlay
          loop
          engine={engine}
          size={260}
        />
        <Link
          href={simHref(puzzle, selected.move)}
          prefetch={false}
          className="move-notation-open"
        >
          {t('在完整模拟器中打开', 'Open in the full simulator')}
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <div className="move-notation-options" aria-label={t('选择要演示的记号', 'Choose a move to demonstrate')}>
        {moves.map(option => {
          const active = option.move === selected.move;
          return (
            <button
              key={option.move}
              type="button"
              className={active ? 'is-active' : undefined}
              aria-pressed={active}
              onClick={() => setSelectedMove(option.move)}
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
