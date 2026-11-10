import { Alg } from 'cubing/alg';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { FM_REGULAR, stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveSimPreviewMoves } from '@/components/AlgPlayer/player-setup';
import { f2lCenterNormalizer, pairKey, protectedStructure } from './curriculum';
import catalog from '../data/alg-snapshot.json';
import alternatives from '../data/practice-algs.json';

const AUFS = ['', 'U', 'U2', "U'"];
const mask = stickeringMaskFn(3, 'F2LOverview')!;
const inverse = (alg: string) => new Alg(alg).invert().expand().toString();
export const flowEdgeId = (from: string, to: string) => `${from}:${to}`;
export interface FlowState { key: string; name?: string; rotation: string; }
export interface FlowPoint { name: string; step: number; setup: string; }
export interface PracticeFlowRoute {
  alg: string; moves: string[]; states: FlowState[]; points: FlowPoint[];
}
export interface PracticeFlow {
  name: string; setup: string; routes: PracticeFlowRoute[];
  nodes: { name: string; setup: string }[];
  edges: { id: string; from: string; to: string }[];
  rejected: string[];
}
let caseKeys: Map<string, string> | undefined;
const stateCache = new Map<string, FlowState>();

/** Track every first-two-layer piece, including temporarily displaced pieces.
 * Masking is by piece identity, so a broken cross cannot masquerade as a case. */
function stateReader() {
  const cube = new Cube(3);
  const normalize = f2lCenterNormalizer(cube);
  if (!caseKeys) {
    const keys = new Map<string, string>();
    for (const item of catalog.cases) for (const auf of AUFS) {
      normalize(`${item.setup} ${auf}`);
      keys.set(pairKey(cube), item.name);
    }
    normalize('');
    keys.set(pairKey(cube), 'solved');
    caseKeys = keys;
  }
  return {
    read(source: string): FlowState {
      const cached = stateCache.get(source);
      if (cached) return cached;
      const rotation = normalize(source);
      if (rotation === undefined) cube.twister.setup(source);
      const colors = cube.serialize(), visible = cube.serializeStickering(mask);
      const key = [...colors].map((color, i) => visible[i] === FM_REGULAR ? color : '-').join('');
      const name = rotation !== undefined && protectedStructure(cube) ? caseKeys!.get(pairKey(cube)) : undefined;
      const state = { key, name, rotation: rotation ?? '' };
      if (stateCache.size >= 2048) stateCache.delete(stateCache.keys().next().value!);
      stateCache.set(source, state);
      return state;
    },
    dispose: () => cube.dispose(),
  };
}

/** Frozen alternatives are aligned to the exercise's actual starting state and
 * replay-validated. Live formula-library edits cannot change a running lesson. */
export function buildPracticeFlow(name: string, setup: string, teachingAlg: string): PracticeFlow {
  const reader = stateReader();
  const routes: PracticeFlowRoute[] = [], rejected: string[] = [];
  try {
    const start = reader.read(setup);
    const candidates = [{ alg: teachingAlg, setup }, ...(alternatives.cases.find(item => item.name === name)?.algs ?? [])];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const target = reader.read(candidate.setup);
      const auf = AUFS.find(turn => reader.read(`${setup} ${start.rotation} ${turn}`).key === target.key);
      if (auf === undefined) { rejected.push(candidate.alg); continue; }
      const alg = [start.rotation, auf, inverse(target.rotation), candidate.alg].filter(Boolean).join(' ');
      const moves = resolveSimPreviewMoves('3x3', alg);
      const flat = moves.join(' ');
      if (seen.has(flat)) continue;
      seen.add(flat);
      const states = [start, ...moves.map((_, i) => reader.read(`${setup} ${moves.slice(0, i + 1).join(' ')}`))];
      if (states.at(-1)?.name !== 'solved') { rejected.push(candidate.alg); continue; }
      const points: FlowPoint[] = [{ name, step: 0, setup }];
      states.forEach((state, step) => {
        if (step && state.name && state.name !== points.at(-1)!.name) {
          points.push({ name: state.name, step, setup: `${setup} ${moves.slice(0, step).join(' ')}` });
        }
      });
      routes.push({ alg: flat, moves, states, points });
    }
    const nodes = new Map<string, { name: string; setup: string }>();
    const edges = new Map<string, { id: string; from: string; to: string }>();
    for (const route of routes) route.points.forEach((point, i) => {
      if (!nodes.has(point.name)) {
        const state = reader.read(point.setup);
        nodes.set(point.name, { name: point.name, setup: `${point.setup} ${state.rotation}` });
      }
      if (i) {
        const from = route.points[i - 1].name, to = point.name, id = flowEdgeId(from, to);
        edges.set(id, { id, from, to });
      }
    });
    return { name, setup, routes, nodes: [...nodes.values()], edges: [...edges.values()], rejected };
  } finally { reader.dispose(); }
}

export interface FlowMatch {
  route: PracticeFlowRoute; step: number; remaining: string;
}
export interface FlowProgress {
  current?: string; match?: FlowMatch;
  visitedNodes: Set<string>; visitedEdges: Set<string>;
  edges: Map<string, number>;
}

/** Recognize physical states, not text prefixes: accepts equivalent moves,
 * rotations, AUF, undo/redo, and switching branches at a common case. */
export function practiceFlowProgress(flow: PracticeFlow, history: string): FlowProgress {
  const reader = stateReader();
  try {
    const actual = resolveSimPreviewMoves('3x3', history);
    const states = [reader.read(flow.setup), ...actual.map((_, i) => reader.read(`${flow.setup} ${actual.slice(0, i + 1).join(' ')}`))];
    const current = states.at(-1)!;
    // Keep the active trail, not a permanent record of every visited branch.
    // Returning to an earlier physical state removes the detour, including a
    // partially undone edge. AUF-equivalent named cases share one checkpoint.
    const trail: FlowState[] = [];
    for (const state of states) {
      const returnedTo = trail.findLastIndex(previous => previous.key === state.key
        || (!!state.name && previous.name === state.name));
      if (returnedTo !== -1) trail.splice(returnedTo);
      trail.push(state);
    }
    const visitedNodes = new Set<string>(), visitedEdges = new Set<string>();
    let previous: string | undefined;
    for (const state of trail) {
      if (!state.name || !flow.nodes.some(node => node.name === state.name)) continue;
      visitedNodes.add(state.name);
      if (previous && previous !== state.name) {
        const id = flowEdgeId(previous, state.name);
        if (flow.edges.some(edge => edge.id === id)) visitedEdges.add(id);
      }
      previous = state.name;
    }
    const matches: FlowMatch[] = [];
    const addMatch = (route: PracticeFlowRoute, step: number, remaining: string) => {
      matches.push({ route, step, remaining });
    };
    for (const route of flow.routes) {
      route.states.forEach((state, step) => {
        if (state.key === current.key) {
          addMatch(route, step, `${current.rotation} ${inverse(state.rotation)} ${route.moves.slice(step).join(' ')}`.trim());
        }
      });
      // Half turns may arrive as two separate quarter-turn gestures.
      route.moves.forEach((move, i) => {
        if (!move.includes('2')) return;
        for (const suffix of ['', "'"]) {
          const quarter = move.replace(/2'?$/, suffix);
          const state = reader.read(`${flow.setup} ${route.moves.slice(0, i).join(' ')} ${quarter}`);
          if (state.key === current.key) addMatch(route, i + .5,
            `${current.rotation} ${inverse(state.rotation)} ${quarter} ${route.moves.slice(i + 1).join(' ')}`.trim());
        }
      });
    }
    // A free U/U'/U2 adjustment is the same named case. Re-align to a known
    // checkpoint only for the suggested continuation, never move the user's cube.
    if (!matches.length && current.name && current.name !== 'solved') {
      for (const route of flow.routes) for (const point of route.points) {
        if (point.name !== current.name) continue;
        const target = route.states[point.step];
        const auf = AUFS.find(turn => reader.read(`${flow.setup} ${history} ${current.rotation} ${turn}`).key === target.key);
        if (auf !== undefined) addMatch(route, point.step,
          `${current.rotation} ${auf} ${inverse(target.rotation)} ${route.moves.slice(point.step).join(' ')}`.trim());
      }
    }
    // Different routes can converge on the same intermediate physical state.
    // Follow the last checkpoint actually reached instead of lighting every
    // compatible route. Teaching order remains the tie-breaker within that branch.
    const match = matches.find(candidate => candidate.route.points.findLast(point => point.step <= candidate.step)?.name === previous)
      ?? matches[0];
    const edges = new Map<string, number>();
    if (match) {
      const { route, step } = match;
      const from = route.points.findLast(point => point.step <= step);
      const to = route.points.find(point => point.step > step);
      if (from && to && from.name === previous && step > from.step && current.name !== from.name) {
        edges.set(flowEdgeId(from.name, to.name), (step - from.step) / (to.step - from.step));
      }
    }
    return { current: current.name, match, visitedNodes, visitedEdges, edges };
  } finally { reader.dispose(); }
}
