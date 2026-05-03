// Probe: user reports Tab gives no F2L hints after xcross.
// Scramble: D2 U2 B' D' R' F L U' B L2 D2 F' L F U2 B2 F2 R
// Solution: x' z // insp
//           l' U2 L2 R' F R2 U' D R' F R F' // Y xcross (GR)
// Expected: F2L candidates for the remaining 3 unsolved slots.

import { Alg } from 'cubing/alg';
import { patternFromAlg, simplifyAlg, getCube3, invertAlg } from '../src/utils/cube3';
import { bestOrientationAlg, evaluateCanonical, F2L_SLOT_DEFS, detectStage } from '../src/utils/stage_detect';
import {
  CORNER_STICKERS, EDGE_STICKERS,
  cornerStickerOnFace, edgeStickerOnFace,
} from '../src/utils/sticker_tables';
import f2lDb from '../../shared/data/algdb_f2l.json' with { type: 'json' };
import advF2lDb from '../../shared/data/algdb_adv_f2l.json' with { type: 'json' };
import type { KPattern } from 'cubing/kpuzzle';
import type { AlgdbFile } from '../../shared/src/algdb';

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

// Mirror movesOnly's normalization (in ReconAutofill.tsx) so probe matches runtime.
function normalizeMerged(s: string): string {
  return s
    .replace(/([UDFBLRMESxyzudfblr])(?=[UDFBLRMESxyzudfblr])/g, '$1 ')
    .replace(/(')(?=[A-Za-z])/g, '$1 ')
    .replace(/(\d)(?=[A-Za-z])/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

const scramble = "D2 U2 B' D' R' F L U' B L2 D2 F' L F U2 B2 F2 R";
const userSolutionA = "x' z l' U2 L2 R' F R2 U' D R' F R F'";
const userSolutionB = "x' z l' U2 L2 R' F R2 U'D R' F R F'";
const userSolutionC = normalizeMerged("x' z l' U2 L2 R' F R2 U'D R' F R F'");

for (const [label, sol] of [
  ['with space', userSolutionA],
  ['no space (raw)', userSolutionB],
  ['no space (normalized)', userSolutionC],
] as const) {
  console.log(`\n=== ${label}: "${sol}" ===`);
  try {
    const a = new Alg(sol);
    const moves = [...a.experimentalLeafMoves()].map(m => m.toString());
    console.log(`leafMoves (${moves.length}):`, moves.join(' / '));
  } catch (e) {
    console.log(`Alg PARSE FAILED:`, (e as Error).message);
  }

  const preStateAlg = `${scramble} ${sol}`;
  const preState = await patternFromAlg(preStateAlg);
  const COLOR_NAMES = ['W','R','G','O','B','Y'];
  console.log(`pre centers: ${preState.patternData.CENTERS.pieces.map((p:number)=>COLOR_NAMES[p]).join(',')}`);

  const canonRot = await bestOrientationAlg(preState);
  const preCanonical = canonRot ? preState.applyAlg(canonRot) : preState;
  const preEval = evaluateCanonical(preCanonical);
  console.log(`canonRot: "${canonRot}"`);
  console.log(`canonical centers: ${preCanonical.patternData.CENTERS.pieces.map((p:number)=>COLOR_NAMES[p]).join(',')}`);
  console.log(`crossOk: ${preEval.crossOk}`);
  console.log(`solvedSlots: [${preEval.solvedSlots.join(',')}]`);

  const info = await detectStage(preState);
  console.log(`detectStage → stage=${info.stage} solvedSlots=[${info.solvedSlots.join(',')}] crossColor=${info.crossColor?.letter}`);

  if (preEval.crossOk) {
    const solvedSet = new Set(preEval.solvedSlots);
    let totalCands = 0;
    for (let slotIdx = 0; slotIdx < F2L_SLOT_DEFS.length; slotIdx++) {
      const slotId = F2L_SLOT_DEFS[slotIdx].id;
      if (solvedSet.has(slotId)) {
        console.log(`  [${slotId}] already solved, skip`);
        continue;
      }
      const entries = await lookupF2lAlgs(preCanonical, slotIdx);
      let validCount = 0;
      for (const e of entries) {
        const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
        const post = preState.applyAlg(rawAlg);
        const postInfo = await detectStage(post);
        const slotNow = postInfo.solvedSlots.includes(slotId);
        let preserved = true;
        for (const prev of preEval.solvedSlots) {
          if (!postInfo.solvedSlots.includes(prev)) { preserved = false; break; }
        }
        if (slotNow && preserved) validCount++;
      }
      console.log(`  [${slotId}] fp=${fingerprintAt(preCanonical, slotIdx)} ${entries.length} fingerprint matches, ${validCount} pass verification`);
      totalCands += validCount;
    }
    console.log(`Total valid F2L candidates: ${totalCands}`);
  }
}
