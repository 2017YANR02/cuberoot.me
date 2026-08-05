/**
 * two-tools 的“先做面/层，再接公式”搜索核心。
 *
 * 魔方状态、六面转和整体转体全部复用 pocket-facelet；这里只保留上游独有的
 * 双向搜索编排。纯函数、无 DOM，可同时给 Web Worker 和 Vitest 使用。
 */

import {
  POCKET_ROTATIONS,
  applyPocketAlg,
  applyPocketFaceTurn,
  invertPocketAlg,
  pocketStateToFacelet,
  rotatePocketState,
  solvedPocketState,
  type PocketFace,
  type PocketState,
} from './pocket-facelet';

export type TwoToolsGroup = 'EG' | 'TCLL' | 'LS';

export interface TwoToolsCaseInput {
  set: string;
  method: string;
  name: string;
  subgroup: string;
  setup: string;
  algs: string[];
}

export interface TwoToolsDepths {
  EG: number;
  TCLL: number;
  LS: number;
}

export interface TwoToolsSearchInput {
  scramble: string;
  cases: TwoToolsCaseInput[];
  depths: TwoToolsDepths;
  selectedMethods?: string[];
  algsPerCase?: number;
}

export interface TwoToolsSolution {
  inspection: string;
  face: string;
  alg: string;
  solution: string;
  method: string;
  methodGroup: TwoToolsGroup;
  subset: string;
  caseName: string;
  color: PocketFace;
  depth: number;
  algNumber: number;
  score: number;
}

const SEARCH_MOVES = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'"] as const;
const AUF = ['', 'U', 'U2', "U'"] as const;

const GROUP_BY_SET: Record<string, TwoToolsGroup | undefined> = {
  cll: 'EG', eg1: 'EG', eg2: 'EG', leg1: 'EG',
  'tcll-plus': 'TCLL', 'tcll-minus': 'TCLL',
  ls1: 'LS', ls2: 'LS', ls3: 'LS', ls4: 'LS', ls5: 'LS',
  ls6: 'LS', ls7: 'LS', ls8: 'LS', ls9: 'LS',
};

function stateKey(s: PocketState): string {
  return `${s.cp.join(',')}|${s.co.join(',')}`;
}

function moveAmount(move: string): number {
  return move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1;
}

function applySearchMove(s: PocketState, move: string): PocketState {
  return applyPocketFaceTurn(s, move[0] as PocketFace, moveAmount(move));
}

function inverseMoves(moves: readonly string[]): string[] {
  if (!moves.length) return [];
  return invertPocketAlg(moves.join(' ')).split(/\s+/).filter(Boolean);
}

function suffix(amount: number): string {
  const n = ((amount % 4) + 4) % 4;
  return n === 1 ? '' : n === 2 ? '2' : n === 3 ? "'" : '';
}

/** 只合并相邻同面转；不会跨整体转体乱改坐标系。 */
export function simplifyTwoToolsMoves(alg: string): string {
  const out: { family: string; amount: number }[] = [];
  for (const token of alg.trim().split(/\s+/).filter(Boolean)) {
    const family = token[0];
    const amount = moveAmount(token);
    const last = out[out.length - 1];
    if (last && last.family === family) {
      last.amount = (last.amount + amount) % 4;
      if (last.amount === 0) out.pop();
    } else {
      out.push({ family, amount });
    }
  }
  return out.map(({ family, amount }) => family + suffix(amount)).join(' ');
}

function isSolved(s: PocketState): boolean {
  const facelet = pocketStateToFacelet(s);
  for (let i = 0; i < 6; i++) {
    const face = facelet.slice(i * 4, i * 4 + 4);
    if (new Set(face).size !== 1) return false;
  }
  return true;
}

interface Orientation {
  word: string;
  state: PocketState;
  color: PocketFace;
}

/** 24 个观察朝向，BFS 保证 inspection 词尽量短。 */
const ORIENTATIONS: Orientation[] = (() => {
  const solved = solvedPocketState();
  const gens = ['x', 'x2', "x'", 'y', 'y2', "y'", 'z', 'z2', "z'"];
  const seen = new Map<string, string>([[stateKey(solved), '']]);
  let frontier: { state: PocketState; word: string }[] = [{ state: solved, word: '' }];
  while (frontier.length && seen.size < POCKET_ROTATIONS.length) {
    const next: typeof frontier = [];
    for (const node of frontier) for (const gen of gens) {
      const state = applyPocketAlg(node.state, gen);
      const key = stateKey(state);
      if (seen.has(key)) continue;
      const word = [node.word, gen].filter(Boolean).join(' ');
      seen.set(key, word);
      next.push({ state, word });
    }
    frontier = next;
  }
  return POCKET_ROTATIONS.map((rot) => {
    const state = rotatePocketState(solved, rot);
    const word = seen.get(stateKey(state));
    if (word === undefined) throw new Error('incomplete 2x2 orientation table');
    return { word, state, color: pocketStateToFacelet(state)[12] as PocketFace };
  });
})();

interface Target {
  state: PocketState;
  methodGroup: TwoToolsGroup;
  source: TwoToolsCaseInput;
  preAuf: string;
}

interface BackEntry {
  target: Target;
  path: string[];
}

function buildTargets(input: TwoToolsSearchInput): Target[] {
  const selected = input.selectedMethods ? new Set(input.selectedMethods) : null;
  const solved = solvedPocketState();
  const out: Target[] = [];
  const seen = new Set<string>();
  for (const source of input.cases) {
    const methodGroup = GROUP_BY_SET[source.set];
    if (!methodGroup || !source.algs.length || (selected && !selected.has(source.method))) continue;
    const canonical = applyPocketAlg(solved, source.setup);
    for (const preAuf of AUF) {
      // candidate · preAuf = canonical，所以 candidate = canonical · preAuf^-1。
      const state = preAuf ? applyPocketAlg(canonical, invertPocketAlg(preAuf)) : canonical;
      const key = `${source.set}|${source.name}|${stateKey(state)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ state, methodGroup, source, preAuf });
    }
  }
  return out;
}

function addBack(net: Map<string, BackEntry[]>, state: PocketState, entry: BackEntry): void {
  const key = stateKey(state);
  const list = net.get(key);
  if (list) list.push(entry);
  else net.set(key, [entry]);
}

/** 每个目标只反搜 floor(depth / 2)，与打乱端的 ceil(depth / 2) 在中点相遇。 */
function buildBackNet(targets: Target[], depths: TwoToolsDepths): Map<string, BackEntry[]> {
  const net = new Map<string, BackEntry[]>();
  for (const target of targets) {
    const limit = Math.floor(depths[target.methodGroup] / 2);
    const visited = new Set<string>([stateKey(target.state)]);
    let frontier: { state: PocketState; path: string[] }[] = [{ state: target.state, path: [] }];
    addBack(net, target.state, { target, path: [] });
    for (let depth = 1; depth <= limit; depth++) {
      const next: typeof frontier = [];
      for (const node of frontier) for (const move of SEARCH_MOVES) {
        if (node.path.length && node.path[node.path.length - 1][0] === move[0]) continue;
        const state = applySearchMove(node.state, move);
        const key = stateKey(state);
        if (visited.has(key)) continue;
        visited.add(key);
        const path = [...node.path, move];
        addBack(net, state, { target, path });
        next.push({ state, path });
      }
      frontier = next;
    }
  }
  return net;
}

/**
 * 上游的三连转时间表。未知三连转按 0.6 秒处理；注入表后与 two-tools 排序口径一致。
 */
export function ergonomicScore(alg: string, timings: Readonly<Record<string, number>> = {}): number {
  const arr = alg.trim().split(/\s+/).filter(Boolean).filter((m) => !'xyz'.includes(m[0]));
  let score = 0;
  for (let i = 0; i < arr.length; i++) {
    const times: number[] = [];
    if (arr.length - i >= 3) times.push(timings[arr.slice(i, i + 3).join(' ')] ?? 0.6);
    if (arr.length - i >= 2 && i > 0) times.push(timings[arr.slice(i - 1, i + 2).join(' ')] ?? 0.6);
    if (arr.length - i >= 1 && i > 1) times.push(timings[arr.slice(i - 2, i + 1).join(' ')] ?? 0.6);
    if (times.length) score += times.reduce((sum, time) => sum + time / 3, 0) / times.length;
  }
  return score;
}

function appendMatches(
  out: TwoToolsSolution[],
  original: PocketState,
  orientation: Orientation,
  frontPath: readonly string[],
  entries: readonly BackEntry[],
  input: TwoToolsSearchInput,
  timings: Readonly<Record<string, number>>,
): void {
  const algLimit = Math.max(1, Math.min(3, input.algsPerCase ?? 1));
  for (const { target, path: backPath } of entries) {
    const construction = simplifyTwoToolsMoves([...frontPath, ...inverseMoves(backPath)].join(' '));
    const depth = construction ? construction.split(/\s+/).length : 0;
    if (depth > input.depths[target.methodGroup]) continue;
    for (const [algNumber, rawAlg] of target.source.algs.slice(0, algLimit).entries()) {
      const alg = simplifyTwoToolsMoves([target.preAuf, rawAlg].filter(Boolean).join(' '));
      const solution = simplifyTwoToolsMoves([construction, alg].filter(Boolean).join(' '));
      const full = [orientation.word, solution].filter(Boolean).join(' ');
      let end: PocketState;
      try { end = applyPocketAlg(original, full); } catch { continue; }
      if (!isSolved(end)) continue;
      out.push({
        inspection: orientation.word,
        face: construction,
        alg,
        solution,
        method: target.source.method,
        methodGroup: target.methodGroup,
        subset: target.source.subgroup || target.source.name,
        caseName: target.source.name,
        color: orientation.color,
        depth,
        algNumber,
        score: ergonomicScore(solution, timings),
      });
    }
  }
}

export function findTwoToolsSolutions(
  input: TwoToolsSearchInput,
  timings: Readonly<Record<string, number>> = {},
): TwoToolsSolution[] {
  const original = applyPocketAlg(solvedPocketState(), input.scramble);
  const targets = buildTargets(input);
  const backNet = buildBackNet(targets, input.depths);
  const frontLimit = Math.ceil(Math.max(input.depths.EG, input.depths.TCLL, input.depths.LS) / 2);
  const found: TwoToolsSolution[] = [];

  for (const orientation of ORIENTATIONS) {
    const start = applyPocketAlg(original, orientation.word);
    let frontier: { state: PocketState; path: string[] }[] = [{ state: start, path: [] }];
    const visited = new Set<string>([stateKey(start)]);
    const direct = backNet.get(stateKey(start));
    if (direct) appendMatches(found, original, orientation, [], direct, input, timings);
    for (let depth = 1; depth <= frontLimit; depth++) {
      const next: typeof frontier = [];
      for (const node of frontier) for (const move of SEARCH_MOVES) {
        if (node.path.length && node.path[node.path.length - 1][0] === move[0]) continue;
        const state = applySearchMove(node.state, move);
        const key = stateKey(state);
        if (visited.has(key)) continue;
        visited.add(key);
        const path = [...node.path, move];
        const entries = backNet.get(key);
        if (entries) appendMatches(found, original, orientation, path, entries, input, timings);
        next.push({ state, path });
      }
      frontier = next;
    }
  }

  const unique = new Map<string, TwoToolsSolution>();
  for (const solution of found) {
    const key = `${solution.color}|${solution.method}|${solution.solution}`;
    const prev = unique.get(key);
    if (!prev || solution.inspection.split(/\s+/).filter(Boolean).length < prev.inspection.split(/\s+/).filter(Boolean).length) {
      unique.set(key, solution);
    }
  }
  return [...unique.values()].sort((a, b) =>
    a.score - b.score || a.solution.split(/\s+/).length - b.solution.split(/\s+/).length || a.depth - b.depth,
  );
}
