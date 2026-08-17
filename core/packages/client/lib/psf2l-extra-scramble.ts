import type { AlgCase } from '@cuberoot/shared';
import type { KPattern, KPuzzle, KTransformation } from 'cubing/kpuzzle';

const AUFS = ['', 'U', 'U2', "U'"] as const;
const Y = ['', 'y', 'y2', "y'"] as const;
const Y_INV = ['', "y'", 'y2', 'y'] as const;
const D_ADJUSTMENTS = ['D', 'D2', "D'"] as const;

const F2L_SLOTS = [
  { id: 'FR', corner: 4, edge: 8 },
  { id: 'FL', corner: 5, edge: 9 },
  { id: 'BL', corner: 6, edge: 11 },
  { id: 'BR', corner: 7, edge: 10 },
] as const;
const CROSS_EDGES = [4, 5, 6, 7] as const;
const ORIENTATION_ALGS = ['', 'y', 'y2', "y'", 'x', 'x y', 'x y2', "x y'", 'x2', 'x2 y', 'x2 y2', "x2 y'", "x'", "x' y", "x' y2", "x' y'", 'z', 'z y', 'z y2', "z y'", "z'", "z' y", "z' y2", "z' y'"] as const;

type Orbit = { pieces: number[]; orientation?: number[] };
type ExtraOutcome = 'corner' | 'edge';

export interface Psf2lExtraSuffixPool {
  corner: string[];
  edge: string[];
}

interface SuffixTemplate {
  alg: string;
  transformation: KTransformation;
}

interface Engine {
  kpuzzle: KPuzzle;
  orientationTransforms: KTransformation[];
  suffixes: SuffixTemplate[];
  centersHome: Map<string, KTransformation | null>;
}

interface BaseInvariant {
  fullSlotIds: Set<string>;
  remainingSlotIds: Set<string>;
  targetCorner: { piece: number; fingerprint: string };
  targetEdge: { piece: number; fingerprint: string };
}

const readyPools = new Map<string, Psf2lExtraSuffixPool>();
const poolPromises = new Map<string, Promise<Psf2lExtraSuffixPool>>();
const enginePromises = new Map<string, Promise<Engine>>();

const clean = (alg: string): string => alg.trim().replace(/\s+/g, ' ');
const home = (orbit: Orbit, piece: number): boolean => (
  orbit.pieces[piece] === piece && (orbit.orientation?.[piece] ?? 0) === 0
);

/** Exact location + orientation of a named cubie in cubing.js's KPattern orbit. */
const pieceFingerprint = (orbit: Orbit, piece: number): string => {
  const slot = orbit.pieces.indexOf(piece);
  return `${slot}.${slot >= 0 ? (orbit.orientation?.[slot] ?? 0) : -1}`;
};

const centersKey = (pattern: KPattern): string => pattern.patternData.CENTERS.pieces.join(',');

function normalizeCenters(pattern: KPattern, engine: Engine): KPattern | null {
  const key = centersKey(pattern);
  let transform = engine.centersHome.get(key);
  if (transform === undefined) {
    transform = null;
    for (const candidate of engine.orientationTransforms) {
      const rotated = pattern.applyTransformation(candidate);
      if (centersKey(rotated) === '0,1,2,3,4,5') {
        transform = candidate;
        break;
      }
    }
    engine.centersHome.set(key, transform);
  }
  return transform ? pattern.applyTransformation(transform) : null;
}

function baseInvariant(pattern: KPattern): BaseInvariant | null {
  const edges = pattern.patternData.EDGES as Orbit;
  const corners = pattern.patternData.CORNERS as Orbit;
  if (!CROSS_EDGES.every(piece => home(edges, piece))) return null;

  const status = F2L_SLOTS.map(slot => ({
    ...slot,
    cornerHome: home(corners, slot.corner),
    edgeHome: home(edges, slot.edge),
  }));
  const full = status.filter(slot => slot.cornerHome && slot.edgeHome);
  const cornerOnly = status.filter(slot => slot.cornerHome && !slot.edgeHome);
  const edgeOnly = status.filter(slot => !slot.cornerHome && slot.edgeHome);
  if (full.length !== 2 || cornerOnly.length !== 1 || edgeOnly.length !== 1) return null;

  const targetCornerPiece = edgeOnly[0].corner;
  const targetEdgePiece = cornerOnly[0].edge;
  return {
    fullSlotIds: new Set(full.map(slot => slot.id)),
    remainingSlotIds: new Set([...cornerOnly, ...edgeOnly].map(slot => slot.id)),
    targetCorner: {
      piece: targetCornerPiece,
      fingerprint: pieceFingerprint(corners, targetCornerPiece),
    },
    targetEdge: {
      piece: targetEdgePiece,
      fingerprint: pieceFingerprint(edges, targetEdgePiece),
    },
  };
}

function validOutcome(pattern: KPattern, invariant: BaseInvariant): ExtraOutcome | null {
  const edges = pattern.patternData.EDGES as Orbit;
  const corners = pattern.patternData.CORNERS as Orbit;
  if (!CROSS_EDGES.every(piece => home(edges, piece))) return null;
  if (pieceFingerprint(corners, invariant.targetCorner.piece) !== invariant.targetCorner.fingerprint) return null;
  if (pieceFingerprint(edges, invariant.targetEdge.piece) !== invariant.targetEdge.fingerprint) return null;

  const status = F2L_SLOTS.map(slot => ({
    ...slot,
    cornerHome: home(corners, slot.corner),
    edgeHome: home(edges, slot.edge),
  }));
  const full = status.filter(slot => slot.cornerHome && slot.edgeHome);
  if (full.length !== 2 || full.some(slot => !invariant.fullSlotIds.has(slot.id))) return null;

  const remaining = status.filter(slot => invariant.remainingSlotIds.has(slot.id));
  const partial = remaining.filter(slot => slot.cornerHome !== slot.edgeHome);
  const none = remaining.filter(slot => !slot.cornerHome && !slot.edgeHome);
  if (remaining.length !== 2 || partial.length !== 1 || none.length !== 1) return null;
  return partial[0].cornerHome ? 'corner' : 'edge';
}

const patternKey = (pattern: KPattern): string => JSON.stringify(pattern.patternData);

async function buildEngine(f2lCases: readonly AlgCase[]): Promise<Engine> {
  const signature = f2lCases.map(c => clean(c.setup)).filter(Boolean).join('\n');
  const existing = enginePromises.get(signature);
  if (existing) return existing;

  const promise = (async () => {
    const { cube3x3x3 } = await import('cubing/puzzles');
    const kpuzzle = await cube3x3x3.kpuzzle();
    const orientationTransforms = ORIENTATION_ALGS.map(alg => (
      alg ? kpuzzle.algToTransformation(alg) : kpuzzle.identityTransformation()
    ));
    const suffixes: SuffixTemplate[] = [];
    const seen = new Set<string>();

    for (const c of f2lCases) {
      const setup = clean(c.setup);
      if (!setup) continue;
      for (const pre of AUFS) {
        for (let ori = 0; ori < 4; ori++) {
          const rotated = [Y_INV[ori], setup, Y[ori]].filter(Boolean).join(' ');
          for (const post of AUFS) {
            const alg = [pre, rotated, post].filter(Boolean).join(' ');
            try {
              const transformation = kpuzzle.algToTransformation(alg);
              const key = JSON.stringify(transformation.transformationData);
              if (seen.has(key)) continue;
              seen.add(key);
              suffixes.push({ alg, transformation });
            } catch { /* Ignore malformed database formulas. */ }
          }
        }
      }
    }

    return { kpuzzle, orientationTransforms, suffixes, centersHome: new Map() };
  })();
  enginePromises.set(signature, promise);
  return promise;
}

/**
 * Build the legal suffixes for one existing PSF2L scramble.
 *
 * Every candidate is `AUF + a canonical base-F2L setup in any slot + AUF`.
 * The state filter is the authority: it keeps the original XXCross and target
 * PSF2L pair exact, while changing the other two slots from `partial+partial`
 * to `partial+empty`.
 */
export async function buildPsf2lExtraSuffixPool(
  base: string,
  f2lCases: readonly AlgCase[],
): Promise<Psf2lExtraSuffixPool> {
  const normalizedBase = clean(base);
  if (!normalizedBase || f2lCases.length === 0) return { corner: [], edge: [] };
  const engine = await buildEngine(f2lCases);
  const cacheKey = `${f2lCases.map(c => clean(c.setup)).join('\n')}\0${normalizedBase}`;
  const existing = poolPromises.get(cacheKey);
  if (existing) return existing;

  const promise = Promise.resolve().then(() => {
    let rawBase: KPattern;
    try { rawBase = engine.kpuzzle.defaultPattern().applyAlg(normalizedBase); }
    catch { return { corner: [], edge: [] }; }
    const canonicalBase = normalizeCenters(rawBase, engine);
    if (!canonicalBase) return { corner: [], edge: [] };
    const invariant = baseInvariant(canonicalBase);
    if (!invariant) return { corner: [], edge: [] };

    const pools: Psf2lExtraSuffixPool = { corner: [], edge: [] };
    const seen = new Set<string>();
    for (const suffix of engine.suffixes) {
      const raw = rawBase.applyTransformation(suffix.transformation);
      const canonical = normalizeCenters(raw, engine);
      if (!canonical) continue;
      const outcome = validOutcome(canonical, invariant);
      if (!outcome) continue;
      const key = patternKey(canonical);
      if (seen.has(key)) continue;
      seen.add(key);
      pools[outcome].push(suffix.alg);
    }
    return pools;
  });
  poolPromises.set(cacheKey, promise);
  return promise;
}

/** Precompute all original / D / D2 / D' variants without blocking first paint. */
export async function preparePsf2lExtraScrambles(
  psf2lCases: readonly AlgCase[],
  f2lCases: readonly AlgCase[],
  replaceOuterD: (base: string, adjustment: string) => string,
): Promise<void> {
  const bases = new Set<string>();
  for (const c of psf2lCases) {
    const base = clean(c.setup);
    if (!base) continue;
    bases.add(base);
    for (const adjustment of D_ADJUSTMENTS) bases.add(clean(replaceOuterD(base, adjustment)));
  }

  let index = 0;
  for (const base of bases) {
    if (!readyPools.has(base)) {
      const pool = await buildPsf2lExtraSuffixPool(base, f2lCases);
      if (pool.corner.length > 0 || pool.edge.length > 0) readyPools.set(base, pool);
    }
    index++;
    if (index % 6 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
}

/** Return a balanced random legal scramble, or null so the caller keeps the safe original. */
export function pickPreparedPsf2lExtraScramble(
  base: string,
  random: () => number = Math.random,
): string | null {
  const normalizedBase = clean(base);
  const pool = readyPools.get(normalizedBase);
  if (!pool) return null;
  const preferred = random() < 0.5 ? pool.corner : pool.edge;
  const fallback = preferred === pool.corner ? pool.edge : pool.corner;
  const candidates = preferred.length > 0 ? preferred : fallback;
  if (candidates.length === 0) return null;
  const suffix = candidates[Math.floor(random() * candidates.length)];
  return suffix ? `${normalizedBase} ${suffix}` : null;
}
