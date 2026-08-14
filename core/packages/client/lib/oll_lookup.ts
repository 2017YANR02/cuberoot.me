/**
 * OLL lookup for recon autofill.
 *
 * The fingerprint table is the fast path. Fingerprint = U-color mask of the
 * 20 last-layer stickers (8 top + 12 around U layer).
 *
 * Raw sticker fingerprints are not complete across all cross colours: an OLL
 * alg can solve a non-default-cross state whose fingerprint differs from the
 * representative state built from the default frame. On a fingerprint miss we
 * therefore try the precomputed DB alg transformations and retain only those
 * that `detectStage` verifies as orienting the last layer. This mirrors the
 * robust F2L/ZBLL lookup rule: the simulated result, not a lossy key, is the
 * source of truth.
 *
 * Build cost: ~912 simulations on first use (228 alg variants × 4 AUFs).
 *
 * Coordinate system: canonical frame (cross on D). Caller canonicalises via
 * `bestOrientationAlg` and prefixes the returned alg with the same canonRot.
 */

import type { KPattern, KTransformation } from 'cubing/kpuzzle';
import { getCube3, simplifyAlg, invertAlg } from './cube3';
import {
  CORNER_STICKERS, EDGE_STICKERS,
  cornerStickerOnFace, edgeStickerOnFace,
} from './sticker_tables';
import { loadAlg } from '@cuberoot/shared/alg';
import { forEachYielding } from './build-yield';
import { detectStage } from './stage_detect';

export interface OllAlgEntry {
  /** Alg in canonical frame (already includes any pre-AUF wrap). */
  alg: string;
  caseName: string;
}

const AUFS = ['', 'U', 'U2', "U'"] as const;
const AUF_INV = ['', "U'", 'U2', 'U'] as const;

/**
 * 20-char binary mask. '1' = sticker shows U-center color, '0' = otherwise.
 * Order: 4 U-edge top stickers, 4 U-corner top stickers, 4 U-edge side
 * stickers, 8 U-corner side stickers (CW pair per corner).
 */
function ollFingerprint(p: KPattern): string {
  const uColor = p.patternData.CENTERS.pieces[0];
  let out = '';
  for (let s = 0; s < 4; s++) {
    out += edgeStickerOnFace(p, s, 0) === uColor ? '1' : '0';
  }
  for (let s = 0; s < 4; s++) {
    out += cornerStickerOnFace(p, s, 0) === uColor ? '1' : '0';
  }
  for (let s = 0; s < 4; s++) {
    const sideFace = EDGE_STICKERS[s][1];
    out += edgeStickerOnFace(p, s, sideFace) === uColor ? '1' : '0';
  }
  for (let s = 0; s < 4; s++) {
    const [, sideA, sideB] = CORNER_STICKERS[s];
    out += cornerStickerOnFace(p, s, sideA) === uColor ? '1' : '0';
    out += cornerStickerOnFace(p, s, sideB) === uColor ? '1' : '0';
  }
  return out;
}

interface FlatOllAlg extends OllAlgEntry {
  transformation: KTransformation;
}

interface OllLookupIndex {
  table: Map<string, OllAlgEntry[]>;
  algs: FlatOllAlg[];
  algByText: Map<string, FlatOllAlg>;
}

let _indexPromise: Promise<OllLookupIndex> | null = null;

async function buildIndex(): Promise<OllLookupIndex> {
  if (_indexPromise) return _indexPromise;
  const pending = (async () => {
    const db = await loadAlg('3x3', 'oll');
    const kp = await getCube3();
    const solved = kp.defaultPattern();
    const t = new Map<string, OllAlgEntry[]>();
    const algs: FlatOllAlg[] = [];
    const algByText = new Map<string, FlatOllAlg>();
    const seenAlgs = new Set<string>();

    // Yields between cases — see build-yield.ts. Without it this loop is one
    // ~400ms task and the reconstruction panel cannot be scrolled while it runs.
    await forEachYielding(db.cases, (c) => {
      const variants = c.algs[0] ?? [];
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
          const fp = ollFingerprint(state);
          const composed = simplifyAlg(aufInv ? `${aufInv} ${a}` : a);
          if (!composed) continue;
          if (!seenAlgs.has(composed)) {
            try {
              const flat = {
                alg: composed,
                caseName: c.name,
                transformation: kp.algToTransformation(composed),
              };
              algs.push(flat);
              algByText.set(composed, flat);
              seenAlgs.add(composed);
            } catch {
              continue;
            }
          }
          const arr = t.get(fp) ?? [];
          if (!arr.some(e => e.alg === composed)) {
            arr.push({ alg: composed, caseName: c.name });
            t.set(fp, arr);
          }
        }
      }
    });
    return { table: t, algs, algByText };
  })();
  _indexPromise = pending.catch((error) => {
    _indexPromise = null;
    throw error;
  });
  return _indexPromise;
}

/**
 * Start building the table without needing an answer from it.
 *
 * Call this the moment it becomes likely someone will open a reconstruction —
 * the table costs two fetches and a few thousand alg parses, and doing that
 * while they are still reading the solve modal is free, whereas doing it when
 * they click through is exactly when they want to scroll.
 *
 * Idempotent: the promise is cached, so extra calls are a no-op.
 */
export function prewarmOllTable(): void {
  void buildIndex().catch(() => {/* a failed prewarm must stay silent */});
}

export async function lookupOllAlgs(canonical: KPattern): Promise<OllAlgEntry[]> {
  const index = await buildIndex();
  const fp = ollFingerprint(canonical);
  const exact = index.table.get(fp);

  const verify = async (candidates: FlatOllAlg[]): Promise<OllAlgEntry[]> => {
    const verified: OllAlgEntry[] = [];
    for (const candidate of candidates) {
      let post: KPattern;
      try {
        post = canonical.applyTransformation(candidate.transformation);
      } catch {
        continue;
      }
      const stage = (await detectStage(post)).stage;
      if (stage !== 'oll' && stage !== 'solved') continue;
      verified.push({ alg: candidate.alg, caseName: candidate.caseName });
    }
    return verified;
  };

  // A cross-colour collision can produce a non-empty but wrong fingerprint
  // bucket, so even fast-path entries must pass the state transition check.
  if (exact?.length) {
    const exactCandidates = exact.flatMap(entry => {
      const candidate = index.algByText.get(entry.alg);
      return candidate ? [{ ...entry, transformation: candidate.transformation }] : [];
    });
    const verifiedExact = await verify(exactCandidates);
    if (verifiedExact.length) return verifiedExact;
  }

  return verify(index.algs);
}

export function warmupOllTable(): Promise<void> {
  return buildIndex().then(() => undefined);
}

export { ollFingerprint };
