import { Alg } from 'cubing/alg';
import { CORNER_POSITION, LEFT, LEFT_SUNE, RIGHT, RIGHT_SUNE } from './content';

type Cue = { zh: string; en: string };
export type LblAlgMove = { notation: string; cue: Cue; index: number };
const cue = (zh: string, en: string): Cue => ({ zh, en });
const up = cue('上', 'Up');
const hook = cue('勾', 'Hook');
const down = cue('下', 'Down');
const back = cue('回', 'Back');
const doubleFlick = cue('连拨', 'Double flick');
const trigger = [up, hook, down, back];
const sune = [up, hook, down, hook, up, doubleFlick, down];
const singleMoves: Record<string, Cue> = {
  R: up, "L'": up, "R'": down, L: down,
  U: cue('左', 'Left'), "U'": cue('右', 'Right'),
  U2: doubleFlick, R2: cue('上上', 'Up twice'),
  F: cue('压', 'Lower'), "F'": cue('提', 'Lift'),
  f: cue('双压', 'Lower two'), "f'": cue('双提', 'Lift two'),
  y: cue('左转体', 'Rotate left'), "y'": cue('右转体', 'Rotate right'),
  d: cue('对齐', 'Match colors'), "d'": cue('对齐', 'Match colors'), d2: cue('对齐', 'Match colors'),
};

// Match complete taught sequences before individual moves. U/U′ mean 勾 or 回
// within a trigger; they must not receive those names globally.
const sequences = [
  { moves: RIGHT_SUNE.split(' '), cues: sune },
  { moves: LEFT_SUNE.split(' '), cues: sune },
  { moves: RIGHT.split(' '), cues: trigger },
  { moves: LEFT.split(' '), cues: trigger },
];

/** Presentation only: the player and practice checker retain the original alg. */
export function getLblAlgGroups(step: string, alg: string): LblAlgMove[][] {
  const moves = new Alg(alg).expand().toString().split(/\s+/).filter(Boolean);
  const makeGroup = (start: number, length: number, cues?: Cue[]) =>
    moves.slice(start, start + length).map((notation, offset) => ({
      notation, index: start + offset, cue: cues?.[offset] ?? singleMoves[notation] ?? cue(notation, notation),
    }));

  // The document brackets the L algorithm as 4 / 4 / 5 moves. It is not the
  // alternate R2 D2 algorithm, so do not borrow that version's mnemonic.
  if (step === 'corner-position') {
    const body = CORNER_POSITION.split(' ');
    const groups: LblAlgMove[][] = [];
    for (let start = 0; start < moves.length;) {
      if (body.every((move, offset) => moves[start + offset] === move)) {
        groups.push(makeGroup(start, 4), makeGroup(start + 4, 4, trigger), makeGroup(start + 8, 5));
        start += body.length;
      } else {
        const alignment = start === moves.length - 1;
        groups.push(makeGroup(start, 1, [alignment ? cue('顶层对齐', 'Align the top') : cue('眼放左', 'Headlights to the left')]));
        start++;
      }
    }
    return groups;
  }

  const groups: LblAlgMove[][] = [];
  for (let start = 0; start < moves.length;) {
    const sequence = sequences.find(item => item.moves.every((move, offset) => moves[start + offset] === move));
    const length = step === 'cross' && start >= 3
      ? Math.min(3, moves.length - start) : sequence?.moves.length ?? 1;
    const preparation = /^U(?:2|')?$/.test(moves[start])
      && ((['corners', 'yellow-face'].includes(step) && start === 0) || step === 'yellow-cross'
        || (step === 'middle' && start === 0 && /^d(?:2|')?$/.test(moves[1])));
    const wallPlacement = step === 'edge-position' && start === 0 && /^y(?:2|')?$/.test(moves[start]);
    const finalAlignment = step === 'edge-position' && start === moves.length - 1 && /^U(?:2|')?$/.test(moves[start]);
    groups.push(makeGroup(start, length, sequence?.cues
      ?? (wallPlacement ? [cue('转体调整', 'Reorient')]
        : finalAlignment ? [cue('顶层对齐', 'Align the top')]
          : preparation ? [cue('转顶层', 'Turn top')] : undefined)));
    start += length;
  }
  return groups;
}
