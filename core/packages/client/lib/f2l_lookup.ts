/**
 * Pre-built fingerprint → algs lookup for F2L recon autofill.
 *
 * Replaces brute-force "try every (alg × rotation × auf) combination" scoring
 * (~9952 simulations per Tab) with case identification: extract the F2L pair's
 * piece positions for the queried slot and consult a static map.
 *
 * Build cost: ~656 simulations on first use (lazy, cached). Lookup cost: O(1).
 *
 * Coordinate system: all internal cube states are in CANONICAL frame (cross on
 * D). Callers convert raw-frame patterns via `bestOrientationAlg` first; the
 * returned alg is also in canonical frame and must be prefixed with the same
 * canonRot to execute correctly in the user's raw frame.
 */

import type { KPattern, KTransformation } from 'cubing/kpuzzle';
import {
  F2L_SLOT_DEFS,
  CROSS_EDGES_BY_FACE, defaultCentersTransform,
  edgeHome, cornerHome,
} from './stage_detect';
import { getCube3, simplifyAlg, invertAlg } from './cube3';
import {
  CORNER_STICKERS, EDGE_STICKERS,
  cornerStickerOnFace, edgeStickerOnFace,
} from './sticker_tables';
import { loadAlg } from '@cuberoot/shared/alg';

export interface F2lAlgEntry {
  /** Alg in canonical frame. Prefix with canonRot for raw-frame execution. */
  alg: string;
  caseName: string;
  /** 0..3 — index into F2L_SLOT_DEFS (FR/FL/BL/BR). */
  oriIdx: number;
}

const AUFS = ['', 'U', 'U2', "U'"] as const;
const AUF_INV = ['', "U'", 'U2', 'U'] as const;

/**
 * Fingerprint of one F2L pair in any pattern with cross on D. Geometric, not
 * piece-number based — works regardless of cross color (e.g. user's white-on-D
 * vs algdb's yellow-on-D default).
 *
 * For the corner: which slot it sits at + which face of that slot shows the
 * D-color sticker (0/1/2 = vertical / first-side / second-side per
 * CORNER_STICKERS).
 *
 * For the edge: which slot it sits at + which face of that slot shows the
 * primary-side sticker (0/1 per EDGE_STICKERS).
 *
 * "F2L corner" is identified as the corner whose 3 stickers match (D-center,
 * S-side-A center, S-side-B center). Same idea for the edge. This is what
 * defines a slot's pair regardless of color scheme.
 */
function fingerprintAt(p: KPattern, slotIdx: number): string {
  const def = F2L_SLOT_DEFS[slotIdx];
  const c = p.patternData.CENTERS.pieces;
  const dColor = c[5];
  // Slot's adjacent face indices (in the canonical [vertical, sideA, sideB] order)
  const cornerSlotFaces = CORNER_STICKERS[def.cornerSlot];
  const edgeSlotFaces = EDGE_STICKERS[def.edgeSlot];
  const cornerSideAColor = c[cornerSlotFaces[1]];
  const cornerSideBColor = c[cornerSlotFaces[2]];
  const edgeSideAColor = c[edgeSlotFaces[0]];
  const edgeSideBColor = c[edgeSlotFaces[1]];

  let cFp = '?';
  for (let s = 0; s < 8; s++) {
    const slotFaces = CORNER_STICKERS[s];
    const stickers = [
      cornerStickerOnFace(p, s, slotFaces[0]),
      cornerStickerOnFace(p, s, slotFaces[1]),
      cornerStickerOnFace(p, s, slotFaces[2]),
    ];
    const set = new Set(stickers);
    if (set.size === 3
      && set.has(dColor)
      && set.has(cornerSideAColor)
      && set.has(cornerSideBColor)
    ) {
      const dFaceIdx = stickers.indexOf(dColor);
      cFp = `${s}.${dFaceIdx}`;
      break;
    }
  }

  let eFp = '?';
  for (let s = 0; s < 12; s++) {
    const slotFaces = EDGE_STICKERS[s];
    const stickerA = edgeStickerOnFace(p, s, slotFaces[0]);
    const stickerB = edgeStickerOnFace(p, s, slotFaces[1]);
    const matches = (stickerA === edgeSideAColor && stickerB === edgeSideBColor)
                 || (stickerA === edgeSideBColor && stickerB === edgeSideAColor);
    if (matches) {
      const primaryOnFirst = stickerA === edgeSideAColor ? 0 : 1;
      eFp = `${s}.${primaryOnFirst}`;
      break;
    }
  }

  return `${def.id}#${cFp}/${eFp}`;
}

let _tablePromise: Promise<Map<string, F2lAlgEntry[]>> | null = null;

async function buildTable(): Promise<Map<string, F2lAlgEntry[]>> {
  if (_tablePromise) return _tablePromise;
  _tablePromise = (async () => {
    const [f2l, advF2l] = await Promise.all([
      loadAlg('3x3', 'f2l'),
      loadAlg('3x3', 'adv-f2l'),
    ]);
    const kp = await getCube3();
    const solved = kp.defaultPattern();
    const t = new Map<string, F2lAlgEntry[]>();

    const allCases = [...f2l.cases, ...advF2l.cases];
    for (const c of allCases) {
      for (let oriIdx = 0; oriIdx < 4; oriIdx++) {
        const variants = c.algs[oriIdx];
        if (!variants) continue;
        for (const variant of variants) {
          const a = variant.alg;
          if (!a) continue;
          const invA = invertAlg(a);
          if (!invA) continue;
          let baseState: KPattern;
          try { baseState = solved.applyAlg(invA); } catch { continue; }
          for (let aufIdx = 0; aufIdx < 4; aufIdx++) {
            const auf = AUFS[aufIdx];
            const aufInv = AUF_INV[aufIdx];
            let state: KPattern;
            try { state = auf ? baseState.applyAlg(auf) : baseState; } catch { continue; }
            const fp = fingerprintAt(state, oriIdx);
            const composed = simplifyAlg(aufInv ? `${aufInv} ${a}` : a);
            if (!composed) continue;
            const arr = t.get(fp) ?? [];
            if (!arr.some(e => e.alg === composed)) {
              arr.push({ alg: composed, caseName: c.name, oriIdx });
              t.set(fp, arr);
            }
          }
        }
      }
    }
    return t;
  })();
  return _tablePromise;
}

/**
 * Look up F2L algs that solve the given slot in the canonical-frame pattern.
 *
 * The caller's `canonical` may not have default centers (bestOrientationAlg
 * picks any rotation with cross-on-D, not necessarily the one with default
 * centers). We try all 4 y-rotations and take the union: at one of them the
 * pair's piece will be in the same slot as the canonical-frame DB entry for
 * the matching case, and the fingerprint will match. For each match found at
 * y-rotation `k`, the alg returned has `U^k` rolled into its prefix so it
 * still solves the input frame correctly.
 */
export async function lookupF2lAlgs(canonical: KPattern, slotIdx: number): Promise<F2lAlgEntry[]> {
  const t = await buildTable();
  const out: F2lAlgEntry[] = [];
  const seen = new Set<string>();
  for (let k = 0; k < 4; k++) {
    const auf = AUFS[k];
    const aufInv = AUF_INV[k];
    const rotated = auf ? canonical.applyAlg(auf) : canonical;
    const fp = fingerprintAt(rotated, slotIdx);
    const entries = t.get(fp);
    if (!entries) continue;
    for (const e of entries) {
      // Composed alg in the input frame: pre-AUF (aufInv) to undo the rotation
      // we applied to match the fingerprint, then the stored canonical-frame alg.
      const composed = simplifyAlg(aufInv ? `${aufInv} ${e.alg}` : e.alg);
      if (!composed) continue;
      if (seen.has(composed)) continue;
      seen.add(composed);
      out.push({ alg: composed, caseName: e.caseName, oriIdx: e.oriIdx });
    }
  }
  return out;
}

/** Eagerly build the table. Useful for warmup if the page expects Tab presses soon. */
export function warmupF2lTable(): Promise<void> {
  return buildTable().then(() => undefined);
}

// ── Robust frame-invariant fallback ─────────────────────────────────────────
// The fingerprint lookup is a fast O(1) path but is fragile for non-yellow /
// tilted crosses: a real solve on a white (or L/R/etc.) cross sits in a frame
// whose centres aren't home, and `crossOnDRotation` can even pick a DIFFERENT
// cross face than the user's actual solve when two faces momentarily look like
// crosses — landing the lookup in a frame where the cross-on-D DB algs don't
// apply at all. The previous AUF-only brute (verified with `evaluateCanonical`,
// which assumes the cross is on D) inherited the same blind spot. So we fall
// back to a fully frame-invariant search: try every DB alg under every cube
// rotation (×AUF) applied to the user's RAW state, and verify by PIECE IDENTITY
// in the centres-home frame (cross edges home + target pair home + previously
// solved pairs untouched). Colour-neutral and complete for every orientation.

const PRE_ROTS = [
  '', 'x', 'x2', "x'", 'y', 'y2', "y'", 'z', 'z2', "z'",
  'x y', 'x y2', "x y'", "x' y", "x' y2", "x' y'", 'x2 y', 'x2 y2', "x2 y'",
  'y x', 'y x2', "y x'", "y' x", "y' x'",
] as const;
const PRE_AUFS = ['', 'U', 'U2', "U'"] as const;
/** F2L slot face opposite each face (U↔D, R↔L, F↔B) — for the last-layer face. */
const OPP_FACE = [5, 3, 4, 1, 2, 0] as const;

interface FlatAlg { t: KTransformation; alg: string; caseName: string; }
let _flatF2l: Promise<FlatAlg[]> | null = null;
/** Every distinct F2L (+ adv-F2L) DB alg as a precomputed transformation. */
async function getFlatF2l(): Promise<FlatAlg[]> {
  if (_flatF2l) return _flatF2l;
  _flatF2l = (async () => {
    const [f2l, advF2l] = await Promise.all([loadAlg('3x3', 'f2l'), loadAlg('3x3', 'adv-f2l')]);
    const kp = await getCube3();
    const items: FlatAlg[] = [];
    const seen = new Set<string>();
    for (const c of [...f2l.cases, ...advF2l.cases]) {
      for (let o = 0; o < 4; o++) {
        for (const v of c.algs[o] ?? []) {
          if (!v.alg || seen.has(v.alg)) continue;
          seen.add(v.alg);
          try { items.push({ t: kp.algToTransformation(v.alg), alg: v.alg, caseName: c.name }); }
          catch { /* unparseable DB alg — drop, matching applyAlg's catch path */ }
        }
      }
    }
    return items;
  })();
  return _flatF2l;
}

interface PreMod { alg: string; t: KTransformation; }
let _preMods: Promise<PreMod[]> | null = null;
/** 24 cube rotations × 4 AUF as precomputed (rotation∘AUF) transformations. */
async function getPreMods(): Promise<PreMod[]> {
  if (_preMods) return _preMods;
  _preMods = (async () => {
    const kp = await getCube3();
    const out: PreMod[] = [];
    for (const rot of PRE_ROTS) {
      for (const auf of PRE_AUFS) {
        const alg = [rot, auf].filter(Boolean).join(' ');
        out.push({ alg, t: alg ? kp.algToTransformation(alg) : kp.identityTransformation() });
      }
    }
    return out;
  })();
  return _preMods;
}

export interface F2lRobustCtx {
  /** Home-frame cross face / colour code (from `detectStage().crossFaceHome`). */
  crossFace: number;
  /** Already-solved (cornerHomeId, edgeHomeId) pairs — must stay solved. */
  prevPairs: ReadonlyArray<readonly [number, number]>;
  /** Unsolved (cornerHomeId, edgeHomeId) pairs we want to solve this step. */
  targets: ReadonlyArray<readonly [number, number]>;
}
export interface F2lRobustEntry {
  /** Alg in the user's RAW frame — ready to insert as-is (no canonRot prefix). */
  alg: string;
  caseName: string;
  /** The (corner,edge) pair this alg solves. */
  pair: readonly [number, number];
  /** True iff after the alg ALL four F2L pairs are solved AND the last-layer
   *  edges are oriented — i.e. the move doubled as a ZBLS / EOLS finish. */
  eoDone: boolean;
}

/** Last-layer EO done in the centres-home frame: every LL-face edge shows an
 *  axis colour (cross or last-layer colour) on the LL face. */
function llEdgesOriented(home: KPattern, crossFace: number): boolean {
  const ll = OPP_FACE[crossFace];
  for (const e of CROSS_EDGES_BY_FACE[ll]) {
    const s = edgeStickerOnFace(home, e, ll);
    if (s !== crossFace && s !== ll) return false;
  }
  return true;
}

/**
 * Frame-invariant F2L finder for the user's RAW state. Tries every DB alg under
 * every cube rotation (×AUF), keeping only those that solve one of `targets`
 * while preserving the cross and `prevPairs`. Verification is pure piece
 * identity in the centres-home frame, so it works for every cross colour and
 * every inspection rotation. Returns RAW-frame algs (insert directly).
 *
 * Cost: ~96 pre-modifiers × DB size, each one `applyTransformation` + an O(1)
 * cached centres-home normalisation. simplify runs only on the few survivors.
 */
export async function lookupF2lAlgsRobust(
  rawStart: KPattern,
  ctx: F2lRobustCtx,
): Promise<F2lRobustEntry[]> {
  if (ctx.targets.length === 0) return [];
  const [algs, preMods] = await Promise.all([getFlatF2l(), getPreMods()]);
  const crossEdges = CROSS_EDGES_BY_FACE[ctx.crossFace];
  const out: F2lRobustEntry[] = [];
  const seen = new Set<string>();

  for (const pre of preMods) {
    let base: KPattern;
    try { base = rawStart.applyTransformation(pre.t); } catch { continue; }
    for (const { t, alg, caseName } of algs) {
      let post: KPattern;
      try { post = base.applyTransformation(t); } catch { continue; }
      const homeT = await defaultCentersTransform(post);
      if (!homeT) continue;
      const home = post.applyTransformation(homeT);
      // Cross must survive.
      if (!crossEdges.every(e => edgeHome(home, e))) continue;
      // Previously solved pairs must survive.
      if (!ctx.prevPairs.every(([c, e]) => cornerHome(home, c) && edgeHome(home, e))) continue;
      // At least one target pair must now be solved.
      const solved = ctx.targets.find(([c, e]) => cornerHome(home, c) && edgeHome(home, e));
      if (!solved) continue;
      const full = simplifyAlg([pre.alg, alg].filter(Boolean).join(' '));
      if (!full || seen.has(full)) continue;
      seen.add(full);
      const allDone = ctx.targets.every(([c, e]) => cornerHome(home, c) && edgeHome(home, e));
      const eoDone = allDone && llEdgesOriented(home, ctx.crossFace);
      out.push({ alg: full, caseName, pair: solved, eoDone });
    }
  }
  return out;
}
