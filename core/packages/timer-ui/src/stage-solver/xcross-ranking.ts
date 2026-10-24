/**
 * Inspection-oriented XC/XXC ranking. No scramble-specific rules or learned labels.
 * Replay uses the shared cubie model, independently of the Rust search coordinates.
 * Scores are heuristic effort units, not predicted solve times.
 */
import {
  applyMove, applySequence, solvedCubie, parseMoves,
  CORNER_FACELET, EDGE_FACELET, type CubieCube,
} from '@cuberoot/puzzle-solvers/kociemba/cube';
import { rotateMovesToFrame } from './rotate-solution';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import type { SolItem } from './rust-cross-client';

const face = (sticker: number) => Math.floor(sticker / 9);
const cornerFaces = CORNER_FACELET.map(fs => fs.map(face));
const edgeFaces = EDGE_FACELET.map(fs => fs.map(face));
const cross = [4, 5, 6, 7];
// Derived from the shared geometry, rather than the Rust solver's piece numbering.
const slots = Object.fromEntries(cornerFaces.flatMap((fs, corner) => {
  if (!fs.includes(3)) return [];
  const sides = fs.filter(f => f !== 3);
  const edge = edgeFaces.findIndex(ef => sides.every(f => ef.includes(f)));
  const name = ['FR', 'FL', 'BL', 'BR'].find(s =>
    [...s].every(f => sides.includes('URFDLB'.indexOf(f))))!;
  return [[name, { corner, edge }]];
}));

export interface XCrossEffort {
  valid: boolean;
  moves: number;
  qtm: number;
  anchorDelay: number;
  anchorRework: number;
  pairRework: number;
  blockRework: number;
  tracking: number;
  crossRework: number;
  execution: number;
  score: number;
}

/** Shared by the scorer and the experiment's explanation; lower is preferred. */
export const XCROSS_EFFORT_WEIGHTS = {
  moves: 1, anchorDelay: 2, anchorRework: 2, pairRework: 3,
  blockRework: 1, tracking: 0.15, crossRework: 0.2, execution: 1,
} as const satisfies Partial<Record<keyof XCrossEffort, number>>;

export interface XCrossFrame {
  step: number;
  crossSolved: number;
  slots: { name: string; pair: boolean; blockLinks: number; edgeHome: boolean; cornerHome: boolean }[];
}

/** Same physical corner/edge form a correctly coloured rigid pair, anywhere. */
export function connectedPair(state: CubieCube, corner: number, edge: number): boolean {
  const c = state.cp.indexOf(corner), e = state.ep.indexOf(edge);
  return edgeFaces[e].every((f, i) => {
    const j = cornerFaces[c].indexOf(f);
    return j >= 0 && edgeFaces[edge][(i + state.eo[e]) % 2]
      === cornerFaces[corner][(j + 3 - state.co[c]) % 3];
  });
}

const edgeHome = (s: CubieCube, e: number) => s.ep[e] === e && s.eo[e] === 0;
const cornerHome = (s: CubieCube, c: number) => s.cp[c] === c && s.co[c] === 0;

/** A familiar side / U-or-D / inverse-side insertion may temporarily open a block. */
function shortInsertion(moves: number[], from: number, to: number): boolean {
  if (to - from !== 3) return false;
  const [a, b, c] = moves.slice(from, to);
  const af = Math.floor(a / 3), bf = Math.floor(b / 3);
  return af !== 0 && af !== 3 && (bf === 0 || bf === 3)
    && Math.floor(c / 3) === af && (a % 3 + c % 3) % 3 === 2;
}

/** Penalise losing an established relation, not simply having an unpaired start. */
function rework(history: boolean[], moves: number[]): number {
  let cost = 0;
  for (let i = 1; i < history.length; i++) {
    if (!history[i - 1] || history[i]) continue;
    let end = i;
    while (end < history.length && !history[end]) end++;
    const gap = end - i;
    // Preserve the exception only for the complete, verified rejoining trigger.
    cost += end < history.length && shortInsertion(moves, i - 1, end)
      ? 0.25 : 1 + gap * 0.5;
    i = end;
  }
  return cost;
}

/**
 * Score one candidate in its own D-cross frame. Leading rotations only change
 * coordinates; they do not count as progress or turn cost. Invalid candidates
 * get Infinity, so they can never become the recommended solution.
 */
function scoreXCross(scramble: string, solution: SolItem, starts: Map<string, CubieCube>, trace?: XCrossFrame[]): XCrossEffort {
  const tokens = solution.m.trim().split(/\s+/).filter(Boolean);
  let split = 0;
  while (split < tokens.length && /^[xyz](?:2|')?$/.test(tokens[split])) split++;
  const lead = tokens.slice(0, split).join(' ');
  const body = tokens.slice(split);
  const moves = body.every(t => /^[URFDLB](?:2|')?$/.test(t)) ? parseMoves(body.join(' ')) : [];
  const selected = solution.c.trim().split(/\s+/).map(s => slots[s]);
  const result: XCrossEffort = {
    valid: false, moves: moves.length, qtm: moves.reduce((n, m) => n + (m % 3 === 1 ? 2 : 1), 0),
    anchorDelay: 0, anchorRework: 0, pairRework: 0, blockRework: 0, tracking: 0, crossRework: 0, execution: 0, score: Infinity,
  };
  if (moves.length !== body.length || selected.length < 1 || selected.length > 2 || selected.some(s => !s)) return result;
  let start = starts.get(lead);
  if (!start) {
    try {
      const framed = rotateMovesToFrame(scramble, lead);
      start = applySequence(solvedCubie(), parseMoves(framed));
    } catch { return result; }
    starts.set(lead, start);
  }
  const states = [start];
  for (const move of moves) states.push(applyMove(states.at(-1)!, move));
  const last = states.at(-1)!;
  if (!cross.every(e => edgeHome(last, e)) || !selected.every(s => cornerHome(last, s.corner) && edgeHome(last, s.edge))) return result;
  result.valid = true;

  const selectedCorners = new Set(selected.map(s => s.corner));
  const edges = [...cross, ...selected.map(s => s.edge)];
  const bonds = selected.flatMap(s => edges.filter(e => edgeFaces[e].every(f => cornerFaces[s.corner].includes(f)))
    .map(edge => ({ corner: s.corner, edge, pair: edge === s.edge })));
  const histories = bonds.map(b => states.map(s => connectedPair(s, b.corner, b.edge)));

  if (trace) states.forEach((state, step) => trace.push({
    step, crossSolved: cross.filter(e => edgeHome(state, e)).length,
    slots: selected.map((s, i) => ({
      name: solution.c.trim().split(/\s+/)[i], pair: connectedPair(state, s.corner, s.edge),
      blockLinks: bonds.filter((b, j) => b.corner === s.corner && !b.pair && histories[j][step]).length,
      edgeHome: edgeHome(state, s.edge), cornerHome: cornerHome(state, s.corner),
    })),
  }));

  for (const s of selected) {
    const anchors = states.map((state, i) => edgeHome(state, s.edge) || cornerHome(state, s.corner)
      || bonds.some((b, j) => b.corner === s.corner && histories[j][i]));
    const first = anchors.indexOf(true);
    // Existing and one-move structures are equally legitimate starting points.
    result.anchorDelay += Math.max(0, first - 1);
    result.anchorRework += rework(anchors, moves);
  }
  histories.forEach((h, i) => {
    const loss = rework(h, moves);
    if (bonds[i].pair) result.pairRework += loss;
    else result.blockRework += loss;
  });
  // Don't destroy an initially supplied, non-target F2L pair without accounting
  // for it. Newly accidental non-target pairs aren't a distraction to track.
  for (const s of Object.values(slots)) {
    if (!selectedCorners.has(s.corner) && connectedPair(start, s.corner, s.edge)) {
      result.pairRework += 0.5 * rework(states.map(p => connectedPair(p, s.corner, s.edge)), moves);
    }
  }
  result.crossRework = cross.reduce((sum, e) => sum + rework(states.map(s => edgeHome(s, e)), moves), 0);

  for (let i = 0; i < moves.length; i++) {
    // Count independently moving groups, with connected pieces tracked as one
    // object. XXC therefore accounts for simultaneous tracking, not two XC scores.
    const before = states[i], after = states[i + 1];
    const pieces = [...edges.map(e => ({ id: e, corner: false })), ...selected.map(s => ({ id: s.corner, corner: true }))];
    const parent = pieces.map((_, j) => j);
    const root = (j: number): number => parent[j] === j ? j : (parent[j] = root(parent[j]));
    bonds.forEach((b, j) => {
      if (!histories[j][i] || !histories[j][i + 1]) return;
      const c = pieces.findIndex(p => p.corner && p.id === b.corner);
      const e = pieces.findIndex(p => !p.corner && p.id === b.edge);
      parent[root(c)] = root(e);
    });
    const moving = new Set<number>();
    pieces.forEach((p, j) => {
      const perm = p.corner ? 'cp' : 'ep', ori = p.corner ? 'co' : 'eo';
      const a = before[perm].indexOf(p.id), b = after[perm].indexOf(p.id);
      if (a !== b || before[ori][a] !== after[ori][b]) moving.add(root(j));
    });
    result.tracking += Math.max(0, moving.size - 2) ** 2;
  }
  // Small execution tie-breakers: half turns and axis changes. No claim of
  // personal finger-trick speed; cognitive structure dominates this term.
  const axis = (m: number) => Math.floor(m / 3) % 3;
  result.execution = 0.1 * (result.qtm - result.moves)
    + 0.08 * moves.slice(1).filter((m, i) => axis(m) !== axis(moves[i])).length;
  result.score = (Object.keys(XCROSS_EFFORT_WEIGHTS) as (keyof typeof XCROSS_EFFORT_WEIGHTS)[])
    .reduce((sum, key) => sum + result[key] * XCROSS_EFFORT_WEIGHTS[key], 0);
  return result;
}

export function xcrossEffort(scramble: string, solution: SolItem): XCrossEffort {
  return scoreXCross(normalizeWcaScramble(scramble) ?? scramble, solution, new Map());
}

/** Step diagnostics for the experiment, using the exact same replay as ranking. */
export function inspectXCrossSolution(scramble: string, solution: SolItem): { effort: XCrossEffort; frames: XCrossFrame[] } {
  const frames: XCrossFrame[] = [];
  const effort = scoreXCross(normalizeWcaScramble(scramble) ?? scramble, solution, new Map(), frames);
  return { effort, frames };
}

export function rankXCrossSolutions(scramble: string, candidates: readonly SolItem[], limit: number): SolItem[] {
  const starts = new Map<string, CubieCube>();
  const normalized = normalizeWcaScramble(scramble) ?? scramble;
  const ranked = candidates.map(sol => ({ sol, effort: scoreXCross(normalized, sol, starts) }))
    .filter(x => x.effort.valid)
    .sort((a, b) => a.effort.score - b.effort.score || a.effort.moves - b.effort.moves
      || a.effort.qtm - b.effort.qtm || a.sol.m.localeCompare(b.sol.m) || a.sol.c.localeCompare(b.sol.c));
  const seen = new Set<string>();
  return ranked.filter(({ sol }) => !seen.has(sol.m) && !!seen.add(sol.m))
    .slice(0, limit || undefined).map(x => x.sol);
}
