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

import type { KPattern } from 'cubing/kpuzzle';
import { F2L_SLOT_DEFS } from './stage_detect';
import { getCube3, simplifyAlg, invertAlg } from './cube3';
import {
  CORNER_STICKERS, EDGE_STICKERS,
  cornerStickerOnFace, edgeStickerOnFace,
} from './sticker_tables';
import { loadAlgdb } from '@cuberoot/shared';

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
      loadAlgdb('f2l'),
      loadAlgdb('adv_f2l'),
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
 * Empty array if no algdb case matches the current pair shape (e.g., cross
 * broken, or pair already solved).
 */
export async function lookupF2lAlgs(canonical: KPattern, slotIdx: number): Promise<F2lAlgEntry[]> {
  const t = await buildTable();
  const fp = fingerprintAt(canonical, slotIdx);
  return t.get(fp) ?? [];
}

/** Eagerly build the table. Useful for warmup if the page expects Tab presses soon. */
export function warmupF2lTable(): Promise<void> {
  return buildTable().then(() => undefined);
}
