import { Alg } from 'cubing/alg';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { FM_IGNORED, FM_REGULAR, stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { simplifyAlg } from '@cuberoot/shared/recon/cube3';
import { resolveSimPreviewMoves } from '@/components/AlgPlayer/player-setup';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import { F2L_CASES } from '../data/basic-cases';
import { f2lDiagramFacelets, f2lPlaybackSections } from './cube-preview';
import algSnapshot from '../data/alg-snapshot.json';

const GROUP_NAMES: Record<string, { zh: string; en: string }> = {
  'Free Pairs': { zh: '自由棱角对', en: 'Free pairs' },
  'Disconnected Pairs': { zh: '分离的棱角对', en: 'Disconnected pairs' },
  'Connected Pairs': { zh: '连接的棱角对', en: 'Connected pairs' },
  'Corner In Slot': { zh: '角在槽内', en: 'Corner in slot' },
  'Edge In Slot': { zh: '棱在槽内', en: 'Edge in slot' },
  'Pieces In Slot': { zh: '棱角都在槽内', en: 'Pieces in slot' },
};
export function f2lGroupName(group: string) {
  return Object.entries(GROUP_NAMES).find(([key]) => key.toLowerCase() === group.toLowerCase())?.[1]
    ?? { zh: group, en: group };
}

// Formula edits belong in alg-snapshot.json; optional chapter choices stay local too.
export const F2L_TEACHING_OVERRIDES: Record<string, { chapter?: 8 | 9 }> = {};

export function f2lCatalogCases() {
  const file = algSnapshot;
  if (file.cases.length !== 41 || new Set(file.cases.map(c => c.name)).size !== 41) {
    throw new Error('Expected the 41 distinct standard F2L cases');
  }
  return file.cases.filter(c => !F2L_CASES.some(basic => basic.name === c.name)).map(c => {
    const first = c.algs[0]?.[0];
    if (!first) throw new Error(`Missing FR algorithm: ${c.name}`);
    // Keep the captured FR setup: inverting an alg with regrips alone can put
    // the starting case in the wrong slot or center orientation.
    return { name: c.name, group: c.subgroup, alg: first.alg, setup: c.setup };
  });
}
export type CatalogCase = ReturnType<typeof f2lCatalogCases>[number];

const SLOTS = [
  { rotation: '', corner: [29, 26, 15], edge: [23, 12] },
  { rotation: "y'", corner: [27, 44, 24], edge: [21, 41] },
  { rotation: 'y2', corner: [33, 53, 42], edge: [50, 39] },
  { rotation: 'y', corner: [35, 17, 51], edge: [48, 14] },
];
const mask = stickeringMaskFn(3, 'F2LPair')!;
const shownPair = (cube: Cube, initial: number) => cube.serializeStickering(piece => piece === initial ? FM_REGULAR : FM_IGNORED);
function wrongSlots(cube: Cube) {
  const corner = shownPair(cube, 20), edge = shownPair(cube, 23);
  return {
    corner: SLOTS.findIndex(slot => slot.corner.some(i => corner[i] === FM_REGULAR)),
    edge: SLOTS.findIndex(slot => slot.edge.some(i => edge[i] === FM_REGULAR)),
  };
}
function protectedStructure(cube: Cube) {
  const state = cube.serialize();
  // The full cross and the other three pairs must be solved before a standard case is taught.
  const cross = cube.serializeStickering(initial => {
    const x = initial % 3, y = Math.floor(initial / 3) % 3, z = Math.floor(initial / 9);
    return y === 0 && ((x === 1) !== (z === 1)) ? FM_REGULAR : FM_IGNORED;
  });
  return [...cross].every((value, i) => value !== FM_REGULAR || state[i] === state[Math.floor(i / 9) * 9 + 4])
    && SLOTS.slice(1).every(slot => [...slot.corner, ...slot.edge].every(i => state[i] === state[Math.floor(i / 9) * 9 + 4]));
}
function pairKey(cube: Cube) {
  const state = cube.serialize(), masks = cube.serializeStickering(mask);
  return [...state].map((color, i) => masks[i] === FM_REGULAR ? color : '-').join('');
}

/** Rotationless extraction using only comfortable side faces. The mechanical
 * lesson stays separate; this searches only slots holding a misplaced target. */
export function f2lSmartExtraction(setup: string): string {
  const cube = new Cube(3);
  const openings = [
    { slot: 3, open: "R'", close: 'R' },
    { slot: 2, open: 'L', close: "L'" },
    { slot: 1, open: 'F', close: "F'" },
    { slot: 1, open: "L'", close: 'L' },
  ];
  const queue: { parts: string[]; alg: string; score: number }[] = [{ parts: [], alg: '', score: 0 }];
  const visited = new Map<string, number>();
  try {
    while (queue.length) {
      queue.sort((a, b) => a.score - b.score);
      const current = queue.shift()!;
      cube.twister.setup(setup + ' ' + current.alg);
      const key = pairKey(cube);
      if ((visited.get(key) ?? Infinity) <= current.score) continue;
      visited.set(key, current.score);
      const slots = wrongSlots(cube);
      if (slots.corner <= 0 && slots.edge <= 0) {
        const raw = current.parts.join(' ');
        // Keep extraction boundaries when possible; merged moves form one segment.
        return current.alg === raw ? current.parts.map(part => `(${part})`).join(' ') : `(${current.alg})`;
      }
      if (current.parts.length >= 3) continue;
      for (const opening of openings) {
        if (slots.corner !== opening.slot && slots.edge !== opening.slot) continue;
        for (const top of ["U'", 'U', 'U2']) {
          const parts = [...current.parts, `${opening.open} ${top} ${opening.close}`];
          const alg = simplifyAlg(parts.join(' '));
          const moves = resolveSimPreviewMoves('3x3', alg);
          // Fewer moves first; prefer quarter turns over half turns at equal length.
          const score = moves.length * 100 + moves.filter(move => move.includes('2')).length * 10;
          queue.push({ parts, alg, score });
        }
      }
    }
    throw new Error('No rotationless extraction found for this example');
  } finally { cube.dispose(); }
}

/** Representative states are constructed and checked using real legal moves. */
export function f2lNonstandardExamples(perKind = 1) {
  const cube = new Cube(3);
  const selected = new Map<string, { kind: string; setup: string; alg: string }[]>();
  const seen = new Set<string>();
  const kinds = ['edge', 'corner', 'together', 'apart'];
  const result = () => kinds.flatMap(kind => selected.get(kind) ?? []);
  const turns = ['', 'U', 'U2', "U'"];
  const triggers = ["R U R'", "R U' R'"];
  const slotTriggers = SLOTS.slice(1).flatMap(slot => triggers.map(trigger =>
    [slot.rotation, trigger, new Alg(slot.rotation).invert().toString()].join(' ')));
  const category = () => {
    const { corner, edge } = wrongSlots(cube);
    if (corner > 0 && edge > 0) return corner === edge ? 'together' : 'apart';
    if (corner > 0) return 'corner';
    if (edge > 0) return 'edge';
    return null;
  };
  try {
    for (const first of triggers) for (const top of turns) for (const second of slotTriggers)
      for (const last of ['', ...turns.flatMap(u => slotTriggers.map(t => u + ' ' + t))]) {
        const setup = [first, top, second, last].join(' ');
        cube.twister.setup(setup);
        const kind = category();
        if (!kind || (selected.get(kind)?.length ?? 0) >= perKind) continue;
        const initialKey = pairKey(cube);
        if (seen.has(initialKey)) continue;
        const sections: string[] = [];
        for (let pass = 0; pass < 3; pass++) {
          const slots = wrongSlots(cube);
          const index = slots.corner > 0 ? slots.corner : slots.edge > 0 ? slots.edge : -1;
          if (index < 0) break;
          const rotation = SLOTS[index].rotation;
          const add = (alg: string) => { sections.push(`(${alg})`); cube.twister.setup([setup, ...sections].join(' ')); };
          add(rotation);
          for (let attempt = 0; attempt < 2; attempt++) {
            if (wrongSlots(cube).corner !== 0 && wrongSlots(cube).edge !== 0) break;
            add("R U R'");
          }
          add(new Alg(rotation).invert().toString());
        }
        const end = wrongSlots(cube);
        if (end.corner <= 0 && end.edge <= 0) {
          selected.set(kind, [...(selected.get(kind) ?? []), { kind, setup, alg: sections.join(' ') }]);
          seen.add(initialKey);
        }
        if (kinds.every(kind => (selected.get(kind)?.length ?? 0) >= perKind)) return result();
      }
    if (selected.size === 4) return result();
    throw new Error('Could not construct the four non-standard examples');
  } finally { cube.dispose(); }
}

/** Match local pair states modulo top-layer turns, while requiring the other slots and cross solved. */
export function f2lTeachingPaths(cases: CatalogCase[]) {
  const cube = new Cube(3);
  const lookup = new Map<string, string>();
  const basics = new Set(F2L_CASES.map(c => c.name as string));
  const corrections = new Map<string, string>();
  const normalize = (source: string) => {
    cube.twister.setup(source);
    const state = cube.serialize();
    const centers = [4, 13, 22, 31, 40, 49].map(i => state[i]).join('');
    if (!corrections.has(centers)) {
      const option = CUBE_ORIENTATIONS.find(option => {
        cube.twister.setup(source + ' ' + option.value);
        const candidate = cube.serialize();
        return [4, 13, 22, 31, 40, 49].every(i => candidate[i] === 'URFDLB'[Math.floor(i / 9)]);
      });
      if (!option) return false;
      corrections.set(centers, option.value);
    }
    cube.twister.setup(source + ' ' + corrections.get(centers));
    return true;
  };
  const all = [...F2L_CASES.map(c => ({ name: c.name, setup: new Alg(c.alg).invert().toString() })), ...cases];
  try {
    for (const c of all) for (const u of ['', 'U', 'U2', "U'"]) {
      if (normalize(c.setup + ' ' + u)) lookup.set(pairKey(cube), c.name);
    }
    const result = cases.map(c => {
      const moves = resolveSimPreviewMoves('3x3', c.alg);
      const points: { step: number; name: string }[] = [];
      for (let step = 1; step < moves.length; step++) {
        const source = c.setup + ' ' + moves.slice(0, step).join(' ');
        // Regrips are inspection-only here: the executable algorithm is never altered.
        if (!normalize(source)) continue;
        if (!protectedStructure(cube)) continue;
        const name = lookup.get(pairKey(cube));
        if (name && name !== c.name) points.push({ step, name });
      }
      const basic = points.find(point => point.step === moves.length - 3 && basics.has(point.name));
      return { ...c, moves, points, basic, chapter: basic ? 8 : null };
    });
    const verified = new Set(result.filter(c => c.basic).map(c => c.name));
    const easy = new Set(result.filter(c => c.basic && (F2L_TEACHING_OVERRIDES[c.name]?.chapter === 8
      || (F2L_TEACHING_OVERRIDES[c.name]?.chapter !== 9 && !c.points.some(point =>
        point.step < c.basic!.step && verified.has(point.name))))).map(c => c.name));
    return result.map(c => {
      const intermediate = c.points.find(point => easy.has(point.name));
      // Prefer a meaningful intermediate standard case before reaching the basic case.
      const override = F2L_TEACHING_OVERRIDES[c.name]?.chapter;
      const hasIntermediate = !!(intermediate && c.basic && intermediate.step < c.basic.step);
      const chapter: 8 | 9 | null = c.basic
        ? override === 9 ? (hasIntermediate ? 9 : null)
          : override === 8 ? 8 : hasIntermediate ? 9 : 8
        : null;
      const boundaries = [chapter === 9 ? intermediate?.step : undefined, c.basic?.step].filter((s): s is number => s !== undefined);
      const segments = boundaries.concat(c.moves.length).map((end, i) => `(${c.moves.slice(i ? boundaries[i - 1] : 0, end).join(' ')})`).join(' ');
      return { ...c, chapter, alg: segments, sections: f2lPlaybackSections(segments), chain: [c.name, ...(chapter === 9 && intermediate ? [intermediate.name] : []), ...(c.basic ? [c.basic.name] : [])] };
    });
  } finally { cube.dispose(); }
}

export function f2lCatalogDiagrams(cases: CatalogCase[], orientation: string) {
  return cases.map(c => ({ ...c, facelets: f2lDiagramFacelets(c.setup, orientation) }));
}
