// Probe: verify the f2l_lookup table actually produces algs that solve the
// queried slot when applied to preCanonical.
//
// User's example:
//   scramble: F U2 R' F2 L' B2 D2 R D2 U2 B D R' U' F2 L' R2 F'
//   solution: x' // insp
//             (D U')↑ L l D' L'
//   Tab on blank 3rd line.
//
// Expected: 4 F2L candidates, each one solving a different slot.
// Reported bug: "U2 L' U L U2 F U F'" was suggested but doesn't solve any slot.

import { patternFromAlg, simplifyAlg, getCube3, invertAlg } from '../src/utils/cube3';
import { bestOrientationAlg, evaluateCanonical, F2L_SLOT_DEFS, detectStage } from '../src/utils/stage_detect';
import {
  CORNER_STICKERS, EDGE_STICKERS,
  cornerStickerOnFace, edgeStickerOnFace,
} from '../src/utils/sticker_tables';
// Load algdb directly to avoid pulling shared package's CSS imports through tsx.
import f2lDb from '../../shared/data/algdb_3x3_f2l.json' with { type: 'json' };
import advF2lDb from '../../shared/data/algdb_3x3_adv-f2l.json' with { type: 'json' };
import type { KPattern } from 'cubing/kpuzzle';
import type { AlgdbFile } from '../../shared/src/algdb';

// ---- inline the lookup (so we hit the same logic without importing shared) ----
const AUFS = ['', 'U', 'U2', "U'"] as const;
const AUF_INV = ['', "U'", 'U2', 'U'] as const;

function fingerprintAt(p: KPattern, slotIdx: number): string {
  const def = F2L_SLOT_DEFS[slotIdx];
  const c = p.patternData.CENTERS.pieces;
  const dColor = c[5];
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
    if (set.size === 3 && set.has(dColor) && set.has(cornerSideAColor) && set.has(cornerSideBColor)) {
      cFp = `${s}.${stickers.indexOf(dColor)}`;
      break;
    }
  }
  let eFp = '?';
  for (let s = 0; s < 12; s++) {
    const slotFaces = EDGE_STICKERS[s];
    const stickerA = edgeStickerOnFace(p, s, slotFaces[0]);
    const stickerB = edgeStickerOnFace(p, s, slotFaces[1]);
    if ((stickerA === edgeSideAColor && stickerB === edgeSideBColor)
     || (stickerA === edgeSideBColor && stickerB === edgeSideAColor)) {
      eFp = `${s}.${stickerA === edgeSideAColor ? 0 : 1}`;
      break;
    }
  }
  return `${def.id}#${cFp}/${eFp}`;
}

interface F2lAlgEntry { alg: string; caseName: string; oriIdx: number }

let _table: Map<string, F2lAlgEntry[]> | null = null;
async function buildTable() {
  if (_table) return _table;
  const f2l = f2lDb as unknown as AlgdbFile;
  const advF2l = advF2lDb as unknown as AlgdbFile;
  const kp = await getCube3();
  const solved = kp.defaultPattern();
  const t = new Map<string, F2lAlgEntry[]>();
  for (const c of [...f2l.cases, ...advF2l.cases]) {
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
  _table = t;
  return t;
}

async function lookupF2lAlgs(canonical: KPattern, slotIdx: number) {
  const t = await buildTable();
  return t.get(fingerprintAt(canonical, slotIdx)) ?? [];
}

const scramble = "F U2 R' F2 L' B2 D2 R D2 U2 B D R' U' F2 L' R2 F'";
// User has solved 1st pair + RB pair already (per their second screenshot).
const userMoves = process.env.MOVES === 'cross'
  ? "x' D U' L l D' L'"  // user's cross-only state (worst case for candidate count)
  : "x' D U' L l D' L' U' R' U' R2 U2 R' U3 F r U2 r' F'";

const preStateAlg = `${scramble} ${userMoves}`;
const preState = await patternFromAlg(preStateAlg);

const canonRot = await bestOrientationAlg(preState);
const preCanonical = canonRot ? preState.applyAlg(canonRot) : preState;
const preEval = evaluateCanonical(preCanonical);

const COLOR_NAMES = ['W','R','G','O','B','Y'];
console.log(`canonRot: "${canonRot}"`);
console.log(`raw preState centers: ${preState.patternData.CENTERS.pieces.map((p: number)=>COLOR_NAMES[p]).join(',')}`);
console.log(`canonical centers:    ${preCanonical.patternData.CENTERS.pieces.map((p: number)=>COLOR_NAMES[p]).join(',')}`);
console.log(`crossOk: ${preEval.crossOk}`);
console.log(`solvedSlots: [${preEval.solvedSlots.join(',')}]`);
console.log(`unsolved slots:`, F2L_SLOT_DEFS.filter(d => !preEval.solvedSlots.includes(d.id)).map(d => d.id));
console.log();

// Diagnostic: trace the AF2L 5 variant that's giving a false positive.
{
  const kp = await getCube3();
  const solved = kp.defaultPattern();
  const badAlg = "U' y' R U R' U L U L'";
  const baseState = solved.applyAlg(invertAlg(badAlg));
  console.log('[diag] baseState centers:', baseState.patternData.CENTERS.pieces.map((p:number)=>['W','R','G','O','B','Y'][p]).join(','));
  console.log('[diag] baseState FL fingerprint:', fingerprintAt(baseState, 1));
  // Apply badAlg back to baseState — should fully solve.
  const post = baseState.applyAlg(badAlg);
  const postCenters = post.patternData.CENTERS.pieces.map((p:number)=>['W','R','G','O','B','Y'][p]).join(',');
  console.log('[diag] baseState→alg centers:', postCenters);
  console.log('[diag] baseState→alg FL solved?', JSON.stringify(post.patternData.CORNERS), '...');
  console.log();
}

// Time the table build (one-time cost)
const t0 = performance.now();
await buildTable();
const t1 = performance.now();
console.log(`Table build: ${(t1 - t0).toFixed(0)} ms (one-time, cached after).`);
console.log();

// Time a full Tab response: 4 slots × lookup + per-candidate verification
const t2 = performance.now();
let candTotal = 0;
for (let slotIdx = 0; slotIdx < F2L_SLOT_DEFS.length; slotIdx++) {
  if (preEval.solvedSlots.includes(F2L_SLOT_DEFS[slotIdx].id)) continue;
  const entries = await lookupF2lAlgs(preCanonical, slotIdx);
  for (const e of entries) {
    const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
    const post = preState.applyAlg(rawAlg);
    await detectStage(post);
    candTotal++;
  }
}
const t3 = performance.now();
console.log(`Full Tab path (4 slots + ${candTotal} verifications): ${(t3 - t2).toFixed(2)} ms`);
console.log();

// Dump the F2L pair location for each slot so we can see what's in front of us.
console.log('--- pair pieces in preCanonical ---');
for (let slotIdx = 0; slotIdx < F2L_SLOT_DEFS.length; slotIdx++) {
  const def = F2L_SLOT_DEFS[slotIdx];
  console.log(`[${def.id}] fingerprint = ${fingerprintAt(preCanonical, slotIdx)}`);
}
console.log();

for (let slotIdx = 0; slotIdx < F2L_SLOT_DEFS.length; slotIdx++) {
  const def = F2L_SLOT_DEFS[slotIdx];
  if (preEval.solvedSlots.includes(def.id)) {
    console.log(`[${def.id}] already solved`);
    continue;
  }
  const entries = await lookupF2lAlgs(preCanonical, slotIdx);
  console.log(`[${def.id}] ${entries.length} candidates`);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
    // Verify the way ReconAutofill now does — via detectStage.
    const post = preState.applyAlg(rawAlg);
    const postInfo = await detectStage(post);
    const slotNowSolved = postInfo.solvedSlots.includes(def.id);
    let preservedPrev = true;
    for (const prev of preEval.solvedSlots) {
      if (!postInfo.solvedSlots.includes(prev)) { preservedPrev = false; break; }
    }
    const flag = slotNowSolved && preservedPrev ? '✓' : '✗';
    console.log(`  ${flag} ${e.caseName.padEnd(8)} "${rawAlg}"`);
  }
}
