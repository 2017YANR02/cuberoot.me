/**
 * Pre-built fingerprint → algs lookup for ZBLS recon autofill.
 *
 * ZBLS = "ZB Last Slot" — solve the last F2L slot while preserving (already-
 * done) last-layer edge orientation. Caller has already verified that the
 * cube is at xxxcross with EO done; this lookup picks an alg that solves the
 * remaining slot AND keeps EO.
 *
 * Modeled on `f2l_lookup.ts`. Same fingerprint (per-slot pair piece + sticker
 * positions). The only difference: ZBLS data has a single orientation per
 * case (algs[0] only, no per-slot variants), so the table is built by iterating
 * over all 4 slot indices for each case — at lookup time, the matching
 * fingerprint pins which slot the alg actually solves.
 *
 * Build cost: ~6000 simulations on first use (lazy, cached). Lookup: O(1).
 */

import type { KPattern } from 'cubing/kpuzzle';
import { F2L_SLOT_DEFS } from './stage_detect';
import { getCube3, simplifyAlg, invertAlg } from './cube3';
import {
  CORNER_STICKERS, EDGE_STICKERS,
  cornerStickerOnFace, edgeStickerOnFace,
} from './sticker_tables';
import { loadAlg } from '@cuberoot/shared/alg';

export interface ZblsAlgEntry {
  /** Alg in canonical frame. Prefix with canonRot for raw-frame execution. */
  alg: string;
  caseName: string;
  /** 0..3 — index into F2L_SLOT_DEFS (FR/FL/BL/BR). */
  oriIdx: number;
}

const AUFS = ['', 'U', 'U2', "U'"] as const;
const AUF_INV = ['', "U'", 'U2', 'U'] as const;

/** Fingerprint = pair piece position (like F2L) PLUS the EO bitmask of the 4
 *  LL edges. ZBLS algs only "work" on a specific (slot-shape, EO-state) combo
 *  — applying the right alg to the wrong EO state would produce garbage.
 *
 *  EO bit per LL edge slot (0..3) = 1 iff the U-color sticker is NOT on the
 *  U face. Matches the convention used by topEdgesOriented in stage_detect. */
function fingerprintAt(p: KPattern, slotIdx: number): string {
  const def = F2L_SLOT_DEFS[slotIdx];
  const c = p.patternData.CENTERS.pieces;
  const dColor = c[5];
  const uColor = c[0];
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

  // EO bitmask: LL edge slots 0..3 (U-layer cubing.js piece slots).
  // bit 1 = NOT-oriented, bit 0 = oriented. EXCLUDES the unsolved-pair edge if
  // it's currently in LL (i.e. its home slot is in the F2L slot we're solving) —
  // since we don't yet know which AUF the user will use to align the pair.
  // Actually: simpler — just include all 4 LL edge slots' EO state. The fingerprint
  // distinguishes EO patterns regardless of which edge is the "pair edge".
  let eo = 0;
  for (let i = 0; i < 4; i++) {
    if (edgeStickerOnFace(p, i, 0) !== uColor) eo |= (1 << i);
  }

  return `${def.id}#${cFp}/${eFp}/eo${eo}`;
}

let _tablePromise: Promise<Map<string, ZblsAlgEntry[]>> | null = null;

/** y-rotations to map any slot to FR for lookup. */
const Y_ROTS_TO_FR = ['', "y'", 'y2', 'y'] as const;     // for slot FR/FL/BL/BR
const Y_ROTS_FROM_FR = ['', 'y', 'y2', "y'"] as const;   // inverse

async function buildTable(): Promise<Map<string, ZblsAlgEntry[]>> {
  if (_tablePromise) return _tablePromise;
  _tablePromise = (async () => {
    const zbls = await loadAlg('3x3', 'zbls');
    const kp = await getCube3();
    const solved = kp.defaultPattern();
    const t = new Map<string, ZblsAlgEntry[]>();

    // Build table indexed by FR-slot fingerprint of the canonical (FR-pair-on-top) state.
    // At lookup time, callers rotate user's pattern to put their pair in FR slot, then query.
    for (const c of zbls.cases) {
      const variants = c.algs[0];
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
          // Fingerprint at FR slot only (slotIdx=0).
          const fp = fingerprintAt(state, 0);
          if (fp.includes('?')) continue;
          const composed = simplifyAlg(aufInv ? `${aufInv} ${a}` : a);
          if (!composed) continue;
          const arr = t.get(fp) ?? [];
          if (!arr.some(e => e.alg === composed)) {
            arr.push({ alg: composed, caseName: c.name, oriIdx: 0 });
            t.set(fp, arr);
          }
        }
      }
    }
    return t;
  })();
  return _tablePromise;
}

/** Edge solved-with-EO-done check: U-layer slots have U-pieces oriented + the
 *  E-slice slot has its home edge oriented. Used inside the lookup as a
 *  sanity filter — many fingerprint-collision matches don't actually solve
 *  the case correctly, so we discard them up front. */
function edgeAtSlotSolved(p: KPattern, slot: number): boolean {
  const ep = p.patternData.EDGES.pieces;
  const eo = p.patternData.EDGES.orientation;
  return ep[slot] === slot && eo[slot] === 0;
}

function llEdgesOriented(p: KPattern): boolean {
  const eo = p.patternData.EDGES.orientation;
  const ep = p.patternData.EDGES.pieces;
  for (let i = 0; i < 4; i++) {
    if (eo[i] !== 0) return false;
    if (ep[i] > 3) return false;
  }
  return true;
}

/**
 * Look up ZBLS algs that solve the given slot in the canonical-frame pattern.
 *
 * Strategy: rotate user's pattern by `y^k` so their target slot lands in FR
 * position, query the FR-fingerprint table, then prefix the alg with `y^k`
 * so it executes correctly in the user's pre-rotation frame (the cube ends
 * up rotated by y^k after solving — that's fine for recon autofill, the next
 * line typically starts with another rotation or is OLL etc.).
 *
 * Each candidate alg is verified by applying it to the user's pattern and
 * checking that the target slot is solved AND LL EO is preserved/produced.
 * This drops fingerprint collisions that wouldn't actually work.
 */
export async function lookupZblsAlgs(canonical: KPattern, slotIdx: number): Promise<ZblsAlgEntry[]> {
  const t = await buildTable();
  const out: ZblsAlgEntry[] = [];
  const seen = new Set<string>();
  // The slot's E-slice piece index for solve verification.
  const targetSlotEdge = F2L_SLOT_DEFS[slotIdx].edgeSlot;
  // Rotate user's state so their slotIdx lands in FR slot.
  const yToFR = Y_ROTS_TO_FR[slotIdx];
  const yBack = Y_ROTS_FROM_FR[slotIdx];
  let rotated: KPattern;
  try { rotated = yToFR ? canonical.applyAlg(yToFR) : canonical; } catch { return out; }
  for (let k = 0; k < 4; k++) {
    const auf = AUFS[k];
    const aufInv = AUF_INV[k];
    const aufed = auf ? rotated.applyAlg(auf) : rotated;
    const fp = fingerprintAt(aufed, 0);
    const entries = t.get(fp);
    if (!entries) continue;
    for (const e of entries) {
      const parts = [yBack, aufInv, e.alg].filter(Boolean);
      const composed = simplifyAlg(parts.join(' '));
      if (!composed) continue;
      if (seen.has(composed)) continue;
      // Verify by applying to user's pattern.
      let post: KPattern;
      try { post = canonical.applyAlg(composed); } catch { continue; }
      if (!edgeAtSlotSolved(post, targetSlotEdge)) continue;
      if (!llEdgesOriented(post)) continue;
      seen.add(composed);
      out.push({ alg: composed, caseName: e.caseName, oriIdx: slotIdx });
    }
  }
  return out;
}

/** Eagerly build the table. Useful for warmup. */
export function warmupZblsTable(): Promise<void> {
  return buildTable().then(() => undefined);
}
