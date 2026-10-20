import { Alg, Move, Grouping, Commutator, Conjugate, type AlgNode } from 'cubing/alg';
import { rotateAlg } from '@/lib/cube3';
import { parseCubeAlg } from '@cuberoot/shared/alg-transform';
import { MOVE_RE, stripComments } from '@cuberoot/shared/alg-notation';

export function hasHandNotation(text: string): boolean {
  return /[↑↓·p@<>]/.test(stripComments(text));
}

/** Source offsets, not expanded playback indices: retain layout and annotations. */
export function cubeTextMoves(text: string): { start: number; end: number; text: string; move: Move }[] {
  if (hasHandNotation(text)) throw new Error('Finger notation cannot be transformed losslessly');
  rotateAlg(text.replace(/\r\n?/g, '\n').replace(/[^\S\n]/g, ' '), 'x'); // Validate supported notation before changing any source.
  const tokens: { start: number; end: number; text: string; move: Move }[] = [];
  for (let i = 0; i < text.length;) {
    if (text.startsWith('//', i)) {
      const end = text.indexOf('\n', i);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    const match = MOVE_RE.exec(text.slice(i));
    if (!match) { i++; continue; }
    const raw = match[0];
    tokens.push({ start: i, end: i + raw.length, text: raw, move: new Move(raw) });
    i += raw.length;
  }
  return tokens;
}

/** Rewrite only moves, leaving comments, whitespace and group syntax verbatim. */
export function transformCubeText(text: string, transform: (move: string) => string): string {
  let result = text;
  for (const token of cubeTextMoves(text).reverse()) {
    // Transform the axis/sign using a quarter turn, then restore the written
    // amount. rotateAlg canonically folds -2; editing must retain 2' travel.
    const mapped = new Move(transform(token.move.modified({ amount: 1 }).toString()));
    const rewritten = mapped.modified({ amount: token.move.amount * mapped.amount }).toString();
    result = result.slice(0, token.start) + rewritten + result.slice(token.end);
  }
  return result;
}

export function oppositeMove(move: Move): Move | null {
  if (move.innerLayer || move.outerLayer) return null;
  const face = move.family.replace(/w$/, '').toUpperCase();
  const opposite: Record<string, string> = { R: 'L', L: 'R', U: 'D', D: 'U', F: 'B', B: 'F' };
  if (!opposite[face]) return null;
  const wide = move.family !== face;
  return move.modified({ family: wide ? opposite[face] : opposite[face].toLowerCase() });
}

/** Outermost group containing a source move. Comments do not contain syntax. */
export function moveSourceGroup(text: string, start: number): { start: number; end: number } | null {
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('//', i)) {
      const end = text.indexOf('\n', i);
      if (end < 0) break;
      i = end; continue;
    }
    if (text[i] === '(' || text[i] === '[') stack.push(i);
    else if (text[i] === ')' || text[i] === ']') {
      const open = stack.pop();
      if (!stack.length && open !== undefined && open < start && i > start) {
        const suffix = /^\d*'?/.exec(text.slice(i + 1))![0];
        return { start: open, end: i + 1 + suffix.length };
      }
    }
  }
  return null;
}

/** Expand just the selected group, retaining the source identity of repeated/inverted moves. */
function expandSelectedGroup(text: string, sourceIndex: number): { text: string; index: number } {
  type Leaf = { node: AlgNode; source: number | null };
  let source = 0;
  const inverse = (leaves: Leaf[]): Leaf[] => leaves.slice().reverse().map(leaf => ({ ...leaf, node: leaf.node.invert() }));
  const bounded = (leaves: Leaf[]): Leaf[] => {
    if (leaves.length > 2000) throw new Error('Too many expanded moves');
    return leaves;
  };
  const expand = (alg: Alg): Leaf[] => {
    let leaves: Leaf[] = [];
    for (const node of alg.childAlgNodes()) {
      if (node instanceof Move) leaves.push({ node, source: source++ });
      else if (node instanceof Grouping) {
        let inner = expand(node.alg);
        if (node.amount < 0) inner = inverse(inner);
        if (Math.abs(node.amount) * inner.length > 2000) throw new Error('Too many expanded moves');
        if (inner.length) for (let i = 0; i < Math.abs(node.amount); i++) leaves.push(...inner);
      } else if (node instanceof Commutator || node instanceof Conjugate) {
        const a = expand(node.A), b = expand(node.B);
        leaves.push(...a, ...b, ...inverse(a), ...(node instanceof Commutator ? inverse(b) : []));
      } else leaves.push({ node, source: null });
      leaves = bounded(leaves);
    }
    return leaves;
  };
  const leaves = expand(parseCubeAlg(text.replace(/\r\n?/g, '\n').replace(/[^\S\n]/g, ' ')));
  const position = leaves.findIndex(leaf => leaf.source === sourceIndex);
  if (position < 0) throw new Error('Selected move is not executed');
  return { text: new Alg(leaves.map(leaf => leaf.node)).toString(), index: leaves.slice(0, position).filter(leaf => leaf.node instanceof Move).length };
}

/** In a reversed group the first execution can be the inverse of the written move. */
export function moveAtFirstExecution(text: string, index: number): Move | null {
  const tokens = cubeTextMoves(text), token = tokens[index];
  if (!token) return null;
  const group = moveSourceGroup(text, token.start);
  if (!group) return token.move;
  const first = tokens.findIndex(item => item.start > group.start);
  const expanded = expandSelectedGroup(text.slice(group.start, group.end), index - first);
  return cubeTextMoves(expanded.text)[expanded.index]?.move ?? null;
}

/** First execution of a source move; expand only its enclosing group when necessary. */
export function editCubeText(text: string, index: number, action: string): { text: string; caret: number } {
  const tokens = cubeTextMoves(text);
  const token = tokens[index];
  if (index !== -1 && !token) throw new Error('Select a move');
  const group = token && moveSourceGroup(text, token.start);
  if (group) {
    const first = tokens.findIndex(item => item.start > group.start);
    const expanded = expandSelectedGroup(text.slice(group.start, group.end), index - first);
    const after = text.slice(group.end);
    const separator = after && !/^\s/.test(after) ? ' ' : '';
    const edited = editCubeText(expanded.text + separator + after, expanded.index, action);
    return { text: text.slice(0, group.start) + edited.text, caret: group.start + edited.caret };
  }
  const move = token?.move;
  let rotation: Move;
  let replacement: string;
  let caret: number;
  const prefix = token ? text.slice(0, token.start) : '';
  const tail = token ? text.slice(token.end) : text;
  if (action === 'opposite') {
    if (!move) throw new Error('Select a move');
    const opposite = oppositeMove(move);
    if (!opposite) throw new Error('Not a face move');
    replacement = opposite.toString();
    const face = move.family[0].toUpperCase();
    const axis = 'RL'.includes(face) ? 'x' : 'UD'.includes(face) ? 'y' : 'z';
    rotation = new Move(axis, ('RUF'.includes(face) ? -1 : 1) * move.amount);
    caret = prefix.length;
  } else if (action === 'remove') {
    if (!move || !/^[xyz]$/.test(move.family)) throw new Error('Not a rotation');
    rotation = move.invert();
    replacement = '';
    caret = prefix.length;
  } else {
    rotation = new Move(action);
    if (!/^[xyz]$/.test(rotation.family)) throw new Error('Not a rotation');
    replacement = (token ? token.text + ' ' : '') + rotation.toString();
    caret = prefix.length + (token ? token.text.length + 1 : 0);
    if (tail && !/^\s/.test(tail)) replacement += ' ';
  }
  const rewritten = transformCubeText(tail, raw => rotateAlg(raw, rotation.family as 'x' | 'y' | 'z', rotation.amount));
  return { text: prefix + replacement + rewritten, caret };
}

/** As in Algorithm Translator, equivalence is up to a final whole-cube rotation. */
export function manipulateAlg(text: string, index: number, action: string): string {
  return editCubeText(text, index, action).text;
}
