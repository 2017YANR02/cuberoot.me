/**
 * Pre-built fingerprint → algs lookup for PLL recon autofill.
 *
 * Same shape as `oll_lookup` but PLL has BOTH pre-AUF and post-AUF — the alg
 * may leave the U layer rotated relative to centers, so a trailing U/U2/U'
 * is sometimes needed to fully solve. We pre-compose every (preAuf · alg ·
 * postAuf) and store the simplified result; the user just executes the text.
 *
 * Fingerprint = the 12 side-stickers around the U layer (4 edge + 8 corner).
 * Since OLL is already done at this point, top is uniformly U-color, so only
 * the side-color permutation distinguishes states.
 *
 * Build cost: ~1344 simulations on first use (84 alg variants × 16 AUF combos).
 */

import type { KPattern } from 'cubing/kpuzzle';
import { getCube3, simplifyAlg, invertAlg } from './cube3';
import {
  CORNER_STICKERS, EDGE_STICKERS,
  cornerStickerOnFace, edgeStickerOnFace,
} from './sticker_tables';
import { loadAlgdb } from '@cuberoot/shared/algdb';

export interface PllAlgEntry {
  /** Alg in canonical frame, post-AUF baked in. */
  alg: string;
  caseName: string;
}

const AUFS = ['', 'U', 'U2', "U'"] as const;

/** 12-char fingerprint: side-color (face index) of each U-layer side sticker. */
function pllFingerprint(p: KPattern): string {
  let out = '';
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

let _tablePromise: Promise<Map<string, PllAlgEntry[]>> | null = null;

async function buildTable(): Promise<Map<string, PllAlgEntry[]>> {
  if (_tablePromise) return _tablePromise;
  _tablePromise = (async () => {
    const db = await loadAlgdb('3x3', 'pll');
    const kp = await getCube3();
    const solved = kp.defaultPattern();
    const t = new Map<string, PllAlgEntry[]>();

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
            try { state = solved.applyAlg(inv); } catch { continue; }
            const fp = pllFingerprint(state);
            const arr = t.get(fp) ?? [];
            if (!arr.some(e => e.alg === composed)) {
              arr.push({ alg: composed, caseName: c.name });
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

export async function lookupPllAlgs(canonical: KPattern): Promise<PllAlgEntry[]> {
  const t = await buildTable();
  const fp = pllFingerprint(canonical);
  return t.get(fp) ?? [];
}

export function warmupPllTable(): Promise<void> {
  return buildTable().then(() => undefined);
}

export { pllFingerprint };
