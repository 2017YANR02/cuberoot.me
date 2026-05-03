/**
 * Reproduce trial 16 from the stress test and trace what's happening.
 */
import { Alg } from 'cubing/alg';
import { invertAlg, simplifyAlg, patternFromAlg } from '../src/utils/cube3';
import { detectStage, F2L_SLOT_DEFS } from '../src/utils/stage_detect';
import { suggestAlg } from '../src/utils/recon_autofill_core';
import f2lDb from '../../shared/data/algdb_3x3_f2l.json' with { type: 'json' };
import ollDb from '../../shared/data/algdb_3x3_oll.json' with { type: 'json' };
import pllDb from '../../shared/data/algdb_3x3_pll.json' with { type: 'json' };

interface Case { name: string; algs: Array<Array<{ alg: string }>> }
const f2lCases = (f2lDb as { cases: Case[] }).cases;
const ollCases = (ollDb as { cases: Case[] }).cases;
const pllCases = (pllDb as { cases: Case[] }).cases;

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}
function pickRandomAlg(c: Case, oriIdx: number, rand: () => number): string | null {
  const variants = c.algs[oriIdx] ?? [];
  if (!variants.length) return null;
  return pickRandom(variants, rand).alg || null;
}

const trial = 16;
let s = trial * 7919 + 31;
const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

const f2lAlgs: string[] = [];
const f2lInfo: { caseName: string; alg: string; oriIdx: number }[] = [];
for (let oriIdx = 0; oriIdx < 4; oriIdx++) {
  const c = pickRandom(f2lCases, rand);
  const a = pickRandomAlg(c, oriIdx, rand);
  if (!a) throw new Error('null alg');
  f2lAlgs.push(a);
  f2lInfo.push({ caseName: c.name, alg: a, oriIdx });
}
const ollCase = pickRandom(ollCases, rand);
const ollAlg = pickRandomAlg(ollCase, 0, rand)!;
const pllCase = pickRandom(pllCases, rand);
const pllAlg = pickRandomAlg(pllCase, 0, rand)!;

console.log('Picked:');
for (const f of f2lInfo) console.log(`  F2L ori=${f.oriIdx}: ${f.caseName} → ${f.alg}`);
console.log(`  OLL: ${ollCase.name} → ${ollAlg}`);
console.log(`  PLL: ${pllCase.name} → ${pllAlg}`);

const solution = [...f2lAlgs, ollAlg, pllAlg].join(' ');
const scramble = invertAlg(solution);

console.log(`\nscramble: ${simplifyAlg(scramble)}`);

// Walk through each line
const lines = [
  { alg: f2lAlgs[0], comment: '// F2L 1' },
  { alg: f2lAlgs[1], comment: '// F2L 2' },
  { alg: f2lAlgs[2], comment: '// F2L 3' },
  { alg: f2lAlgs[3], comment: '// F2L 4' },
  { alg: ollAlg, comment: '// OLL' },
  { alg: pllAlg, comment: '// PLL' },
];

for (let lineIdx = 0; lineIdx <= 6; lineIdx++) {
  const previousLines = lines.slice(0, lineIdx).map(l => `${l.alg} ${l.comment}`);
  const value = previousLines.length ? previousLines.join('\n') + '\n' : '';
  const caret = value.length;

  const preStateAlg = [scramble, ...lines.slice(0, lineIdx).map(l => l.alg)].filter(Boolean).join(' ');
  const preState = await patternFromAlg(preStateAlg);
  const info = await detectStage(preState);

  console.log(`\n--- After line ${lineIdx} (${lineIdx === 0 ? 'fresh' : lines[lineIdx - 1].comment}) ---`);
  console.log(`  preState stage: ${info.stage}, solvedSlots: [${info.solvedSlots.join(',')}], crossColor: ${info.crossColor?.letter}`);
  console.log(`  centers: [${preState.patternData.CENTERS.pieces.join(',')}]`);

  const suggestions = await suggestAlg(scramble, value, caret);
  if (!suggestions) {
    console.log('  suggestAlg → NULL');
  } else {
    console.log(`  suggestAlg → ${suggestions.length} suggestions`);
    for (const s of suggestions.slice(0, 3)) {
      console.log(`    [${s.category}] ${s.caseName}: ${s.text}`);
    }
  }
}
