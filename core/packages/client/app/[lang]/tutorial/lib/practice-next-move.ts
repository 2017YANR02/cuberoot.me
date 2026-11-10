import { Alg, Move } from 'cubing/alg';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import { practiceState } from './practice-state';

const identities = Array.from({ length: 54 }, (_, i) => String(i));
const tokens = (alg: string) => new Alg(alg).expand().toString().split(/\s+/).filter(Boolean);
const rotation = (move: string) => /^[xyz](?:2|')?$/.test(move);

/** Compare physical pieces in a center-aligned frame, independently of camera orbit. */
function stateKey(alg: string): string {
  const state = (JSON.parse(practiceState(identities, alg)) as string[][]).flat();
  for (const { value } of CUBE_ORIENTATIONS) {
    const aligned = practiceState(state, value);
    const stickers = (JSON.parse(aligned) as string[][]).flat();
    if ([4, 13, 22, 31, 40, 49].every(i => stickers[i] === identities[i])) return aligned;
  }
  throw new Error('Practice centers could not be aligned');
}

const plans = new Map<string, { expected: string[]; milestones: Map<string, number> }>();
function planFor(alg: string) {
  const cached = plans.get(alg);
  if (cached) return cached;
  const expected = tokens(alg);
  const milestones = new Map([[stateKey(''), 0]]);
  for (let i = 0; i < expected.length; i++) {
    // Orbiting never completes a rotation token; the following layer turn confirms it.
    if (!rotation(expected[i])) milestones.set(stateKey(expected.slice(0, i + 1).join(' ')), i + 1);
  }
  // A trailing camera-only reorientation must not leave the finished subtitle incomplete.
  milestones.set(stateKey(alg), expected.length);
  const plan = { expected, milestones };
  if (plans.size >= 64) plans.delete(plans.keys().next().value!);
  plans.set(alg, plan);
  return plan;
}

/** The current physical state, rather than a previously reached prefix, must finish the lesson alg. */
export function practiceAlgFinished(alg: string, history: string): boolean {
  return stateKey(history) === stateKey(alg);
}

/** Called only after the exercise goal passes: preserve teaching suffixes on-path,
 * but accept another solution instead of asking the learner to undo a solved goal. */
export function practiceGoalAllowsCompletion(alg: string, history: string): boolean {
  return practiceAlgFinished(alg, history) || practiceRecoveryMoves(alg, history).length > 0;
}

/** Off-path turns keep the last matched prefix; undoing them resumes tracking. */
export function practiceCompletedMoves(alg: string, history: string): number {
  const { milestones } = planFor(alg);
  const actual = tokens(history);
  for (let i = actual.length; i >= 0; i--) {
    const position = milestones.get(stateKey(actual.slice(0, i).join(' ')));
    if (position !== undefined) return position;
  }
  return 0;
}

/** Pending inverses, newest first. Cancelling an error pops it instead of adding another error. */
export function practiceRecoveryMoves(alg: string, history: string): string[] {
  const { expected, milestones } = planFor(alg);
  const actual = tokens(history);
  for (let i = actual.length; i >= 0; i--) {
    const position = milestones.get(stateKey(actual.slice(0, i).join(' ')));
    if (position === undefined) continue;
    let next = position;
    while (next < expected.length && rotation(expected[next])) next++;
    // A half turn entered as two quarter turns is progress, not an error.
    if (actual.length === i + 1 && expected[next]?.includes('2')
      && stateKey(`${history} ${actual[i]}`) === stateKey(expected.slice(0, next + 1).join(' '))) return [];
    const stack: Move[] = [];
    for (const token of actual.slice(i)) {
      const move = new Move(token);
      const previous = stack.at(-1);
      if (previous?.quantum.toString() === move.quantum.toString()) {
        stack.pop();
        const amount = ((previous.amount + move.amount) % 4 + 4) % 4;
        if (amount) stack.push(new Move(`${move.quantum}${amount === 1 ? '' : amount === 2 ? '2' : "'"}`));
      } else stack.push(move);
    }
    return stack.reverse().map(move => move.invert().toString());
  }
  return [];
}

/** Return a turn in the player's real frame, skipping camera-only reorientations. */
export function practiceNextMove(alg: string, history: string): string | undefined {
  const { expected, milestones } = planFor(alg);
  const actual = tokens(history);
  const position = milestones.get(stateKey(history));
  if (position !== undefined) {
    let next = position;
    while (next < expected.length && rotation(expected[next])) next++;
    if (next === expected.length) return undefined;
    const target = stateKey(expected.slice(0, next + 1).join(' '));
    const suffixes = expected[next].includes('2') ? ['2'] : ['', "'"];
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B', 'u', 'r', 'f', 'd', 'l', 'b', 'M', 'E', 'S']) {
      for (const suffix of suffixes) {
        const move = face + suffix;
        if (stateKey(`${history} ${move}`) === target) return move;
      }
    }
  }
  // Guide an off-path turn back without resetting or moving the user's cube.
  const recovery = practiceRecoveryMoves(alg, history);
  return recovery[0] ?? actual.at(-1) ?? expected[0];
}
