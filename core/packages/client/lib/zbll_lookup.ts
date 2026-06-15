/**
 * Pre-built fingerprint → algs lookup for ZBLL recon autofill.
 *
 * ZBLL applies when F2L is done AND all 4 last-layer edges are oriented (i.e.
 * each top edge's U-face sticker is U-color). It then solves the cube in one
 * alg, similar to PLL but with corners possibly twisted.
 *
 * **Per-cross-color tables**: one table per cross color (0..5). Built lazily
 * the first time a user with that cross color is encountered. For each table,
 * the "solved" base cube is rotated so the matching color sits on D, then
 * algs are applied to that base. This way the fingerprints are well-defined
 * for any cross color — the cubie identity at each slot is determined by the
 * user's chosen cross-color frame, not cubing.js's default white-up frame.
 *
 * Within each table, after applying `solved.applyAlg(invert(composed))`, we
 * also normalize centers to a canonical position (the cross-color's default
 * frame) by appending the inverse rotation to the alg. This handles the
 * common case of algs containing `y'`/`y2`/`x` whole-cube rotations.
 *
 * 16-char fingerprint: raw color codes for 4 corner-tops + 4 edge-sides + 8
 * corner-sides. Caller should pass a state in the cross-color's canonical
 * frame (cross color on D, side centers in cross-color's default order).
 *
 * Build cost: ~30k simulations per cross color on first use.
 */

import type { KPattern } from 'cubing/kpuzzle';
import { getCube3, simplifyAlg, invertAlg } from './cube3';
import {
  CORNER_STICKERS, EDGE_STICKERS,
  cornerStickerOnFace, edgeStickerOnFace,
} from './sticker_tables';
import { loadAlg } from '@cuberoot/shared/alg';

export interface ZbllAlgEntry {
  /** Alg in the cross-color's canonical frame. Apply directly to the user's
   *  state once the user's state has been canonicalized via
   *  `canonicalRotationForCross`. */
  alg: string;
  caseName: string;
}

const AUFS = ['', 'U', 'U2', "U'"] as const;

const ORIENTATION_ALGS: string[] = (() => {
  const out: string[] = [];
  for (const t of ['', 'x', 'x2', "x'", 'z', "z'"]) {
    for (const y of ['', 'y', 'y2', "y'"]) {
      out.push([t, y].filter(Boolean).join(' '));
    }
  }
  return out;
})();

/** Find a rotation that sits the given color on D (slot 5) in the solved cube.
 *  Returns the canonical frame for that cross color. Used as the base for
 *  building per-cross-color lookup tables. */
function rotationForCross(solved: KPattern, crossColor: number): string {
  for (const rot of ORIENTATION_ALGS) {
    const t = rot ? solved.applyAlg(rot) : solved;
    if (t.patternData.CENTERS.pieces[5] === crossColor) return rot;
  }
  return '';
}

/** For a given cross-color frame, find the rotation that takes `state` to
 *  default centers OF THAT FRAME. Used to absorb the rotations that ZBLL algs
 *  introduce, so fingerprints stay in the canonical centers configuration. */
function alignCentersToFrame(state: KPattern, frameCenters: ReadonlyArray<number>): string {
  for (const rot of ORIENTATION_ALGS) {
    const t = rot ? state.applyAlg(rot) : state;
    const c = t.patternData.CENTERS.pieces;
    let ok = true;
    for (let i = 0; i < 6; i++) {
      if (c[i] !== frameCenters[i]) { ok = false; break; }
    }
    if (ok) return rot;
  }
  return '';
}

/** 16-char fingerprint using raw color codes. State must be in the canonical
 *  frame for its cross color (centers in that cross color's default order). */
function zbllFingerprint(p: KPattern): string {
  let out = '';
  for (let s = 0; s < 4; s++) {
    out += String(cornerStickerOnFace(p, s, 0) ?? '?');
  }
  for (let s = 0; s < 4; s++) {
    const sideFace = EDGE_STICKERS[s][1];
    out += String(edgeStickerOnFace(p, s, sideFace) ?? '?');
  }
  for (let s = 0; s < 4; s++) {
    const [, sideA, sideB] = CORNER_STICKERS[s];
    out += String(cornerStickerOnFace(p, s, sideA) ?? '?');
    out += String(cornerStickerOnFace(p, s, sideB) ?? '?');
  }
  return out;
}

const _tables = new Map<number, Promise<Map<string, ZbllAlgEntry[]>>>();

async function buildTableForCross(crossColor: number): Promise<Map<string, ZbllAlgEntry[]>> {
  const cached = _tables.get(crossColor);
  if (cached) return cached;
  const promise = (async () => {
    const db = await loadAlg('3x3', 'zbll');
    const kp = await getCube3();
    const defaultSolved = kp.defaultPattern();
    const baseRot = rotationForCross(defaultSolved, crossColor);
    const baseSolved = baseRot ? defaultSolved.applyAlg(baseRot) : defaultSolved;
    const frameCenters = Array.from(baseSolved.patternData.CENTERS.pieces);
    const t = new Map<string, ZbllAlgEntry[]>();

    for (const c of db.cases) {
      const variants = c.algs[0] ?? [];
      for (const variant of variants) {
        const a = variant.alg;
        if (!a) continue;
        for (const preAuf of AUFS) {
          for (const postAuf of AUFS) {
            const composed = simplifyAlg([preAuf, a, postAuf].filter(Boolean).join(' '));
            if (!composed) continue;
            const inv = invertAlg(composed);
            if (!inv) continue;
            let state: KPattern;
            try { state = baseSolved.applyAlg(inv); } catch { continue; }
            // Whole-cube rotations in the alg may have shifted centers off
            // the cross-color's default frame — undo that, prepending the
            // inverse rotation onto the stored alg.
            const revertRot = alignCentersToFrame(state, frameCenters);
            if (revertRot) {
              state = state.applyAlg(revertRot);
            }
            const finalAlg = revertRot
              ? simplifyAlg(`${invertAlg(revertRot)} ${composed}`)
              : composed;
            if (!finalAlg) continue;
            const fp = zbllFingerprint(state);
            const arr = t.get(fp) ?? [];
            if (!arr.some(e => e.alg === finalAlg)) {
              arr.push({ alg: finalAlg, caseName: c.name });
              t.set(fp, arr);
            }
          }
        }
      }
    }
    return t;
  })();
  _tables.set(crossColor, promise);
  return promise;
}

/**
 * Look up ZBLL algs that solve the given canonical-frame state.
 *
 * `canonical` must already be in cross-on-D form (use `crossOnDRotation`).
 * Cross color is read from D-center; side centers may be in any cyclic
 * permutation — the lookup picks a table by cross color and accepts any side
 * permutation (since alg suggestions are verified by the caller's goal-check).
 */
export async function lookupZbllAlgs(canonical: KPattern): Promise<ZbllAlgEntry[]> {
  const crossColor = canonical.patternData.CENTERS.pieces[5];
  const t = await buildTableForCross(crossColor);
  // Fingerprint requires centers in the cross-color's default order. If the
  // user's state has side centers in a different cyclic position, rotate to
  // match before fingerprinting.
  const kp = await getCube3();
  const defaultSolved = kp.defaultPattern();
  const baseRot = rotationForCross(defaultSolved, crossColor);
  const baseSolved = baseRot ? defaultSolved.applyAlg(baseRot) : defaultSolved;
  const frameCenters = Array.from(baseSolved.patternData.CENTERS.pieces);
  const yRots = ['', 'y', 'y2', "y'"];
  for (const yRot of yRots) {
    const rotated = yRot ? canonical.applyAlg(yRot) : canonical;
    const c = rotated.patternData.CENTERS.pieces;
    let ok = true;
    for (let i = 0; i < 6; i++) {
      if (c[i] !== frameCenters[i]) { ok = false; break; }
    }
    if (!ok) continue;
    const fp = zbllFingerprint(rotated);
    const entries = t.get(fp);
    if (!entries) continue;
    // Prepend the y-rotation so the alg, applied to user's pre-rotation
    // state, hits the correct slot orientation.
    if (!yRot) return entries;
    return entries.map(e => ({
      alg: simplifyAlg(`${yRot} ${e.alg}`),
      caseName: e.caseName,
    }));
  }
  return [];
}

export function warmupZbllTable(crossColor = 5): Promise<void> {
  return buildTableForCross(crossColor).then(() => undefined);
}

export { zbllFingerprint };
