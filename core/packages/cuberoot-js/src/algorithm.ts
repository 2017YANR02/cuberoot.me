import { Commutator, Conjugate, Grouping, Move, Pause, type Alg } from 'cubing/alg';
import { parseCubeAlg } from '@cuberoot/shared/alg-transform';
import { supportsReplayMove } from '@cuberoot/puzzle-render-core/replay/mountReplayCube';

const MAX_ALG_LENGTH = 32_768;
const MAX_EXPANDED_NODES = 10_000;
const MAX_GROUP_DEPTH = 32;

// Count comments and empty groups as work too, so repeated groups without
// any playable turns cannot bypass the expansion limit.
function expansionSize(alg: Alg, depth = 0): number {
  if (depth > MAX_GROUP_DEPTH) throw new RangeError('Too many nested groups');

  let size = 0;
  for (const node of alg.childAlgNodes()) {
    if (node instanceof Grouping) {
      size += Math.abs(node.amount) * expansionSize(node.alg, depth + 1);
    } else if (node instanceof Commutator || node instanceof Conjugate) {
      const copiesOfB = node instanceof Commutator ? 2 : 1;
      size += 2 * expansionSize(node.A, depth + 1) + copiesOfB * expansionSize(node.B, depth + 1);
    } else {
      size += 1;
    }
    if (size > MAX_EXPANDED_NODES) throw new RangeError('Too many expanded steps');
  }
  return Math.max(1, size);
}

export function parseNxNReplay(input: string, order: number): string[] {
  const alg = parseCubeAlg(input);
  expansionSize(alg);
  const steps: string[] = [];
  for (const node of alg.expand().childAlgNodes()) {
    if (node instanceof Pause) steps.push('.');
    if (!(node instanceof Move)) continue;

    // Keep the direction of half turns and discard redundant full spins.
    let amount = node.amount % 4;
    if (amount > 2) amount -= 4;
    if (amount < -2) amount += 4;
    const move = node.modified({ amount: amount || 1 }).toString();
    if (!supportsReplayMove(move, order)) throw new SyntaxError(`Unsupported ${order}×${order} move ${move}`);
    if (amount !== 0) steps.push(move);
  }
  return steps;
}

export function replaySteps(input: string, label: string, parse: (text: string) => string[]): string[] {
  try {
    if (typeof input !== 'string') throw new TypeError('Expected a string');
    if (input.length > MAX_ALG_LENGTH) throw new RangeError('Algorithm text is too long');

    const steps = parse(input.replace(/[‘’′]/g, "'"));
    if (steps.length > MAX_EXPANDED_NODES) throw new RangeError('Too many expanded steps');
    return steps;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new SyntaxError(`Invalid ${label}: ${detail}`, { cause });
  }
}
