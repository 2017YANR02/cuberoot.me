import { Alg } from 'cubing/alg';
import { invertAlg, simplifyAlg, patternFromAlg } from '../src/utils/cube3';
import { detectStage, F2L_SLOT_DEFS, bestOrientationAlg, evaluateCanonical } from '../src/utils/stage_detect';
import { suggestAlg } from '../src/utils/recon_autofill_core';
import { lookupF2lAlgs } from '../src/utils/f2l_lookup';
import f2lDb from '../../shared/data/algdb_3x3_f2l.json' with { type: 'json' };
import ollDb from '../../shared/data/algdb_3x3_oll.json' with { type: 'json' };
import pllDb from '../../shared/data/algdb_3x3_pll.json' with { type: 'json' };

interface Case { name: string; algs: Array<Array<{ alg: string }>> }
const f2lCases = (f2lDb as { cases: Case[] }).cases;
const ollCases = (ollDb as { cases: Case[] }).cases;
const pllCases = (pllDb as { cases: Case[] }).cases;

function pickRandom<T>(arr: T[], r: () => number): T { return arr[Math.floor(r() * arr.length)]; }
function pickAny(c: Case, oriIdx: number, r: () => number): string | null {
  const v = (c.algs[oriIdx] ?? []).filter(x => x.alg);
  return v.length ? pickRandom(v, r).alg : null;
}

const trial = 0;
let s = trial * 7919 + 53;
const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const f2lAlgs: string[] = [];
const f2lInfo: { caseName: string; alg: string; oriIdx: number }[] = [];
for (let oriIdx = 0; oriIdx < 4; oriIdx++) {
  const c = pickRandom(f2lCases, rand);
  const a = pickAny(c, oriIdx, rand)!;
  f2lAlgs.push(a);
  f2lInfo.push({ caseName: c.name, alg: a, oriIdx });
}
const ollC = pickRandom(ollCases, rand);
const ollAlg = pickAny(ollC, 0, rand)!;
const pllC = pickRandom(pllCases, rand);
const pllAlg = pickAny(pllC, 0, rand)!;
const slotOrder = [0, 1, 2, 3].sort(() => rand() - 0.5);
const orderedF2l = slotOrder.map(i => f2lAlgs[i]);

console.log('intended path:');
for (let i = 0; i < 4; i++) console.log(`  F2L line${i + 1} (slot oriIdx=${slotOrder[i]}): ${orderedF2l[i]}`);
console.log(`  OLL: ${ollAlg}`);
console.log(`  PLL: ${pllAlg}`);

const intendedAlgs = [...orderedF2l, ollAlg, pllAlg];
const scramble = invertAlg(intendedAlgs.join(' '));

// Inspect line 0 k=4 specifically
const lineIdx = 0;
const userAlg = intendedAlgs[lineIdx];
const moves = [...new Alg(userAlg).experimentalLeafMoves()].map(m => m.toString());
const k = 4;
console.log(`\nline ${lineIdx} userAlg: ${userAlg}`);
console.log(`first ${k} moves: ${moves.slice(0, k).join(' ')}`);

const value = moves.slice(0, k).join(' ') + ' ';
const caret = value.length;

const startState = await patternFromAlg(scramble);
const info = await detectStage(startState);
console.log(`\nstartState stage: ${info.stage}, solvedSlots: [${info.solvedSlots.join(',')}], crossColor: ${info.crossColor?.letter}`);
console.log(`centers: [${startState.patternData.CENTERS.pieces.join(',')}]`);

const canonRot = await bestOrientationAlg(startState);
const startCanonical = canonRot ? startState.applyAlg(canonRot) : startState;
console.log(`canonRot: "${canonRot || '(none)'}"`);
const preEval = evaluateCanonical(startCanonical);
console.log(`preEval: crossOk=${preEval.crossOk}, solvedSlots=[${preEval.solvedSlots.join(',')}]`);

console.log('\nUnsolved slot lookups:');
const solvedSet = new Set(preEval.solvedSlots);
for (let slotIdx = 0; slotIdx < F2L_SLOT_DEFS.length; slotIdx++) {
  const slotId = F2L_SLOT_DEFS[slotIdx].id;
  if (solvedSet.has(slotId)) continue;
  const entries = await lookupF2lAlgs(startCanonical, slotIdx);
  console.log(`  slot ${slotId}: ${entries.length} candidates`);
  for (const e of entries.slice(0, 3)) {
    const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
    console.log(`    ${e.caseName}: ${rawAlg}`);
  }
}

const suggestions = await suggestAlg(scramble, value, caret);
console.log(`\nsuggestAlg → ${suggestions ? suggestions.length + ' suggestions' : 'NULL'}`);
if (suggestions) {
  for (const sg of suggestions) console.log(`  [${sg.category}] ${sg.caseName}: ${sg.text}`);
}

// Verify: does intendedAlgs[0] actually solve a slot when applied to startState?
const postLine0 = startState.applyAlg(intendedAlgs[0]);
const postInfo = await detectStage(postLine0);
console.log(`\nApplying intended line 0 (${intendedAlgs[0]}) to startState:`);
console.log(`  post stage=${postInfo.stage}, solvedSlots=[${postInfo.solvedSlots.join(',')}]`);

// Also check if this alg (or equivalent) is in the lookup at startCanonical (with y).
console.log(`\nIs intended alg in any slot's lookup result?`);
for (let slotIdx = 0; slotIdx < F2L_SLOT_DEFS.length; slotIdx++) {
  const entries = await lookupF2lAlgs(startCanonical, slotIdx);
  const hits = entries.filter(e => {
    const raw = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
    return raw === intendedAlgs[0] || e.alg === intendedAlgs[0];
  });
  if (hits.length) console.log(`  slot ${F2L_SLOT_DEFS[slotIdx].id}: matched ${hits.length} entries`);
}
