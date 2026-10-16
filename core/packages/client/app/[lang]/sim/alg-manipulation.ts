import { Alg, Move, type AlgNode } from 'cubing/alg';
import { rotateAlg } from '@/lib/cube3';
import { parseCubeAlg } from '@cuberoot/shared/alg-transform';

/** Expand with a bound so a large repeat cannot lock up the editor. */
export function manipulationNodes(text: string): AlgNode[] {
  const nodes: AlgNode[] = [];
  for (const node of parseCubeAlg(text).experimentalExpand()) {
    if (nodes.length >= 2000) throw new Error('Too many expanded moves');
    nodes.push(node);
  }
  return nodes;
}

export function oppositeMove(move: Move): Move | null {
  if (move.innerLayer || move.outerLayer) return null;
  const face = move.family.replace(/w$/, '').toUpperCase();
  const opposite: Record<string, string> = { R: 'L', L: 'R', U: 'D', D: 'U', F: 'B', B: 'F' };
  if (!opposite[face]) return null;
  const wide = move.family !== face;
  return move.modified({ family: wide ? opposite[face] : opposite[face].toLowerCase() });
}

/** As in Algorithm Translator, equivalence is up to a final whole-cube rotation. */
export function manipulateAlg(text: string, index: number, action: string): string {
  const nodes = manipulationNodes(text);
  const positions = nodes.flatMap((node, i) => node instanceof Move ? [i] : []);
  const position = positions[index];
  const move = nodes[position];
  if (!(move instanceof Move)) throw new Error('Select a move');
  const prefix = nodes.slice(0, position);
  const tail = new Alg(nodes.slice(position + 1)).toString();
  let rotation: Move;
  if (action === 'opposite') {
    const replacement = oppositeMove(move);
    if (!replacement) throw new Error('Not a face move');
    prefix.push(replacement);
    const face = move.family[0].toUpperCase();
    const axis = 'RL'.includes(face) ? 'x' : 'UD'.includes(face) ? 'y' : 'z';
    rotation = new Move(axis, ('RUF'.includes(face) ? -1 : 1) * move.amount);
  } else if (action === 'remove') {
    if (!/^[xyz]$/.test(move.family)) throw new Error('Not a rotation');
    rotation = move.invert();
  } else {
    rotation = new Move(action);
    if (!/^[xyz]$/.test(rotation.family)) throw new Error('Not a rotation');
    prefix.push(move, rotation);
  }
  const rewritten = new Alg(rotateAlg(tail, rotation.family as 'x' | 'y' | 'z', rotation.amount));
  return new Alg([...prefix, ...rewritten.childAlgNodes()]).toString();
}
