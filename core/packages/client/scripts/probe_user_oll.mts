/**
 * Reproduce the user's reported scenario: after F2L, Tab on next line gives
 * no OLL candidates.
 *
 * Scramble: F2 D B2 D' L D F2 U2 B D U' L F D' R' B D2 U'
 * Solution (with annotations stripped):
 *   y' // insp
 *   U' R2' F R D' R D' // Y cross
 *   R' U R // RG
 *   L' U2 L U' L U L' // RB        (originally with `· ... ↑` which we strip)
 *   U' R U R' F U F' // OB
 *   U R' F R F' R U' R2' F R F' // OG/ZBLS
 */
import { Alg } from 'cubing/alg';
import { detectStage, bestOrientationAlg } from '../src/utils/stage_detect';
import { patternFromAlg, simplifyAlg } from '../src/utils/cube3';
import { lookupOllAlgs } from '../src/utils/oll_lookup';

const scramble = "F2 D B2 D' L D F2 U2 B D U' L F D' R' B D2 U'";

// Test 1: cleaned solution (no special chars)
const cleanSolution = [
  "y'",
  "U' R2' F R D' R D'",
  "R' U R",
  "L' U2 L U' L U L'",
  "U' R U R' F U F'",
  "U R' F R F' R U' R2' F R F'",
].join(' ');

// Test 2: raw solution as user typed (with ↑ ·  ... markers)
const rawSolution = `y'
↑U' R2' F R D' R D'
 R' U R
 ·L' U2 L U'...L U L'
 U' R U R' F U F'
 U R' F R F' R U' R2' F R F'`;

// Mirror the runtime movesOnly() pipeline
function movesOnly(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const i = line.indexOf('//');
      return (i >= 0 ? line.substring(0, i) : line);
    })
    .join(' ')
    .replace(/[^A-Za-z0-9'\s]/g, ' ')
    .replace(/([UDFBLRMESxyzudfblr])(?=[UDFBLRMESxyzudfblr])/g, '$1 ')
    .replace(/(')(?=[A-Za-z])/g, '$1 ')
    .replace(/(\d)(?=[A-Za-z])/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('=== Test 1: clean solution (full canonRot) ===');
{
  const stateAlg = `${scramble} ${cleanSolution}`;
  const state = await patternFromAlg(stateAlg);
  const info = await detectStage(state);
  console.log(`stage: ${info.stage}, solvedSlots: [${info.solvedSlots.join(',')}], crossColor: ${info.crossColor?.letter}`);
  if (info.stage === 'f2l') {
    const canonRot = await bestOrientationAlg(state);
    const canonical = canonRot ? state.applyAlg(canonRot) : state;
    const entries = await lookupOllAlgs(canonical);
    console.log(`bestOrientationAlg: "${canonRot}", OLL candidates: ${entries.length}`);
    if (entries.length > 0) {
      const first = entries[0];
      const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${first.alg}`) : first.alg;
      console.log(`first: ${first.caseName} → ${rawAlg}`);
    }
  }
}

console.log('\n=== Test 1b: clean solution (top-only canonRot) ===');
{
  const { bestTopRotationAlg } = await import('../src/utils/stage_detect');
  const stateAlg = `${scramble} ${cleanSolution}`;
  const state = await patternFromAlg(stateAlg);
  const info = await detectStage(state);
  if (info.stage === 'f2l') {
    const canonRot = await bestTopRotationAlg(state);
    const canonical = canonRot ? state.applyAlg(canonRot) : state;
    const entries = await lookupOllAlgs(canonical);
    console.log(`bestTopRotationAlg: "${canonRot || '(none)'}", OLL candidates: ${entries.length}`);
    // Find shortest valid
    let best: { alg: string; caseName: string } | null = null;
    for (const e of entries) {
      const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
      const post = state.applyAlg(rawAlg);
      const dInfo = await detectStage(post);
      if (dInfo.stage === 'oll' || dInfo.stage === 'solved') {
        if (!best || rawAlg.length < best.alg.length) best = { alg: rawAlg, caseName: e.caseName };
      }
    }
    console.log(`shortest: ${best?.caseName} → ${best?.alg}`);
  }
}

console.log('\n=== Test 2: raw solution through movesOnly() ===');
{
  const cleaned = movesOnly(rawSolution);
  console.log(`movesOnly output: "${cleaned}"`);
  try {
    const tokens = [...new Alg(cleaned).experimentalLeafMoves()].map(m => m.toString());
    console.log(`parse OK, ${tokens.length} tokens`);
  } catch (e) {
    console.log(`PARSE FAILED: ${(e as Error).message}`);
  }

  const stateAlg = `${scramble} ${cleaned}`;
  const state = await patternFromAlg(stateAlg);
  const info = await detectStage(state);
  console.log(`stage: ${info.stage}, solvedSlots: [${info.solvedSlots.join(',')}], crossColor: ${info.crossColor?.letter}`);
  if (info.stage === 'f2l') {
    const canonRot = await bestOrientationAlg(state);
    const canonical = canonRot ? state.applyAlg(canonRot) : state;
    const entries = await lookupOllAlgs(canonical);
    console.log(`OLL candidates: ${entries.length}`);
  }
}

// Test individual move parsing edge cases
const dots = '...';
const tricky = `U'${dots}L`;
console.log(`\n=== Edge: does cubing.js Alg parse "${tricky}"? ===`);
try {
  const a = new Alg(tricky);
  const tokens = [...a.experimentalLeafMoves()].map(m => m.toString());
  console.log(`OK: ${tokens.join(' ')}`);
} catch (e) {
  console.log(`FAIL: ${(e as Error).message}`);
}

console.log('\n=== Debug: orientation scores for user state ===');
{
  const { F2L_SLOT_DEFS } = await import('../src/utils/stage_detect');
  const { getCube3 } = await import('../src/utils/cube3');
  void F2L_SLOT_DEFS;
  void getCube3;
  const stateAlg = `${scramble} ${cleanSolution}`;
  const state = await patternFromAlg(stateAlg);
  const ROTS = ['', 'y', 'y2', "y'"];
  for (const r of ROTS) {
    const t = r ? state.applyAlg(r) : state;
    const info = await detectStage(t);
    console.log(`  rot="${r||'_'}": stage=${info.stage} solvedSlots=[${info.solvedSlots.join(',')}] U-center=${t.patternData.CENTERS.pieces[0]} D-center=${t.patternData.CENTERS.pieces[5]} F-center=${t.patternData.CENTERS.pieces[2]}`);
  }

  // Direct check: at identity, what does crossSolved return? Sticker by sticker.
  console.log('\n  Centers in raw state:', state.patternData.CENTERS.pieces);
  console.log('  Edges pieces:', state.patternData.EDGES.pieces);
  console.log('  Edges orient:', state.patternData.EDGES.orientation);

  // Direct score per rotation (mirroring bestOrientationAlg logic without bestOrientation recursion)
  const { edgeStickerOnFace, cornerStickerOnFace, EDGE_STICKERS, CORNER_STICKERS } = await import('../src/utils/sticker_tables');
  function rawScore(p: typeof state): { cross: boolean; slots: number; ollOk: boolean } {
    const c = p.patternData.CENTERS.pieces;
    const cAt = (f: number) => c[f];
    const edgeOk = (slot: number) => {
      const [fA, fB] = EDGE_STICKERS[slot];
      return edgeStickerOnFace(p, slot, fA) === cAt(fA)
          && edgeStickerOnFace(p, slot, fB) === cAt(fB);
    };
    const cornerOk = (slot: number) => {
      const [fA, fB, fC] = CORNER_STICKERS[slot];
      return cornerStickerOnFace(p, slot, fA) === cAt(fA)
          && cornerStickerOnFace(p, slot, fB) === cAt(fB)
          && cornerStickerOnFace(p, slot, fC) === cAt(fC);
    };
    const cross = edgeOk(4) && edgeOk(5) && edgeOk(6) && edgeOk(7);
    let slots = 0;
    if (edgeOk(8) && cornerOk(4)) slots++;
    if (edgeOk(9) && cornerOk(5)) slots++;
    if (edgeOk(11) && cornerOk(6)) slots++;
    if (edgeOk(10) && cornerOk(7)) slots++;
    const uColor = cAt(0);
    let ollOk = true;
    for (let s = 0; s < 4; s++) {
      if (edgeStickerOnFace(p, s, 0) !== uColor) ollOk = false;
      if (cornerStickerOnFace(p, s, 0) !== uColor) ollOk = false;
    }
    return { cross, slots, ollOk };
  }
  console.log('\n  Direct (raw) per-rotation scores:');
  for (const r of ROTS) {
    const t = r ? state.applyAlg(r) : state;
    const sc = rawScore(t);
    const finalScore = (sc.cross ? 100 : 0) + sc.slots * 5 + (sc.cross && sc.ollOk ? 1 : 0);
    console.log(`    rot="${r||'_'}": cross=${sc.cross} slots=${sc.slots} ollOk=${sc.ollOk} finalScore=${finalScore}`);
  }

  console.log('\n  Direct lookup at each rotation (no canonRot prefix):');
  const { lookupOllAlgs, ollFingerprint } = await import('../src/utils/oll_lookup');
  for (const r of ROTS) {
    const t = r ? state.applyAlg(r) : state;
    const fp = ollFingerprint(t);
    const entries = await lookupOllAlgs(t);
    console.log(`    rot="${r||'_'}": fp=${fp} entries=${entries.length}`);
    if (entries.length > 0) {
      // Show shortest entry that solves t
      let best: { alg: string; caseName: string } | null = null;
      for (const e of entries) {
        try {
          const post = t.applyAlg(e.alg);
          const info = await detectStage(post);
          if (info.stage === 'oll' || info.stage === 'solved') {
            if (!best || e.alg.length < best.alg.length) best = e;
          }
        } catch { /* skip */ }
      }
      if (best) console.log(`      shortest valid: ${best.caseName} → ${best.alg} (length ${best.alg.length})`);
      else console.log(`      no entry verifies`);
    }
  }
}
