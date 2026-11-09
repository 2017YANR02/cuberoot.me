import { expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { MIDDLE_RIGHT } from '../app/[lang]/tutorial/lbl/content';
import { practiceNextMove, practiceCompletedMoves, practiceRecoveryMoves, practiceAlgFinished, practiceGoalAllowsCompletion } from '../app/[lang]/tutorial/lbl/practice-next-move';
import { practiceState, practiceTargetStates } from '../app/[lang]/tutorial/lbl/practice-state';

it('requires the final teaching move even if the piece goal is reached earlier', () => {
  const moves = MIDDLE_RIGHT.split(' ');
  expect(practiceAlgFinished(MIDDLE_RIGHT, moves.slice(0, -1).join(' '))).toBe(false);
  expect(practiceAlgFinished(MIDDLE_RIGHT, MIDDLE_RIGHT)).toBe(true);
  expect(practiceAlgFinished(MIDDLE_RIGHT, `${MIDDLE_RIGHT} F`)).toBe(false);
  expect(practiceAlgFinished(MIDDLE_RIGHT, `${MIDDLE_RIGHT} y`)).toBe(true);
});

it('allows off-path goals while preserving the final on-path teaching move', () => {
  const prefix = MIDDLE_RIGHT.split(' ').slice(0, -1).join(' ');
  expect(practiceGoalAllowsCompletion(MIDDLE_RIGHT, prefix)).toBe(false);
  expect(practiceGoalAllowsCompletion(MIDDLE_RIGHT, MIDDLE_RIGHT)).toBe(true);
  // Top-layer adjustments preserve the inserted middle edge and the lower layers.
  const alternative = `${MIDDLE_RIGHT} U2`;
  expect(practiceAlgFinished(MIDDLE_RIGHT, alternative)).toBe(false);
  expect(practiceGoalAllowsCompletion(MIDDLE_RIGHT, alternative)).toBe(true);
  // Exceeding the recovery limit must not veto a subsequently achieved goal.
  const errors = 'F D R B L U F D R B L U';
  expect(practiceRecoveryMoves(MIDDLE_RIGHT, `${MIDDLE_RIGHT} ${errors}`).length).toBeGreaterThanOrEqual(10);
  const longAlternative = `${MIDDLE_RIGHT} ${errors} ${new Alg(errors).invert()} U2`;
  expect(practiceGoalAllowsCompletion(MIDDLE_RIGHT, longAlternative)).toBe(true);
});

it('pops incorrect turns in reverse order and resumes the original alg', () => {
  const alg = "R U R' U'";
  expect(practiceRecoveryMoves(alg, 'R F D')).toEqual(["D'", "F'"]);
  expect(practiceRecoveryMoves(alg, "R F D D'")).toEqual(["F'"]);
  expect(practiceNextMove(alg, "R F D D'")).toBe("F'");
  expect(practiceRecoveryMoves(alg, "R F D D' F'")).toEqual([]);
  expect(practiceNextMove(alg, "R F D D' F'")).toBe('U');
  expect(practiceRecoveryMoves('R2 U', 'R')).toEqual([]);
  expect(practiceNextMove('R2 U', 'R')).toBe('R');
});

it('still accepts explicit rotations, without requiring them as the next action', () => {
  const moves = MIDDLE_RIGHT.split(' ');
  for (let i = 0; i <= moves.length; i++) {
    if (/^[xyz]/.test(moves[i] ?? '')) {
      expect(practiceNextMove(MIDDLE_RIGHT, moves.slice(0, i).join(' '))).not.toMatch(/^[xyz]/);
    } else expect(practiceNextMove(MIDDLE_RIGHT, moves.slice(0, i).join(' '))).toBe(moves[i]);
  }
});

it('finishes insertion and x/y/z examples using layer turns only', () => {
  const colors = Array.from({ length: 54 }, (_, i) => String(i));
  for (const alg of [MIDDLE_RIGHT, "x R U x' F", "y R U y' L", "z U R z' D", "y2 R2 U", "x' F U"]) {
    const history: string[] = [];
    for (let i = 0; i < 40; i++) {
      const move = practiceNextMove(alg, history.join(' '));
      if (!move) break;
      expect(move).not.toMatch(/^[xyz]/);
      history.push(move);
    }
    expect(practiceNextMove(alg, history.join(' '))).toBeUndefined();
    expect(practiceTargetStates(colors, alg).has(practiceState(colors, history.join(' ')))).toBe(true);
  }
});

it('confirms a skipped rotation only after the following turn', () => {
  expect(practiceCompletedMoves('R y U', 'R')).toBe(1);
  expect(practiceNextMove('R y U', 'R')).toBe('U');
  expect(practiceCompletedMoves('R y U', 'R U')).toBe(3);
});

it('matches equivalent states and recovers an off-path turn without resetting', () => {
  expect(practiceNextMove(MIDDLE_RIGHT, "R R' U")).toBe('R');
  expect(practiceNextMove(MIDDLE_RIGHT, 'U F')).toBe("F'");
  expect(practiceNextMove(MIDDLE_RIGHT, "U F F'")).toBe('R');
  expect(practiceNextMove(MIDDLE_RIGHT, 'U R2')).toBe("R2'");
});
