/**
 * Probe: verify OLL/PLL fingerprint lookups round-trip correctly.
 *
 * For each OLL case:
 *   - Apply alg^-1 to solved → an OLL case state.
 *   - For each AUF wrap, look up algs and confirm at least one is found and
 *     applying it returns the cube to OLL-done (top fully oriented).
 *
 * For each PLL case:
 *   - Apply alg^-1 to solved → a PLL case state.
 *   - For each (preAuf, postAuf), look up and confirm at least one matches
 *     and applying it returns the cube to fully solved.
 */

import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';
import { getCube3, invertAlg, simplifyAlg } from '../src/utils/cube3';
import { ollFingerprint, lookupOllAlgs } from '../src/utils/oll_lookup';
import { pllFingerprint, lookupPllAlgs } from '../src/utils/pll_lookup';
import { detectStage } from '../src/utils/stage_detect';
import ollDb from '../../shared/data/algdb_3x3_oll.json' with { type: 'json' };
import pllDb from '../../shared/data/algdb_3x3_pll.json' with { type: 'json' };

const AUFS = ['', 'U', 'U2', "U'"];

interface DbCase { name: string; algs: Array<Array<{ alg: string }>> }

async function probeOll() {
  console.log('=== OLL probe ===');
  const kp = await getCube3();
  const solved = kp.defaultPattern();
  let pass = 0;
  let fail = 0;
  for (const c of (ollDb as { cases: DbCase[] }).cases) {
    const variants = c.algs[0] ?? [];
    if (!variants.length) continue;
    const a = variants[0].alg;
    const invA = invertAlg(a);
    if (!invA) continue;
    for (const auf of AUFS) {
      const setup = simplifyAlg([invA, auf].filter(Boolean).join(' '));
      let state: KPattern;
      try { state = solved.applyAlg(setup); } catch {
        console.log(`  ${c.name} (auf=${auf || 'none'}): SETUP FAILED`);
        fail++;
        continue;
      }
      const fp = ollFingerprint(state);
      const entries = await lookupOllAlgs(state);
      if (entries.length === 0) {
        console.log(`  ${c.name} (auf=${auf || 'none'}): NO MATCH (fp=${fp})`);
        fail++;
        continue;
      }
      let solvedAny = false;
      for (const e of entries) {
        const post = state.applyAlg(e.alg);
        const info = await detectStage(post);
        if (info.stage === 'oll' || info.stage === 'solved') {
          solvedAny = true;
          break;
        }
      }
      if (solvedAny) pass++;
      else {
        console.log(`  ${c.name} (auf=${auf || 'none'}): match found but no entry orients top`);
        fail++;
      }
    }
  }
  console.log(`  pass=${pass} fail=${fail}`);
  return fail === 0;
}

async function probePll() {
  console.log('=== PLL probe ===');
  const kp = await getCube3();
  const solved = kp.defaultPattern();
  let pass = 0;
  let fail = 0;
  for (const c of (pllDb as { cases: DbCase[] }).cases) {
    const variants = c.algs[0] ?? [];
    if (!variants.length) continue;
    const a = variants[0].alg;
    const invA = invertAlg(a);
    if (!invA) continue;
    for (const preAuf of AUFS) {
      for (const postAuf of AUFS) {
        // Setup: apply (preAuf · alg · postAuf)^-1 to solved.
        // = postAufInv · invA · preAufInv. Easier: invertAlg of composed.
        const composed = simplifyAlg([preAuf, a, postAuf].filter(Boolean).join(' '));
        const inv = invertAlg(composed);
        if (!inv) continue;
        let state: KPattern;
        try { state = solved.applyAlg(inv); } catch {
          fail++;
          continue;
        }
        const fp = pllFingerprint(state);
        const entries = await lookupPllAlgs(state);
        if (entries.length === 0) {
          console.log(`  ${c.name} (pre=${preAuf || '_'}, post=${postAuf || '_'}): NO MATCH (fp=${fp})`);
          fail++;
          continue;
        }
        let solvedAny = false;
        for (const e of entries) {
          const post = state.applyAlg(e.alg);
          const info = await detectStage(post);
          if (info.stage === 'solved') {
            solvedAny = true;
            break;
          }
        }
        if (solvedAny) pass++;
        else {
          console.log(`  ${c.name} (pre=${preAuf || '_'}, post=${postAuf || '_'}): match found but no entry solves`);
          fail++;
        }
      }
    }
  }
  console.log(`  pass=${pass} fail=${fail}`);
  return fail === 0;
}

let ollOk = await probeOll();
const pllOk = await probePll();

// End-to-end probe: a real solve flow with explicit AUF requirement.
console.log('\n=== End-to-end: F2L done → OLL → PLL ===');
{
  const kp = await getCube3();
  const solved = kp.defaultPattern();
  // Build a state that's "solved cube with U-perm-a applied (PLL) and OLL applied (a Sune)".
  // Setup: solved · invert(Sune) · invert(Ua perm)
  const sunePll = "U R U R' U R U2 R'";
  const invSune = invertAlg(sunePll);
  const uaPerm = "R U' R U R U R U' R' U' R2";
  const invUa = invertAlg(uaPerm);
  // Apply invUa first (creates PLL state), then invSune on top (twists corners → OLL state).
  const state = solved.applyAlg(`${invUa} ${invSune}`);
  console.log('initial detectStage:', (await detectStage(state)).stage);

  // OLL lookup
  const ollEntries = await lookupOllAlgs(state);
  console.log(`OLL candidates: ${ollEntries.length}`);
  let ollAlg: string | null = null;
  for (const e of ollEntries) {
    const post = state.applyAlg(e.alg);
    const info = await detectStage(post);
    if (info.stage === 'oll' || info.stage === 'solved') {
      ollAlg = e.alg;
      console.log(`  → ${e.caseName}: ${e.alg}`);
      break;
    }
  }

  // After OLL → PLL lookup
  if (ollAlg) {
    const afterOll = state.applyAlg(ollAlg);
    const pllEntries = await lookupPllAlgs(afterOll);
    console.log(`PLL candidates: ${pllEntries.length}`);
    let pllAlg: string | null = null;
    for (const e of pllEntries) {
      const post = afterOll.applyAlg(e.alg);
      const info = await detectStage(post);
      if (info.stage === 'solved') {
        pllAlg = e.alg;
        console.log(`  → ${e.caseName}: ${e.alg}`);
        break;
      }
    }
    if (pllAlg) console.log('full chain solves: YES');
    else console.log('full chain solves: NO (PLL match failed to verify)');
  }
}

// Probe with realistic scramble + partial solve (cross on white = inspection x2 ⇒ white-on-D).
console.log('\n=== Realistic scramble + cross-on-bottom (x2 inspection) ===');
{
  const { bestOrientationAlg, F2L_SLOT_DEFS } = await import('../src/utils/stage_detect');
  const kp = await getCube3();
  const scramble = "R U R' F R U R' U' R' F R2 U' R' U2 R U' R'"; // T-perm-ish, reaches a non-trivial state
  // Pretend user does cross+F2L+OLL+PLL: `scramble · invFullSolve` reaches ... actually let's just do scramble alone
  // and see what stage we're at — then probe lookups for the appropriate next stage.
  // Better: build a state pre-OLL by applying solving moves then a known OLL setup.
  const inspection = "x'"; // typical: white was on F → after x' it's on D
  const invOllSetup = invertAlg("R U R' U' R' F R F'"); // sample OLL alg (Tperm-like? actually F-OLL)
  const state = kp.defaultPattern().applyAlg(`${inspection} ${invOllSetup}`);
  const stage = await detectStage(state);
  console.log(`stage: ${stage.stage}, solvedSlots: [${stage.solvedSlots.join(',')}]`);
  void scramble; void F2L_SLOT_DEFS;
  if (stage.stage === 'f2l') {
    const canonRot = await bestOrientationAlg(state);
    const canonical = canonRot ? state.applyAlg(canonRot) : state;
    const entries = await lookupOllAlgs(canonical);
    console.log(`canonRot: "${canonRot || '(none)'}", OLL candidates: ${entries.length}`);
    let ok = false;
    for (const e of entries.slice(0, 3)) {
      const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
      const post = state.applyAlg(rawAlg);
      const info = await detectStage(post);
      if (info.stage === 'oll' || info.stage === 'solved') {
        console.log(`  ✓ ${e.caseName}: ${rawAlg}`);
        ok = true;
      } else {
        console.log(`  ✗ ${e.caseName}: ${rawAlg} → stage=${info.stage}`);
      }
    }
    if (!ok) ollOk = false;
  }
}

console.log('\n=== Frame test: x z2 inspection then OLL state ===');
{
  const { bestOrientationAlg } = await import('../src/utils/stage_detect');
  const kp = await getCube3();
  const solved = kp.defaultPattern();
  const sune = "R U R' U R U2 R'";
  const invSune = invertAlg(sune);
  const inspection = "x z2";  // arbitrary cube rotation
  const invInspection = invertAlg(inspection);
  // Simulate: user did an inspection rotation, then F2L is done, OLL is the next step.
  // State at start of OLL line = solved with OLL setup applied in the rotated frame.
  // = inspection · invSune · inverse(inspection) applied to solved (then we undo inspection at the end)
  // Simpler: state = solved.applyAlg(`${inspection} ${invSune}`)
  const rawState = solved.applyAlg(`${inspection} ${invSune}`);
  console.log('raw state stage:', (await detectStage(rawState)).stage);
  const canonRot = await bestOrientationAlg(rawState);
  console.log('canonRot:', canonRot || '(none)');
  const canonical = canonRot ? rawState.applyAlg(canonRot) : rawState;
  const ollEntries = await lookupOllAlgs(canonical);
  console.log(`OLL candidates: ${ollEntries.length}`);
  let solvedOk = false;
  for (const e of ollEntries) {
    const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
    const post = rawState.applyAlg(rawAlg);
    const info = await detectStage(post);
    if (info.stage === 'oll' || info.stage === 'solved') {
      solvedOk = true;
      console.log(`  ${e.caseName} → ${rawAlg}`);
      break;
    }
  }
  console.log('OLL via rotated frame:', solvedOk ? 'PASS' : 'FAIL');
  if (!solvedOk) { ollOk = false; }
}

// x' inspection: cross on white originally → after x', white is on F. Then if user
// solves "white cross on F" they are working in a frame where their D-color is green.
// We need bestTopRotationAlg to return `x` to put white-on-D before lookup.
console.log("\n=== Frame test: x' top rotation needed ===");
{
  const { bestTopRotationAlg } = await import('../src/utils/stage_detect');
  const kp = await getCube3();
  const sune = "R U R' U R U2 R'";
  const invSune = invertAlg(sune);
  // Apply x' first then OLL setup. After x', the U-face has color 2 (green), so
  // top stickers in a "U-color (green) is up" orientation.
  const state = kp.defaultPattern().applyAlg(`x' ${invSune}`);
  const stage = await detectStage(state);
  console.log(`stage: ${stage.stage}`);
  const canonRotTop = await bestTopRotationAlg(state);
  console.log(`bestTopRotationAlg: "${canonRotTop || '(none)'}"`);
  const canonical = canonRotTop ? state.applyAlg(canonRotTop) : state;
  const entries = await lookupOllAlgs(canonical);
  console.log(`OLL candidates: ${entries.length}`);
  let ok = false;
  for (const e of entries) {
    const rawAlg = canonRotTop ? simplifyAlg(`${canonRotTop} ${e.alg}`) : e.alg;
    const post = state.applyAlg(rawAlg);
    const info = await detectStage(post);
    if (info.stage === 'oll' || info.stage === 'solved') {
      console.log(`  ${e.caseName} → ${rawAlg}`);
      ok = true;
      break;
    }
  }
  if (!ok) {
    console.log('  FAIL');
    ollOk = false;
  }
}

if (!ollOk || !pllOk) {
  console.error('\nFAIL');
  process.exit(1);
}
console.log('\nOK');
