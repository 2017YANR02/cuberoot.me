import { expect, it } from 'vitest';
import { practiceCompletedMoves } from '../app/[lang]/tutorial/lbl/practice-next-move';

it('highlights completed moves and keeps progress through off-path turns', () => {
  const alg = "R U R' U'";
  expect(practiceCompletedMoves(alg, '')).toBe(0);
  expect(practiceCompletedMoves(alg, 'R U')).toBe(2);
  expect(practiceCompletedMoves(alg, 'R U F')).toBe(2);
  expect(practiceCompletedMoves(alg, "R U F F' R'")).toBe(3);
  expect(practiceCompletedMoves(alg, "R U U'")).toBe(1);
  expect(practiceCompletedMoves(alg, alg)).toBe(4);
});

it('accepts equivalent half turns and expanded groups', () => {
  expect(practiceCompletedMoves('R2 U', 'R R')).toBe(1);
  expect(practiceCompletedMoves('(R U)2', 'R U R')).toBe(3);
});
