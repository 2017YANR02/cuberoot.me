/*
 * cross-trainer/corpus — the difficulties that are too rare to SAMPLE but small enough to LIST.
 *
 * Every other engine in this library draws: propose a state, measure it, keep it if it lands in
 * the window. That fails at the very top of a multi-colour metric, and it fails by a margin no
 * budget closes. "Six-colour cross, 8 moves" is 40 states out of 980,995,276,800 (p = 4e-11);
 * "six-colour XCross, 10 moves" is 438 out of 4.3e19. Those are not slow draws, they are
 * impossible ones — and the classes are so small that the honest answer is not a faster sampler
 * but an enumeration: name every member, then pick one.
 *
 * Two ways in, one contract (uniform over the whole class):
 *
 *   enumerated  Cross is cheap to close over: the metric reads four edges, and each colour's
 *               depth-8 layer is only 102 coordinates, so the states where SIX colours are all
 *               at 8 fall out of a 6-deep intersection in milliseconds. Computed here, at run
 *               time, for whichever colour subset the user picked — no data file to drift.
 *   shipped     XCross is not: its colour-neutral metric reads the whole cube, and closing over
 *               it means a 4.3e19 search. Those 438 states come from upstream's exhaustive
 *               search (see app/[lang]/scramble/hardest) and are carried as data.
 *
 * The counts are golden numbers from the site's own exact-enumeration datasets
 * (/scramble/stats, `_data/exact_dist.ts`). An enumeration that does not reproduce its golden
 * count is a broken model, not a lucky one — so it is refused rather than served, and
 * tests/cross_trainer_corpus.test.ts locks every count with toBe.
 */

import type { CubieCube } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';
import { crossLayers, decodeCross } from './dist';
import { FACE_EDGES, type FaceIdx } from './model';
import { fillState, type Pin } from './fill';
import { xcrossCn10 } from './corpus-data';

/**
 * One member of a class: the pieces the metric reads, pinned. Whatever it leaves free is filled
 * uniformly at random — the same fiber argument the samplers use, so uniform over the class ×
 * uniform over the fiber = uniform over all cubes of that difficulty.
 */
export interface CorpusMember { edgePins: Pin[]; cornerPins: Pin[] }

/** Where a class comes from — computed here, or carried as data because we cannot compute it. */
type Source =
  /** Intersect each chosen colour's own deepest cross layer (see enumerateCrossTop). */
  | { kind: 'cross-top' }
  /** Upstream's exhaustive search, carried as data (see corpus-data). */
  | { kind: 'shipped'; load: () => CorpusMember[] };

interface CorpusCell {
  /** Golden count from the exact-enumeration datasets — an enumeration must reproduce it. */
  count: number;
  source: Source;
}

// ── cross: intersect the colours' depth-8 layers ─────────────────────────────────────────────

/**
 * Every edge configuration whose cross is exactly `depth` moves for EVERY face in `faces`.
 *
 * With more than one face this equals the class "the BEST colour is `depth`" only at the metric's
 * maximum (8 for cross): there "the best of the colours is 8" and "all of the colours are 8" are
 * the same statement, because no colour can be deeper. Below the maximum they part ways and this
 * would enumerate the wrong set — callers must check. With a single face there is nothing to
 * minimise over, so every depth is fair game (that is the /scramble/stats case list's other half).
 *
 * The search walks the faces, and for each one iterates that face's OWN depth-`depth` layer
 * (102 coordinates) rather than the free slots — a colour's layer already knows where its four
 * edges must sit, so a face costs 102 consistency checks instead of 26,880 placements. Faces
 * overlap (each edge belongs to two crosses), so the constraint tightens fast: the first two
 * colours leave ~10⁴ candidates and every later colour cuts it to almost nothing.
 */
export function enumerateCrossTop(faces: FaceIdx[], depth: number): CorpusMember[] {
  const slotOf = new Int8Array(12).fill(-1);
  const oriOf = new Int8Array(12);
  let used = 0;
  const out: CorpusMember[] = [];

  const emit = () => {
    const edgePins: Pin[] = [];
    let flips = 0;
    for (let piece = 0; piece < 12; piece++) {
      if (slotOf[piece] < 0) continue;
      edgePins.push({ piece, slot: slotOf[piece], ori: oriOf[piece] });
      flips += oriOf[piece];
    }
    // All twelve edges pinned → this configuration owns the flip parity, and an odd one is not a
    // cube. (With edges left free, fill.ts derives the last free flip and any parity is legal.)
    if (edgePins.length === 12 && (flips & 1)) return;
    out.push({ edgePins, cornerPins: [] });
  };

  const rec = (i: number): void => {
    if (i === faces.length) { emit(); return; }
    const pieces = FACE_EDGES[faces[i]];
    const layer = crossLayers(faces[i])[depth];
    const cur = new Int8Array(4);
    for (let li = 0; li < layer.length; li++) {
      decodeCross(layer[li], cur);
      let mask = 0;
      let ok = true;
      for (let k = 0; k < 4 && ok; k++) {
        const piece = pieces[k];
        const slot = cur[k] >> 1;
        const ori = cur[k] & 1;
        if (slotOf[piece] >= 0) ok = slotOf[piece] === slot && oriOf[piece] === ori;
        else if ((used | mask) & (1 << slot)) ok = false;
        else mask |= 1 << slot;
      }
      if (!ok) continue;
      const undo: number[] = [];
      for (let k = 0; k < 4; k++) {
        const piece = pieces[k];
        if (slotOf[piece] >= 0) continue;
        slotOf[piece] = cur[k] >> 1;
        oriOf[piece] = cur[k] & 1;
        undo.push(piece);
      }
      used |= mask;
      rec(i + 1);
      used &= ~mask;
      for (const piece of undo) slotOf[piece] = -1;
    }
  };

  rec(0);
  return out;
}

// ── registry ─────────────────────────────────────────────────────────────────────────────────

/**
 * `variant/stage|colours|slot` → the class at each enumerable depth, with its golden count.
 *
 * Counts come from the site's exact-enumeration datasets (see
 * app/[lang]/scramble/stats/_data/exact_dist.ts, and /scramble/hardest for the XCross one).
 * Only the colour COUNT keys the table: within a count the picker's subsets are conjugate
 * (opposite pairs for two, their complements for four), so each has the same class size — and
 * for the enumerated stages the class is recomputed for the exact subset anyway.
 */
const CORPUS: Record<string, Record<number, CorpusCell>> = {
  // 四色底十字 8 步 —— 591 个。四色子集有三种取法(各去掉一对相对色),分布相同但状态不同,
  // 所以按调用方给的那一组现算,不预存某一组。
  'std/cross|4|best': { 8: { count: 591, source: { kind: 'cross-top' } } },
  // 六色底十字 8 步 —— 40 个,整个 12!·2¹¹ 棱空间里最难开的一撮。
  'std/cross|6|best': { 8: { count: 40, source: { kind: 'cross-top' } } },
  // 六色底 XCross 10 步 —— 438 个,上游穷举搜索的结果(本仓库复算不了,见 corpus-data)。
  'std/xcross|6|best': { 10: { count: 438, source: { kind: 'shipped', load: xcrossCn10 } } },
};

const cache = new Map<string, CorpusMember[] | null>();

/** Cache key: the exact faces matter (a four-colour subset is three different sets). */
const cacheKey = (key: string, depth: number, faces: FaceIdx[]) =>
  `${key}@${depth}#${[...faces].sort().join('')}`;

/**
 * The enumerated class for (stage, colours, slot mode, depth), or null when there is none —
 * or when the enumeration failed to reproduce its golden count, which means the model drifted
 * and the only safe answer is "cannot generate" rather than a plausible wrong set.
 */
export function corpusClass(
  variant: string, stage: string, faces: FaceIdx[], slot: number | 'best', depth: number,
): CorpusMember[] | null {
  const key = `${variant}/${stage}|${faces.length}|${slot === 'best' ? 'best' : 'fixed'}`;
  const cell = CORPUS[key]?.[depth];
  if (!cell) return null;
  const ck = cacheKey(key, depth, faces);
  const hit = cache.get(ck);
  if (hit !== undefined) return hit;
  const list = cell.source.kind === 'cross-top'
    ? enumerateCrossTop(faces, depth)
    : cell.source.load();
  const ok = list.length === cell.count ? list : null;
  cache.set(ck, ok);
  return ok;
}

/** Depths this (stage, colours, slot mode) can serve from an enumeration. */
export function corpusDepths(variant: string, stage: string, colors: number, slot: 'fixed' | 'best'): number[] {
  const cell = CORPUS[`${variant}/${stage}|${colors}|${slot}`];
  return cell ? Object.keys(cell).map(Number).sort((a, b) => a - b) : [];
}

/** Uniform draw from an enumerated class: pick a member, fill whatever it leaves free. */
export function drawCorpus(
  variant: string, stage: string, faces: FaceIdx[], slot: number | 'best', depth: number,
  rng: () => number,
): CubieCube | null {
  const list = corpusClass(variant, stage, faces, slot, depth);
  if (!list || !list.length) return null;
  const pick = list[(rng() * list.length) | 0];
  return fillState(pick.edgePins, pick.cornerPins, rng);
}
