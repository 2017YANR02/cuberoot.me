'use client';

import { useState, type ReactNode } from 'react';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import type { AlgPlayerPuzzle } from '@/components/AlgPlayer/player-setup';
import { useT } from '@/hooks/useT';
import { formatCubeMoveDescription, type AlgNotationStyle } from '@/lib/alg-notation-display';
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
  puzzle: AlgPlayerPuzzle;
  puzzleOrder?: number;
  moves: MoveNotationOption[];
  notationStyle?: AlgNotationStyle;
  transposeGroups?: boolean;
  layout?: 'groups' | 'square1-grid';
  variant?: 'list' | 'compact';
}

/** One shared player per move family; selecting a row swaps the demonstrated move. */
export default function MoveNotationDemo({ puzzle, puzzleOrder, moves, notationStyle, transposeGroups = false, layout = 'groups', variant = 'list' }: MoveNotationDemoProps) {
  const t = useT();
  const [selectedMove, setSelectedMove] = useState(moves[0]?.move ?? '');
  const [playRequest, setPlayRequest] = useState(0);
  const selected = moves.find(option => option.move === selectedMove) ?? moves[0];
  const hasAliases = moves.some(option => option.symbol != null);
  const moveGroups: MoveNotationOption[][] = [];
  for (const option of moves) {
    const group = notationMoveGroup(option.move);
    const previousGroup = moveGroups.at(-1);
    if (previousGroup && notationMoveGroup(previousGroup[0].move) === group) {
      previousGroup.push(option);
    } else {
      moveGroups.push([option]);
    }
  }
  const displayGroups = transposeGroups
    ? Array.from(
        { length: Math.max(0, ...moveGroups.map(group => group.length)) },
        (_, optionIndex) => moveGroups.flatMap(group => {
          const option = group[optionIndex];
          return option ? [option] : [];
        }),
      )
    : moveGroups;
  const square1Options = new Map(
    moves.flatMap(option => /^\((-?\d+),(-?\d+)\)$/.test(option.move) ? [[option.move, option] as const] : []),
  );
  const square1Values = Array.from(new Set(
    Array.from(square1Options.keys()).flatMap(move => {
      const match = /^\((-?\d+),(-?\d+)\)$/.exec(move);
      return match ? [Number(match[1]), Number(match[2])] : [];
    }),
  )).sort((a, b) => a - b);
  const square1Slash = moves.find(option => option.move === '/');

  const chooseMove = (move: string) => {
    setSelectedMove(move);
    setPlayRequest(request => request + 1);
  };

  const optionCaption = (option: MoveNotationOption) => option.caption ?? t(
    formatCubeMoveDescription(option.move, 'zh'),
    formatCubeMoveDescription(option.move, 'en'),
  );

  if (!selected) return null;

  return (
    <div className={`move-notation-demo alg-player-list-layout is-${variant} notation-${notationStyle ?? 'all'}`}>
      <div className="move-notation-stage alg-player-list-player">
        <AlgPlayer
          alg={selected.move}
          puzzle={puzzle}
          puzzleOrder={puzzleOrder}
          set=""
          startSolved
          autoPlay={playRequest > 0}
          playRequest={playRequest}
          controlMode="none"
          size={260}
        />
      </div>

      <div className="move-notation-options alg-player-list-options" aria-label={t('选择要演示的记号', 'Choose a move to demonstrate')}>
        {hasAliases && notationStyle == null && (
          <div className="move-notation-columns">
            <span>{t('英文', 'English')}</span>
            <span>{t('紧凑', 'Compact')}</span>
            <span>{t('傻瓜', 'Foolproof')}</span>
          </div>
        )}
        {layout === 'square1-grid' ? (
          <div className="move-notation-square1">
            {square1Slash && (
              <button
                type="button"
                className={`move-notation-option move-notation-square1-slash${selected.move === '/' ? ' is-active' : ''}`}
                aria-pressed={selected.move === '/'}
                onClick={() => chooseMove('/')}
              >
                <code>/</code>
                <span>{optionCaption(square1Slash)}</span>
              </button>
            )}
            <div className="move-notation-square1-wrap">
              <table className="move-notation-square1-grid" aria-label={t('Square-1 上下层转动坐标表', 'Square-1 top and bottom turn table')}>
                <thead>
                  <tr>
                    <th scope="col">{t('上＼下', 'Top ∖ bottom')}</th>
                    {square1Values.map(bottom => <th scope="col" key={bottom}>{bottom}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {square1Values.map(top => (
                    <tr key={top}>
                      <th scope="row">{top}</th>
                      {square1Values.map(bottom => {
                        const move = `(${top},${bottom})`;
                        const option = square1Options.get(move);
                        if (!option) return <td key={bottom} aria-label={t('无转动', 'No turn')}>—</td>;
                        const active = selected.move === move;
                        return (
                          <td key={bottom}>
                            <button
                              type="button"
                              className={`move-notation-square1-cell${active ? ' is-active' : ''}`}
                              aria-label={`${move}：${optionCaption(option)}`}
                              aria-pressed={active}
                              onClick={() => chooseMove(move)}
                            >
                              {move}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="move-notation-groups">
            {displayGroups.map((group, groupIndex) => (
            <div className="move-notation-group" key={`${groupIndex}-${group[0].move}`}>
              {group.map(option => {
                const active = option.move === selected.move;
                const caption = optionCaption(option);
                return (
                  <button
                    key={option.move}
                    type="button"
                    className={`move-notation-option${notationStyle == null && option.symbol != null ? ' has-alias' : ''}${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => chooseMove(option.move)}
                  >
                    {notationStyle === 'dumb' ? (
                      <span>{caption}</span>
                    ) : (
                      <>
                        <code>
                          <span className="move-notation-standard">
                            {notationStyle === 'zh-compact' ? (option.symbol ?? option.move) : option.move}
                          </span>
                          {notationStyle == null && option.symbol != null && (
                            <span className="move-notation-alias">{option.symbol}</span>
                          )}
                        </code>
                        {notationStyle == null && <span>{caption}</span>}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
