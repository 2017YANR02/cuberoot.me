import { applySq1Move, isSlashValid, parseSq1Scramble, solvedSq1 } from '@cuberoot/puzzle-render-core/engine/sq1/sq1State';

export const SPACE_KEY = 'cuberoot.space.v1';
export const MAX_OBJECTS = 64;
export const SPACE_LIMIT = 32;
export const SCALE_MIN = 0.04;
export const SCALE_MAX = 2.5;
export const ROOMS = {
  minimal: { zh: '镜面简约', en: 'Mirror minimal' },
  cyberpunk: { zh: '赛博朋克', en: 'Cyberpunk' },
  modern: { zh: '现代住宅', en: 'Modern residence' },
  vintage: { zh: '复古宅邸', en: 'Vintage residence' },
  italian: { zh: '意大利别墅', en: 'Italian villa' },
  penthouse: { zh: '纽约顶层公寓', en: 'New York penthouse' },
  japanese: { zh: '日式庭院', en: 'Japanese courtyard' },
  company: { zh: '我的公司', en: 'My company' },
} as const;
export type RoomStyle = keyof typeof ROOMS;
export const DESTINATIONS = {
  exterior: { zh: '建筑外观', en: 'Exterior' },
  interior: { zh: '客厅', en: 'Living room' },
  study: { zh: '书房', en: 'Study' },
  bedroom: { zh: '卧室', en: 'Bedroom' },
  bathroom: { zh: '卫生间', en: 'Bathroom' },
  courtyard: { zh: '庭院', en: 'Courtyard' },
} as const;
export type Destination = keyof typeof DESTINATIONS;
export type Level = 0 | 1;
export const UPPER_FLOOR = 5;
// One physical plan drives floor geometry, placement and camera limits in every style.
export const VILLA_ROOMS = {
  interior: { x: 0, z: 0, width: 20, depth: 18, level: 0, ceiling: 7.8 },
  study: { x: -23, z: 2, width: 12, depth: 16, level: 0, ceiling: 4.75 },
  bedroom: { x: -23, z: 3, width: 12, depth: 14, level: 1, ceiling: 9.4 },
  bathroom: { x: -23, z: -10, width: 12, depth: 12, level: 1, ceiling: 9.4 },
  gallery: { x: -9.5, z: -12.5, width: 39, depth: 7, level: 0, ceiling: 4.75 },
  bridge: { x: -9.5, z: -12.5, width: 15, depth: 7, level: 1, ceiling: 9.4 },
} as const;
export const PUZZLES = {
  '222': { zh: '二阶魔方', en: '2×2 Cube', icon: 'event-222' },
  '333': { zh: '三阶魔方', en: '3×3 Cube', icon: 'event-333' },
  '444': { zh: '四阶魔方', en: '4×4 Cube', icon: 'event-444' },
  '555': { zh: '五阶魔方', en: '5×5 Cube', icon: 'event-555' },
  mirror: { zh: '镜面魔方', en: 'Mirror Cube', icon: 'event-333' },
  sq1: { zh: 'Square-1', en: 'Square-1', icon: 'event-sq1' },
  pyram: { zh: '金字塔', en: 'Pyraminx', icon: 'event-pyram' },
  minx: { zh: '五魔方', en: 'Megaminx', icon: 'event-minx' },
  skewb: { zh: '斜转', en: 'Skewb', icon: 'event-skewb' },
} as const;
export type PuzzleKind = keyof typeof PUZZLES;
export type Vec3 = [number, number, number];
export type SpaceObject = {
  id: string;
  kind: PuzzleKind;
  position: [number, number];
  rotation: Vec3;
  scale: number;
  level?: Level;
  moves?: string[];
};
export type Layout = { version: 1; room?: RoomStyle; objects: SpaceObject[] };
export type History = { past: Layout[]; current: Layout; future: Layout[] };

// Layouts contain data only. Models, GPU resources and selection never enter history.
export const INITIAL_LAYOUT: Layout = {
  version: 1,
  objects: [
    { id: 'initial-333', kind: '333', position: [0, 0], rotation: [0, 0.2, 0], scale: 1.15 },
    { id: 'initial-222', kind: '222', position: [-3.4, 1.8], rotation: [0, -0.2, 0], scale: 0.85 },
    { id: 'initial-mirror', kind: 'mirror', position: [-3.5, -2], rotation: [0, 0.3, 0], scale: 0.85 },
    { id: 'initial-minx', kind: 'minx', position: [3.6, -1.4], rotation: [0, 0.2, 0], scale: 1 },
    { id: 'initial-444', kind: '444', position: [3.6, 2.1], rotation: [0, -0.2, 0], scale: 0.85 },
    { id: 'initial-pyram', kind: 'pyram', position: [0, -3.7], rotation: [0, 0, 0], scale: 1 },
  ],
};

export const PEDESTALS = [
  { x: 0, z: 0, width: 3.1, depth: 3.1, height: 0.55, level: 0 },
  { x: -3.5, z: -2, width: 2.5, depth: 2.5, height: 1.1, level: 0 },
  { x: 3.6, z: -1.4, width: 2.6, depth: 2.6, height: 0.3, level: 0 },
] as const;

export function floorHeight(x: number, z: number, level: Level) {
  return Object.values(VILLA_ROOMS).some(r => r.level === level && Math.abs(x - r.x) <= r.width / 2 && Math.abs(z - r.z) <= r.depth / 2)
    ? level * UPPER_FLOOR : -0.32;
}

export function isPuzzleKind(value: unknown): value is PuzzleKind {
  return typeof value === 'string' && Object.hasOwn(PUZZLES, value);
}

export function validSpaceMove(kind: PuzzleKind, move: string) {
  if (move.length > 12) return false;
  if (kind === 'sq1') return /^(\/|\(-?[0-6],-?[0-6]\))$/.test(move);
  if (kind === 'pyram') return /^(?:[ULRBulrb]|[DLRF]w)'?$/.test(move);
  if (kind === 'minx') return /^(?:BL|BR|BF|[UFLRCAIED])'?$/.test(move);
  if (kind === 'skewb') return /^(?:UL|UR|[RULBFD])'?$/.test(move);
  return /^(?:[2-5]?[RLUDFB]w?)'?$/.test(move) && (!/^[2-5]/.test(move) || Number(move[0]) <= (kind === 'mirror' ? 3 : Number(kind[0])));
}

export function parseLayout(text: string): Layout {
  if (text.length > 128_000) throw new Error('size');
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 ||
    !('objects' in data) || !Array.isArray(data.objects) || data.objects.length > MAX_OBJECTS) throw new Error('layout');
  if ('room' in data && (typeof data.room !== 'string' || !Object.hasOwn(ROOMS, data.room))) throw new Error('room');
  const ids = new Set<string>();
  const vector = (v: unknown, n: number, max: number): v is number[] =>
    Array.isArray(v) && v.length === n && v.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= max);
  const objects = data.objects.map((o: unknown): SpaceObject => {
    if (!o || typeof o !== 'object') throw new Error('object');
    const v = o as Record<string, unknown>;
    if (typeof v.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v.id) || ids.has(v.id) ||
      !isPuzzleKind(v.kind) || !vector(v.position, 2, SPACE_LIMIT) || !vector(v.rotation, 3, Math.PI * 2) ||
      typeof v.scale !== 'number' || !Number.isFinite(v.scale) || v.scale < SCALE_MIN || v.scale > SCALE_MAX) throw new Error('object');
    if ('level' in v && v.level !== 0 && v.level !== 1) throw new Error('level');
    if ('moves' in v && (!Array.isArray(v.moves) || v.moves.length > 2000 || v.moves.some(m => typeof m !== 'string' || !validSpaceMove(v.kind as PuzzleKind, m)))) throw new Error('moves');
    if (v.kind === 'sq1' && Array.isArray(v.moves)) {
      let state = solvedSq1();
      for (const move of parseSq1Scramble(v.moves.join(' '))) {
        if (move.kind === 'slice' && !isSlashValid(state)) throw new Error('moves');
        state = applySq1Move(state, move);
      }
    }
    ids.add(v.id);
    return { id: v.id, kind: v.kind, position: [...v.position] as [number, number], rotation: [...v.rotation] as Vec3, scale: v.scale, ...('level' in v ? { level: v.level as Level } : {}), ...('moves' in v ? { moves: [...v.moves as string[]] } : {}) };
  });
  return { version: 1, ...('room' in data ? { room: data.room as RoomStyle } : {}), objects };
}

export function commitLayout(history: History, next: Layout): History {
  if (JSON.stringify(history.current) === JSON.stringify(next)) return history;
  return { past: [...history.past.slice(-99), history.current], current: next, future: [] };
}

export function travelHistory(history: History, direction: 'undo' | 'redo'): History {
  if (direction === 'undo') {
    const previous = history.past.at(-1);
    return previous ? { past: history.past.slice(0, -1), current: previous, future: [history.current, ...history.future] } : history;
  }
  const next = history.future[0];
  return next ? { past: [...history.past, history.current], current: next, future: history.future.slice(1) } : history;
}

export function movePosition(position: [number, number], snap: boolean): [number, number] {
  return position.map(v => Math.max(-SPACE_LIMIT, Math.min(SPACE_LIMIT, snap ? Math.round(v * 2) / 2 : v))) as [number, number];
}
