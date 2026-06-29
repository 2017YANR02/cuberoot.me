/**
 * ZBLL lookup for recon autofill (recognition + alg suggestion).
 *
 * ZBLL applies when F2L is done AND all 4 last-layer edges are oriented; it then
 * solves the cube in one alg (like PLL but with corners possibly twisted).
 *
 * This is a frame-invariant brute search, NOT a fingerprint table. The earlier
 * per-cross-colour fingerprint tables were both slow (~30k sims / ~9.5s to build
 * on the first Tab of each colour) AND fragile — the raw-colour fingerprint +
 * centre-alignment missed non-yellow / tilted crosses entirely (an `x z`
 * inspection white-cross solve returned zero matches). Instead, mirroring the
 * F2L robust fix: try every DB alg under every cross-on-D rotation (×pre-AUF
 * ×post-AUF) on the user's RAW state, and keep those that FULLY SOLVE the cube,
 * verified by pure piece identity in the centres-home frame. Colour-neutral,
 * complete for every orientation, no per-colour table, no warmup.
 */

import type { KPattern, KTransformation } from 'cubing/kpuzzle';
import { getCube3, simplifyAlg } from './cube3';
import { defaultCentersTransform, edgeHome, cornerHome } from './stage_detect';
import { getPreMods } from './f2l_lookup';
import { loadAlg } from '@cuberoot/shared/alg';

const POST_AUFS = ['', 'U', 'U2', "U'"] as const;
let _postAufTs: Promise<KTransformation[]> | null = null;
/** The 4 post-AUF (trailing U-turn) transformations, precomputed + cached. */
async function getPostAufTs(): Promise<KTransformation[]> {
  if (_postAufTs) return _postAufTs;
  _postAufTs = (async () => {
    const kp = await getCube3();
    return POST_AUFS.map(a => (a ? kp.algToTransformation(a) : kp.identityTransformation()));
  })();
  return _postAufTs;
}

interface FlatZbll { t: KTransformation; alg: string; caseName: string; }
let _flatZbll: Promise<FlatZbll[]> | null = null;
/** Every distinct ZBLL DB alg as a precomputed transformation (cached). */
async function getFlatZbll(): Promise<FlatZbll[]> {
  if (_flatZbll) return _flatZbll;
  _flatZbll = (async () => {
    const db = await loadAlg('3x3', 'zbll');
    const kp = await getCube3();
    const items: FlatZbll[] = [];
    const seen = new Set<string>();
    for (const c of db.cases) {
      for (const v of c.algs[0] ?? []) {
        if (!v.alg || seen.has(v.alg)) continue;
        seen.add(v.alg);
        try { items.push({ t: kp.algToTransformation(v.alg), alg: v.alg, caseName: c.name }); }
        catch { /* unparseable DB alg — drop, matching applyAlg's catch path */ }
      }
    }
    return items;
  })();
  return _flatZbll;
}

/** Cube fully solved in the centres-home frame: every edge + corner home. */
function allPiecesHome(home: KPattern): boolean {
  for (let e = 0; e < 12; e++) if (!edgeHome(home, e)) return false;
  for (let c = 0; c < 8; c++) if (!cornerHome(home, c)) return false;
  return true;
}

export interface ZbllRobustEntry {
  /** Alg in the user's RAW frame — ready to insert as-is (no canonRot prefix). */
  alg: string;
  caseName: string;
}

/** Inner pass: all DB algs under the 4 rotations (×AUF×postAUF) that put colour
 *  `crossFace` on D, keeping those that fully solve the cube. */
async function searchAtCrossFace(
  rawStart: KPattern,
  crossFace: number,
  algs: FlatZbll[],
  preMods: { alg: string; t: KTransformation }[],
  postAufTs: KTransformation[],
): Promise<ZbllRobustEntry[]> {
  const out: ZbllRobustEntry[] = [];
  const seen = new Set<string>();
  for (const pre of preMods) {
    let base: KPattern;
    try { base = rawStart.applyTransformation(pre.t); } catch { continue; }
    // LL algs only apply when the last layer is on U, i.e. the cross colour on D.
    if (base.patternData.CENTERS.pieces[5] !== crossFace) continue;
    for (const { t, alg, caseName } of algs) {
      let mid: KPattern;
      try { mid = base.applyTransformation(t); } catch { continue; }
      // DB ZBLL algs may solve only up to AUF (trailing U-turn implied), so try
      // each post-AUF — without this, whole cases whose algs leave the U layer
      // rotated never verify as solved.
      for (let a = 0; a < postAufTs.length; a++) {
        const post = mid.applyTransformation(postAufTs[a]);
        const homeT = await defaultCentersTransform(post);
        if (!homeT) continue;
        const home = post.applyTransformation(homeT);
        if (!allPiecesHome(home)) continue;
        const full = simplifyAlg([pre.alg, alg, POST_AUFS[a]].filter(Boolean).join(' '));
        if (!full || seen.has(full)) continue;
        seen.add(full);
        out.push({ alg: full, caseName });
      }
    }
  }
  return out;
}

/**
 * Frame-invariant ZBLL finder for the user's RAW state (F2L done + LL edges
 * oriented). Tries every DB alg under every cross-on-D rotation (×AUF), keeping
 * those that FULLY SOLVE the cube — verified by pure piece identity in the
 * centres-home frame, so it works for every cross colour and inspection rotation.
 * Returns RAW-frame algs (insert directly, no prefix).
 *
 * The on-D cross colour cannot be trusted from `detectStage`/`crossOnDRotation`:
 * for an ambiguous last-layer state several faces can LOOK like a solved cross +
 * oriented LL (both the piece-identity `edgeHome` orientation check and the
 * sticker `crossSolved` check give false positives off the real bottom face), yet
 * the cube only genuinely solves with ONE colour on D. So we don't restrict to a
 * single detected face — we try `crossFaceHint` first (fast, right in the common
 * case) and fall back to the other colours, returning the first that ACTUALLY
 * solves. "Does a DB alg solve it" is the only reliable signal.
 */
export async function lookupZbllAlgsRobust(
  rawStart: KPattern,
  crossFaceHint?: number,
): Promise<ZbllRobustEntry[]> {
  const [algs, preMods, postAufTs] = await Promise.all([getFlatZbll(), getPreMods(), getPostAufTs()]);
  // Try the hint first, then its OPPOSITE face: when the hint is wrong it's
  // almost always the cross/LL mix-up (the real cross is the face opposite the
  // detected one), so this resolves the ambiguous case in 2 searches not 6.
  const OPP = [5, 3, 4, 1, 2, 0];
  const order: number[] = [];
  const push = (f: number) => { if (f != null && f >= 0 && !order.includes(f)) order.push(f); };
  if (crossFaceHint != null) { push(crossFaceHint); push(OPP[crossFaceHint]); }
  for (let f = 0; f < 6; f++) push(f);
  for (const cf of order) {
    const r = await searchAtCrossFace(rawStart, cf, algs, preMods, postAufTs);
    if (r.length > 0) return r;
  }
  return [];
}
