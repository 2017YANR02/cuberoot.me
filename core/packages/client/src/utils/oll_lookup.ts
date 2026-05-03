/**
 * Pre-built fingerprint → algs lookup for OLL recon autofill.
 *
 * Same idea as `f2l_lookup` but for the OLL stage. Fingerprint = U-color
 * mask of the 20 last-layer stickers (8 top + 12 around U layer). Two states
 * with identical masks are the same OLL case at the same AUF.
 *
 * Build cost: ~912 simulations on first use (228 alg variants × 4 AUFs).
 *
 * Coordinate system: canonical frame (cross on D). Caller canonicalises via
 * `bestOrientationAlg` and prefixes the returned alg with the same canonRot.
 */

import type { KPattern } from 'cubing/kpuzzle';
import { getCube3, simplifyAlg, invertAlg } from './cube3';
import {
  CORNER_STICKERS, EDGE_STICKERS,
  cornerStickerOnFace, edgeStickerOnFace,
} from './sticker_tables';
import { loadAlgdb } from '@cuberoot/shared/algdb';

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

let _tablePromise: Promise<Map<string, OllAlgEntry[]>> | null = null;

async function buildTable(): Promise<Map<string, OllAlgEntry[]>> {
  if (_tablePromise) return _tablePromise;
  _tablePromise = (async () => {
    const db = await loadAlgdb('oll');
    const kp = await getCube3();
    const solved = kp.defaultPattern();
    const t = new Map<string, OllAlgEntry[]>();

    for (const c of db.cases) {
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
          const arr = t.get(fp) ?? [];
          if (!arr.some(e => e.alg === composed)) {
            arr.push({ alg: composed, caseName: c.name });
            t.set(fp, arr);
          }
        }
      }
    }
    return t;
  })();
  return _tablePromise;
}

export async function lookupOllAlgs(canonical: KPattern): Promise<OllAlgEntry[]> {
  const t = await buildTable();
  const fp = ollFingerprint(canonical);
  return t.get(fp) ?? [];
}

export function warmupOllTable(): Promise<void> {
  return buildTable().then(() => undefined);
}

export { ollFingerprint };
