import { expect, it } from 'vitest';
import { getLblAlgGroups, getLblPracticeSegments } from '../app/[lang]/tutorial/lbl/alg-cues';
import { CORNER_POSITION, LEFT, RIGHT, LEFT_SUNE, RIGHT_SUNE } from '../app/[lang]/tutorial/lbl/content';

it('labels only the five complete algorithms and joins consecutive unnamed moves', () => {
  const alg = `U d ${RIGHT} y U ${LEFT} U2 ${RIGHT_SUNE} y' ${LEFT_SUNE} U ${CORNER_POSITION} U' d'`;
  const segments = getLblPracticeSegments(getLblAlgGroups('middle', alg).flat());
  expect(segments.map(segment => segment.name?.zh ?? '')).toEqual([
    '', '右公式', '', '左公式', '', '右小鱼', '', '左小鱼', '', 'J公式', '',
  ]);
  expect(segments[0].moves.map(move => move.notation)).toEqual(['U', 'd']);
  expect(segments.at(-1)!.moves.map(move => move.notation)).toEqual(["U'", "d'"]);
  expect(segments.flatMap(segment => segment.moves).map(move => move.notation).join(' ')).toBe(alg);
});

it('combines the teaching subgroups into one J algorithm label', () => {
  const segments = getLblPracticeSegments(getLblAlgGroups('corner-position', `y ${CORNER_POSITION} U2`).flat());
  expect(segments.map(segment => segment.name?.zh ?? '')).toEqual(['', 'J公式', '']);
});
