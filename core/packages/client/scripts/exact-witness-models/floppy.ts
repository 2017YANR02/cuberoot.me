// ── Independent reference model ───────────────────────────────────────────────
// Re-derived straight from the cstimer 1x3x3 spec (movePieces 2-cycle swap + per-axis flip bit),
// NOT from the solver's own apply — so round-trip / optimality checks are a genuine cross-check
// rather than a tautology.
export const MOVE_PIECES = [[0, 1], [2, 3], [0, 3], [1, 2]]; // R L F B
export const TOKENS = ['R', 'L', 'F', 'B'];

export interface State { p: number[]; f: number[]; }
export const solved = (): State => ({ p: [0, 1, 2, 3], f: [0, 0, 0, 0] });
export const keyOf = (s: State) => s.p.join('') + '|' + s.f.join('');

export function applyToken(s: State, tok: string): void {
  const axis = 'RLFB'.indexOf(tok);
  const [a, b] = MOVE_PIECES[axis];
  const t = s.p[a]; s.p[a] = s.p[b]; s.p[b] = t; // swap pieces
  s.f[axis] ^= 1;                                 // toggle this axis's flip bit
}
export function applySeq(seq: string[]): State {
  const s = solved();
  for (const tok of seq) applyToken(s, tok);
  return s;
}
