// ── Independent reference model ───────────────────────────────────────────────
// Re-derived straight from the verified cstimer 8-puzzle spec (3×3 grid, blank slides to an
// orthogonal neighbor). The token → blank Δ map was confirmed by replaying 1000 real cstimer
// `8prp` scrambles through cstimer's own slideMove with zero wall hits. This reference is NOT
// built on the solver's own apply — round-trip / optimality checks are a genuine cross-check.
//
//   U → row+1   D → row−1   L → col+1   R → col−1   (rows downward from 0; solved blank at pos 8)
export const DELTA: Record<string, [number, number]> = {
  U: [1, 0], D: [-1, 0], L: [0, 1], R: [0, -1],
};
export const DIRS = ['U', 'D', 'L', 'R'] as const;
export type Dir = (typeof DIRS)[number];
export const BLANK = 8; // blank tile value (sits at the bottom-right when solved)

export interface State { g: number[]; blank: number; }
export const solved = (): State => ({ g: [0, 1, 2, 3, 4, 5, 6, 7, 8], blank: 8 });
export const keyOf = (s: State) => s.g.join(',');

// expand a scramble into single ±1 slides (D2 → D D); throws on a bad token.
export function expand(scr: string): Dir[] {
  const out: Dir[] = [];
  for (const tok of scr.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = /^([UDLR])(\d+)?$/.exec(tok);
    if (!m) throw new Error(`bad: ${tok}`);
    const dir = m[1] as Dir;
    const n = m[2] ? Number(m[2]) : 1;
    for (let k = 0; k < n; k++) out.push(dir);
  }
  return out;
}

// apply one slide to a state; returns false if it runs off the grid (no mutation then).
export function slide(s: State, dir: Dir): boolean {
  const r = Math.floor(s.blank / 3), c = s.blank % 3;
  const [dr, dc] = DELTA[dir];
  const nr = r + dr, nc = c + dc;
  if (nr < 0 || nr > 2 || nc < 0 || nc > 2) return false;
  const nb = nr * 3 + nc;
  s.g[s.blank] = s.g[nb];
  s.g[nb] = BLANK;
  s.blank = nb;
  return true;
}

export function applySeq(seq: Dir[]): State {
  const s = solved();
  for (const dir of seq) {
    if (!slide(s, dir)) throw new Error(`off-grid: ${dir}`);
  }
  return s;
}
