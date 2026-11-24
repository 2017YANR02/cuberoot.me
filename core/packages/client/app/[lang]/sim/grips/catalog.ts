import { convertAction, TwistAction } from '../engine/nxn/nxnNotation';
import type { GripName } from '../engine/hands/handsRig';

export const grips = {
  home: ['中握', 'Home', '·'],
  up: ['上握', 'Up', '↑'],
  down: ['下握', 'Down', '↓'],
  half: ['向上半转握', 'Half up', '↑↑'],
  halfDown: ['向下半转握', 'Half down', '↓↓'],
} as const satisfies Record<GripName, readonly [string, string, string]>;

export const gripNames = Object.keys(grips) as GripName[];
export const moveGroups = [
  { zh: '外层', en: 'Face turns', bases: ['U', 'R', 'F', 'D', 'L', 'B'] },
  { zh: '宽层', en: 'Wide turns', bases: ['Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw'] },
  { zh: '中层', en: 'Slice turns', bases: ['M', 'E', 'S'] },
  { zh: '整体', en: 'Rotations', bases: ['x', 'y', 'z'] },
];
export const suffixes = ['', "'", '2', "2'"];
export const moves = moveGroups.flatMap(group => group.bases.flatMap(base => suffixes.map(suffix => base + suffix)));

export type AtlasOrder = 2 | 3 | 4;
const [faces, wide, slices, rotations] = moveGroups;
const inner = { zh: '单内层', en: 'Inner layers', bases: faces.bases.map(face => '2' + face) };
const triple = { zh: '三层宽转', en: 'Three-layer turns', bases: faces.bases.map(face => '3' + face + 'w') };

function catalog(order: AtlasOrder, groups: typeof moveGroups) {
  const moves = groups.flatMap(group => group.bases.flatMap(base => suffixes.map(suffix => base + suffix)));
  const signature = (move: string) => convertAction(new TwistAction(move), order)
    .map(turn => [turn.axis, turn.layer, turn.twist].join('/')).sort().join(',');
  const byLayers = new Map(moves.map(move => [signature(move), move]));
  function resolve(input: string) {
    if (moves.includes(input)) return input;
    const token = input.trim().replace(/[’′]/g, "'");
    const match = /^(?:(\d)(?:-(\d))?)?([RLUDFBrludfbMESmesxyz])(w)?(?:2'?|'2?)?$/.exec(token);
    if (!match || (match[1] || match[4]) && !/[RLUDFB]/i.test(match[3]) || [match[1], match[2]].some(n => n && (+n < 1 || +n > order))
      || order === 2 && /^[MES]$/i.test(match[3])) return null;
    return byLayers.get(signature(token)) ?? null;
  }
  return { groups, moves, resolve };
}

export const atlasCatalog = {
  2: catalog(2, [faces, rotations]),
  3: catalog(3, moveGroups),
  4: catalog(4, [faces, inner, wide, triple, slices, rotations]),
};

export const demoPhases = {
  loading: ['加载手模中…', 'Loading hands…'], start: ['起手', 'Starting grip'],
  regrip: ['换握中', 'Regripping'], gripped: ['换握就位', 'Grip in place'], prepare: ['准备发力', 'Preparing'], turn: ['转动中', 'Turning'],
  handoff: ['90° · 中指就位', '90° · middle finger ready'],
  settle: ['收手', 'Recovering'], end: ['转动结束', 'Finished'],
  unavailable: ['当前握姿无法完成这一步', 'Gesture unavailable for this grip'],
  error: ['三维手模加载失败', 'Could not load the 3D hands'],
} as const;
