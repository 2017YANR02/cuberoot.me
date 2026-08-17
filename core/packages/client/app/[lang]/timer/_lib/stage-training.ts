/**
 * Cross-family training shared logic.
 *
 * The Rust solver numbers its six views by the rotation that puts the chosen
 * cross on D: D, U, L, R, F, B. Slot numbers are then the familiar
 * BL, BR, FR, FL positions in that view. Smart-cube judging must use exactly
 * the same convention or a fixed-slot question can be solved in the UI while
 * the engine still considers it unsolved.
 */

import { faceletToCubie, type CubieCube } from '@/lib/cube-facelet';
import { orientationXform } from '@/app/[lang]/sim/engine/nxn/stickering';
import { FACE_EDGES, FACE_LETTERS, f2lSlots, type FaceIdx } from '@/lib/cross-trainer/model';

export type StageTrainingStage = 'cross' | 'xcross' | 'xxcross' | 'xxxcross';
export type StageTrainingMode = 'plan' | 'guess' | 'smart';
export type StageScrambleStyle = 'current' | 'optimal' | 'plus-one' | 'fixed';
export type SmartTrainingMode = 'virtual' | 'physical';
export type StageSlot = number | 'best';

export interface StageTrainingConfig {
  stage: StageTrainingStage;
  /** SubsetColorPicker key: W / WY / BGORWY, etc. */
  colors: string;
  /** Index into stageSlotCombos(stage), or best across every combination. */
  slot: StageSlot;
}

export interface StageQuestion {
  scramble: string;
  scrambleLength: number;
  optimal: number;
  /** Rotation-free HTM solution. */
  solution: string;
  /** Rust view index (D, U, L, R, F, B). */
  face: number;
  /** Solver slot label, e.g. "FR" or "BL FR". */
  combo: string;
}

export interface StageTrainingMask {
  name: 'Cross' | 'xcross' | 'xxcross' | 'xxcross_diag' | 'xxxcross';
  orientation: string;
}

export const STAGE_ORDER: StageTrainingStage[] = ['cross', 'xcross', 'xxcross', 'xxxcross'];

export const STAGE_FIXED_LENGTH: Record<StageTrainingStage, number> = {
  cross: 8,
  xcross: 10,
  xxcross: 12,
  xxxcross: 12,
};

export const STAGE_PAIR_COUNT: Record<StageTrainingStage, number> = {
  cross: 0,
  xcross: 1,
  xxcross: 2,
  xxxcross: 3,
};

const choose = (k: number): number[][] => {
  const out: number[][] = [];
  const visit = (start: number, current: number[]) => {
    if (current.length === k) {
      out.push([...current]);
      return;
    }
    for (let i = start; i < 4; i++) {
      current.push(i);
      visit(i + 1, current);
      current.pop();
    }
  };
  visit(0, []);
  return out;
};

const COMBOS: Record<StageTrainingStage, number[][]> = {
  cross: [[]],
  xcross: choose(1),
  xxcross: choose(2),
  xxxcross: choose(3),
};

export const STAGE_SLOT_LABELS = ['BL', 'BR', 'FR', 'FL'] as const;

export function stageSlotCombos(stage: StageTrainingStage): number[][] {
  return COMBOS[stage].map((combo) => [...combo]);
}

export function stageSlotLabel(stage: StageTrainingStage, option: number): string {
  const combo = COMBOS[stage][option] ?? COMBOS[stage][0] ?? [];
  return combo.map((slot) => STAGE_SLOT_LABELS[slot]).join('+');
}

/** Invalid/multi-colour fixed slots have no shared physical meaning, so use best. */
export function effectiveStageSlot(config: StageTrainingConfig): StageSlot {
  if (config.stage === 'cross' || config.colors.length !== 1) return 'best';
  const options = COMBOS[config.stage];
  return config.slot !== 'best' && config.slot >= 0 && config.slot < options.length
    ? config.slot
    : 'best';
}

const COLOR_TO_SOLVER_FACE: Record<string, number> = {
  Y: 0,
  W: 1,
  O: 2,
  R: 3,
  G: 4,
  B: 5,
};

/** Selected colour subset -> Rust view indices, with unknown/duplicate letters removed. */
export function solverFacesForColors(colors: string): number[] {
  const seen = new Set<number>();
  for (const color of colors.toUpperCase()) {
    const face = COLOR_TO_SOLVER_FACE[color];
    if (face !== undefined) seen.add(face);
  }
  return [...seen];
}

export function countFaceMoves(alg: string): number {
  return alg.trim().split(/\s+/).filter((token) => /^[URFDLB](?:2|'|2')?$/.test(token)).length;
}

export function invertFaceAlg(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).reverse().map((token) => {
    if (token.endsWith('2') || token.endsWith("2'")) return token.replace("2'", '2');
    return token.endsWith("'") ? token.slice(0, -1) : `${token}'`;
  }).join(' ');
}

const SCRAMBLE_FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
const OPPOSITE: Record<string, string> = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };
const SUFFIXES = ['', '2', "'"] as const;

/** Canonical random-move sequence with exactly `length` HTM tokens. */
export function randomFaceScramble(length: number, rng: () => number = Math.random): string {
  const target = Math.max(0, Math.floor(length));
  const out: string[] = [];
  let last = '';
  let previous = '';
  while (out.length < target) {
    // Pick from the legal set instead of retrying random faces, so even a
    // deterministic or broken RNG cannot trap question generation in a loop.
    const allowed = SCRAMBLE_FACES.filter((face) => (
      face !== last
      // Keep one canonical order for opposite-face sandwiches: U D U is redundant as a generator word.
      && !(previous === face && OPPOSITE[face] === last)
    ));
    const face = allowed[Math.floor(rng() * allowed.length) % allowed.length];
    out.push(face + SUFFIXES[Math.floor(rng() * SUFFIXES.length) % SUFFIXES.length]);
    previous = last;
    last = face;
  }
  return out.join(' ');
}

/** Add one non-merging HTM turn, preserving `base length + 1`. */
export function appendRandomFaceMove(base: string, rng: () => number = Math.random): string {
  const tokens = base.trim().split(/\s+/).filter(Boolean);
  const lastFace = tokens.at(-1)?.[0] ?? '';
  const previousFace = tokens.at(-2)?.[0] ?? '';
  const faces = SCRAMBLE_FACES.filter((face) => (
    face !== lastFace
    && !(face === previousFace && OPPOSITE[face] === lastFace)
  ));
  const face = faces[Math.floor(rng() * faces.length) % faces.length];
  const suffix = SUFFIXES[Math.floor(rng() * SUFFIXES.length) % SUFFIXES.length];
  return [...tokens, face + suffix].join(' ');
}

// Rust view index -> physical Kociemba face (U,R,F,D,L,B = 0..5).
const SOLVER_FACE_TO_PHYSICAL: FaceIdx[] = [3, 0, 4, 1, 2, 5];
type FaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
const PHYSICAL_FACE: Record<FaceLetter, FaceIdx> = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
const VIEW_ROTATION = ['', 'z2', "z'", 'z', "x'", 'x'] as const;
const POSITIONS: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];
const ROT_SOURCE: Record<string, Partial<Record<FaceLetter, FaceLetter>>> = {
  x: { U: 'F', F: 'D', D: 'B', B: 'U' },
  "x'": { U: 'B', B: 'D', D: 'F', F: 'U' },
  z: { U: 'L', L: 'D', D: 'R', R: 'U' },
  "z'": { U: 'R', R: 'D', D: 'L', L: 'U' },
  z2: { U: 'D', D: 'U', L: 'R', R: 'L' },
};
const SLOT_SIDES: Array<[FaceLetter, FaceLetter]> = [
  ['B', 'L'],
  ['R', 'B'],
  ['F', 'R'],
  ['L', 'F'],
];

function physicalSidesForView(solverFace: number): Record<FaceLetter, FaceLetter> {
  let orientation = Object.fromEntries(POSITIONS.map((face) => [face, face])) as Record<FaceLetter, FaceLetter>;
  const rotation = VIEW_ROTATION[solverFace] ?? '';
  if (!rotation) return orientation;
  const source = ROT_SOURCE[rotation];
  const next = { ...orientation };
  for (const position of POSITIONS) next[position] = orientation[source[position] ?? position];
  orientation = next;
  return orientation;
}

/** Rust BL/BR/FR/FL slot -> physical slot index in f2lSlots(crossFace). */
function physicalSlotIndex(solverFace: number, solverSlot: number): number {
  const crossFace = SOLVER_FACE_TO_PHYSICAL[solverFace] ?? SOLVER_FACE_TO_PHYSICAL[0];
  const orientation = physicalSidesForView(solverFace);
  const [aPosition, bPosition] = SLOT_SIDES[solverSlot] ?? SLOT_SIDES[0];
  const a = PHYSICAL_FACE[orientation[aPosition]];
  const b = PHYSICAL_FACE[orientation[bPosition]];
  return f2lSlots(crossFace).findIndex((slot) => FACE_EDGES[a].includes(slot.edge) && FACE_EDGES[b].includes(slot.edge));
}

// /sim face ids are L,R,D,U,B,F; the solver/model uses U,R,F,D,L,B.
const SIM_FACE_BY_PHYSICAL = [3, 1, 5, 2, 0, 4] as const;
const PHYSICAL_FACE_BY_SIM = [4, 1, 3, 0, 5, 2] as const;
const ORIENTATION_PREFIXES = [
  '', 'y', 'y2', "y'",
  'x', 'x y', 'x y2', "x y'",
  'x2', 'x2 y', 'x2 y2', "x2 y'",
  "x'", "x' y", "x' y2", "x' y'",
  'z', 'z y', 'z y2', "z y'",
  "z'", "z' y", "z' y2", "z' y'",
] as const;

const CANONICAL_SLOT_INDEX = Object.fromEntries(
  f2lSlots(3).map((slot, index) => [slot.name, index]),
) as Record<string, number>;
const FACE_INDEX = Object.fromEntries(FACE_LETTERS.map((face, index) => [face, index])) as Record<string, number>;

function physicalFaceMap(orientation: string): number[] {
  const simMap = orientationXform(orientation).facePerm;
  return SIM_FACE_BY_PHYSICAL.map((simFace) => PHYSICAL_FACE_BY_SIM[simMap[simFace]]);
}

function mappedCanonicalSlot(slotName: string, faceMap: number[]): number {
  const mappedName = [...slotName]
    .map((face) => faceMap[FACE_INDEX[face]])
    .sort((a, b) => a - b)
    .map((face) => FACE_LETTERS[face])
    .join('');
  const entry = Object.entries(CANONICAL_SLOT_INDEX).find(([name]) => (
    [...name].sort().join('') === [...mappedName].sort().join('')
  ));
  return entry?.[1] ?? -1;
}

function solverComboSlots(combo: string): number[] {
  return (combo.match(/(?:BL|BR|FR|FL)/g) ?? [])
    .map((name) => STAGE_SLOT_LABELS.indexOf(name as typeof STAGE_SLOT_LABELS[number]))
    .filter((slot) => slot >= 0);
}

/** The exact /sim stage mask for the colour and slot combination chosen by the solver. */
export function stageTrainingMask(question: Pick<StageQuestion, 'face' | 'combo'>, stage: StageTrainingStage): StageTrainingMask {
  const solverSlots = solverComboSlots(question.combo);
  const physicalFace = SOLVER_FACE_TO_PHYSICAL[question.face] ?? SOLVER_FACE_TO_PHYSICAL[0];
  const physicalSlots = solverSlots.map((solverSlot) => physicalSlotIndex(question.face, solverSlot));

  let name: StageTrainingMask['name'] = 'Cross';
  let canonicalSlots: number[] = [];
  if (stage === 'xcross') {
    name = 'xcross';
    canonicalSlots = [0]; // FR
  } else if (stage === 'xxcross') {
    const diagonal = solverSlots.length === 2 && Math.abs(solverSlots[0] - solverSlots[1]) === 2;
    name = diagonal ? 'xxcross_diag' : 'xxcross';
    canonicalSlots = diagonal ? [0, 2] : [0, 1]; // FR+BL or FR+FL
  } else if (stage === 'xxxcross') {
    name = 'xxxcross';
    canonicalSlots = [1, 2, 3]; // every D slot except FR
  }

  const wanted = [...canonicalSlots].sort((a, b) => a - b).join(',');
  const orientation = ORIENTATION_PREFIXES.find((prefix) => {
    const faceMap = physicalFaceMap(prefix);
    if (faceMap[physicalFace] !== 3) return false;
    if (canonicalSlots.length === 0) return true;
    if (physicalSlots.length !== canonicalSlots.length || physicalSlots.some((slot) => slot < 0)) return false;
    const mapped = physicalSlots
      .map((slot) => mappedCanonicalSlot(f2lSlots(physicalFace)[slot]?.name ?? '', faceMap))
      .sort((a, b) => a - b)
      .join(',');
    return mapped === wanted;
  });

  // A solver combo is expected for every XCross-family answer. If an older
  // worker omits it, still place the right-shaped mask on the right cross face.
  const faceOnly = ORIENTATION_PREFIXES.find((prefix) => physicalFaceMap(prefix)[physicalFace] === 3) ?? '';
  return { name, orientation: orientation ?? faceOnly };
}

/** Stage masks for every candidate the current colour selection allows.
 *  Multi-colour auto-slot questions must not hide the losing colours or reveal
 *  the winning colour/slot before the answer is shown. */
export function stageTrainingMasks(
  question: Pick<StageQuestion, 'face' | 'combo'>,
  stage: StageTrainingStage,
  colors: string,
): StageTrainingMask[] {
  const faces = solverFacesForColors(colors);
  if (faces.length <= 1) return [stageTrainingMask(question, stage)];
  if (stage === 'cross') {
    return faces.map((face) => stageTrainingMask({ face, combo: '' }, stage));
  }
  return faces.flatMap((face) => COMBOS[stage].map((combo) => stageTrainingMask({
    face,
    combo: combo.map((slot) => STAGE_SLOT_LABELS[slot]).join(' '),
  }, stage)));
}

const solvedEdge = (cube: CubieCube, edge: number) => cube.ep[edge] === edge && cube.eo[edge] === 0;
const solvedCorner = (cube: CubieCube, corner: number) => cube.cp[corner] === corner && cube.co[corner] === 0;

function frameSolved(cube: CubieCube, solverFace: number, config: StageTrainingConfig): boolean {
  const physicalFace = SOLVER_FACE_TO_PHYSICAL[solverFace];
  if (physicalFace === undefined || !FACE_EDGES[physicalFace].every((edge) => solvedEdge(cube, edge))) return false;
  const need = STAGE_PAIR_COUNT[config.stage];
  if (need === 0) return true;

  const slots = f2lSlots(physicalFace);
  const solvedSlots = slots.map((slot) => solvedCorner(cube, slot.corner) && solvedEdge(cube, slot.edge));
  const fixed = effectiveStageSlot(config);
  if (fixed === 'best') return solvedSlots.filter(Boolean).length >= need;
  const combo = COMBOS[config.stage][fixed] ?? [];
  return combo.length === need && combo.every((solverSlot) => {
    const physicalSlot = physicalSlotIndex(solverFace, solverSlot);
    return physicalSlot >= 0 && solvedSlots[physicalSlot];
  });
}

/** Same colour/slot goal union used by the optimal solver, for live smart-cube judging. */
export function isStageTrainingSolved(facelets: string, config: StageTrainingConfig): boolean {
  let cube: CubieCube;
  try {
    cube = faceletToCubie(facelets);
  } catch {
    return false;
  }
  return solverFacesForColors(config.colors).some((face) => frameSolved(cube, face, config));
}
