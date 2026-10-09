import { Alg, Commutator, Conjugate, Grouping, Move } from 'cubing/alg';
import { toCubingKilominx } from '@/lib/kilominx-notation';
import { applyGenerator, solvedState } from '@/lib/puzzle-group';
import { KILOMINX } from './_nets/kilominx';
import { renderNetState } from './_net_render';

const MAX_SCRAMBLE_LENGTH = 16_384;
const MAX_EXPANSION_WORK = 4_096;

/** Check before expansion: even an empty group can have a huge repeat count. */
function expansionWork(alg: Alg, depth = 0): number {
  if (depth > 32) throw new Error('Kilominx algorithm nesting is too deep');
  let work = 0;
  for (const node of alg.childAlgNodes()) {
    let cost = 1;
    if (node instanceof Move) cost += Math.abs(node.amount);
    else if (node instanceof Grouping) cost += (1 + expansionWork(node.alg, depth + 1)) * Math.abs(node.amount);
    else if (node instanceof Commutator) cost += 2 * (expansionWork(node.A, depth + 1) + expansionWork(node.B, depth + 1));
    else if (node instanceof Conjugate) cost += 2 * expansionWork(node.A, depth + 1) + expansionWork(node.B, depth + 1);
    work += cost;
    if (!Number.isSafeInteger(work) || work > MAX_EXPANSION_WORK) throw new Error('Kilominx algorithm expansion is too large');
  }
  return work;
}

/** Match /sim's default csTimer notation, retaining WCA R++/D++ unchanged. */
export function renderKilominxScrambleSvg(scramble: string): string {
  if (scramble.length > MAX_SCRAMBLE_LENGTH) throw new Error('Kilominx algorithm is too long');
  const alg = new Alg(toCubingKilominx(scramble));
  expansionWork(alg);
  let state = solvedState(KILOMINX.group);
  for (const node of alg.experimentalExpand()) {
    if (!(node instanceof Move)) continue;
    const quantum = node.quantum.toString();
    // cubing represents R++/D++ as special quantum families with amount ±1;
    // the baked generators already encode that complete 144-degree motion.
    const generator = quantum === 'R_PLUSPLUS_' ? 'R++'
      : quantum === 'D_PLUSPLUS_' ? 'D++' : quantum;
    if (!Object.hasOwn(KILOMINX.group.gens, generator)) throw new Error(`Unsupported Kilominx move: ${node}`);
    state = applyGenerator(KILOMINX.group, state, generator, node.amount);
  }
  return renderNetState(KILOMINX, state);
}
