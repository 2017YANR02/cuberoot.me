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

function isFaceTurnOnly(alg: string): boolean {
  return alg.split(/\s+/).filter(Boolean).every(t => /^[UDFBLR]['2]?$/.test(t));
}
function pickRandom<T>(arr: T[], r: () => number): T { return arr[Math.floor(r() * arr.length)]; }
function pickFt(c: Case, oriIdx: number, r: () => number): string | null {
  const v = (c.algs[oriIdx] ?? []).filter(x => x.alg && isFaceTurnOnly(x.alg));
  return v.length ? pickRandom(v, r).alg : null;
}

// Reproduce trial 7 from probe_stress2 (first failing trial)
let s = 7 * 7919 + 13;
const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const f2lAlgs: string[] = [];
const f2lInfo: { caseName: string; alg: string; oriIdx: number }[] = [];
for (let oriIdx = 0; oriIdx < 4; oriIdx++) {
  const c = pickRandom(f2lCases, rand);
  const a = pickFt(c, oriIdx, rand);
  f2lAlgs.push(a!);
  f2lInfo.push({ caseName: c.name, alg: a!, oriIdx });
}
const ollC = pickRandom(ollCases, rand);
const ollAlg = pickFt(ollC, 0, rand)!;
const pllC = pickRandom(pllCases, rand);
const pllAlg = pickFt(pllC, 0, rand)!;
const slotOrder = [0, 1, 2, 3].sort(() => rand() - 0.5);
const orderedF2l = slotOrder.map(i => f2lAlgs[i]);

console.log('f2l info:');
for (let i = 0; i < f2lInfo.length; i++) console.log(`  i=${i}: ori=${f2lInfo[i].oriIdx} ${f2lInfo[i].caseName} → ${f2lInfo[i].alg}`);
console.log(`slotOrder: [${slotOrder.join(',')}]`);
console.log(`orderedF2l[1]: ${orderedF2l[1]}`);

const solution = [...orderedF2l, ollAlg, pllAlg].join(' ');
const scramble = invertAlg(solution);
console.log(`scramble: ${simplifyAlg(scramble)}`);

// Mimic probe_stress2 partial test: use top suggestion as prev each line
let prev = '';
for (let lineIdx = 0; lineIdx < 4; lineIdx++) {
  const userAlg = orderedF2l[lineIdx];
  const moves = [...new Alg(userAlg).experimentalLeafMoves()].map(m => m.toString());
  // The k from rand sequence — for accurate reproduction we must consume the exact rand calls.
  const k = Math.floor(rand() * moves.length);
  const partial = moves.slice(0, k).join(' ');
  const value = prev + (partial ? partial + ' ' : '');
  const caret = value.length;
  console.log(`\n=== line ${lineIdx} k=${k} ===`);
  console.log(`userAlg: ${userAlg}, partial: "${partial}"`);
  console.log(`prev:`);
  for (const l of prev.split('\n')) console.log(`  > ${l}`);
  console.log(`value tail: "${value.substring(prev.length)}"`);

  const suggestions = await suggestAlg(scramble, value, caret);
  if (!suggestions || suggestions.length === 0) {
    console.log(`  → NO SUGGESTIONS`);
    // Diagnose
    const prevAsAlg = prev.split('\n').filter(Boolean).map(l => l.split('//')[0].trim()).filter(Boolean).join(' ');
    const startStateAlg = `${scramble} ${prevAsAlg}`.trim();
    const startState = await patternFromAlg(startStateAlg);
    const info = await detectStage(startState);
    console.log(`  startState stage: ${info.stage}, solvedSlots: [${info.solvedSlots.join(',')}], crossColor: ${info.crossColor?.letter}`);
    const canonRot = await bestOrientationAlg(startState);
    const startCanonical = canonRot ? startState.applyAlg(canonRot) : startState;
    const preEval = evaluateCanonical(startCanonical);
    console.log(`  canonRot=${canonRot || '(none)'} crossOk=${preEval.crossOk} solvedSlots=[${preEval.solvedSlots.join(',')}]`);
    const solvedSet = new Set(preEval.solvedSlots);
    for (let slotIdx = 0; slotIdx < F2L_SLOT_DEFS.length; slotIdx++) {
      const slotId = F2L_SLOT_DEFS[slotIdx].id;
      if (solvedSet.has(slotId)) continue;
      const entries = await lookupF2lAlgs(startCanonical, slotIdx);
      console.log(`  slot ${slotId}: ${entries.length} candidates (showing first 3)`);
      for (const e of entries.slice(0, 3)) {
        const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
        console.log(`    ${e.caseName}: ${rawAlg}`);
      }
    }
    break;
  }
  const top = suggestions[0];
  console.log(`  → top: [${top.category}] ${top.caseName}: ${top.text}`);
  prev += `${top.text} // F2L ${lineIdx + 1}\n`;
}
