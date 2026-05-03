/**
 * Stress-test: synthesise N random recon scenarios spanning F2L→OLL→PLL.
 *
 * For each scenario:
 *   1. Pick 4 random F2L cases (one per slot ori), 1 random OLL, 1 random PLL.
 *   2. Build solution = f2l[0] + f2l[1] + f2l[2] + f2l[3] + OLL + PLL.
 *   3. scramble = invert(solution). Applied to solved → desired starting state.
 *   4. At each line transition (0..6), simulate Tab in the textarea on a fresh
 *      blank line and verify suggestAlg returns a top suggestion that, when
 *      applied to the pre-state, advances the cube to the expected next stage.
 *
 * Reports per-stage failure counts and shows the first few failing scenarios
 * in detail so we can dig into them.
 */

import { invertAlg, simplifyAlg, patternFromAlg } from '../src/utils/cube3';
import { detectStage, F2L_SLOT_DEFS } from '../src/utils/stage_detect';
import { suggestAlg } from '../src/utils/recon_autofill_core';
import f2lDb from '../../shared/data/algdb_f2l.json' with { type: 'json' };
import ollDb from '../../shared/data/algdb_oll.json' with { type: 'json' };
import pllDb from '../../shared/data/algdb_pll.json' with { type: 'json' };

interface Case { name: string; algs: Array<Array<{ alg: string }>> }

const f2lCases = (f2lDb as { cases: Case[] }).cases;
const ollCases = (ollDb as { cases: Case[] }).cases;
const pllCases = (pllDb as { cases: Case[] }).cases;

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** True iff the alg uses only face turns (U/D/F/B/L/R + optional '/2). No
 *  slices, wides, or rotations — these shift centers and break stress-test
 *  synthesis (forward execution still works, but the synthesized "scramble"
 *  state ends up in a non-canonical orientation that the user would handle
 *  with inspection rotations). For testing the autofill at every stage in
 *  the canonical frame, we restrict to clean face-turns-only algs. */
function isFaceTurnOnly(alg: string): boolean {
  const tokens = alg.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (!/^[UDFBLR]['2]?$/.test(t)) return false;
  }
  return true;
}

function pickRandomAlg(c: Case, oriIdx: number, rand: () => number): string | null {
  const variants = (c.algs[oriIdx] ?? []).filter(v => v.alg && isFaceTurnOnly(v.alg));
  if (!variants.length) return null;
  const v = pickRandom(variants, rand);
  return v.alg || null;
}

interface Scenario {
  scramble: string;
  // 6 solution lines: F2L1, F2L2, F2L3, F2L4, OLL, PLL.
  lines: { alg: string; comment: string }[];
}

function makeScenario(seed: number): Scenario | null {
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  const f2lAlgs: string[] = [];
  for (let oriIdx = 0; oriIdx < 4; oriIdx++) {
    const c = pickRandom(f2lCases, rand);
    const a = pickRandomAlg(c, oriIdx, rand);
    if (!a) return null;
    f2lAlgs.push(a);
  }
  const ollCase = pickRandom(ollCases, rand);
  const ollAlg = pickRandomAlg(ollCase, 0, rand);
  const pllCase = pickRandom(pllCases, rand);
  const pllAlg = pickRandomAlg(pllCase, 0, rand);
  if (!ollAlg || !pllAlg) return null;

  const solution = [...f2lAlgs, ollAlg, pllAlg].join(' ');
  const scramble = invertAlg(solution);
  if (!scramble) return null;

  return {
    scramble,
    lines: [
      { alg: f2lAlgs[0], comment: '// F2L 1 (FR)' },
      { alg: f2lAlgs[1], comment: '// F2L 2 (FL)' },
      { alg: f2lAlgs[2], comment: '// F2L 3 (BL)' },
      { alg: f2lAlgs[3], comment: '// F2L 4 (BR)' },
      { alg: ollAlg, comment: `// OLL (${ollCase.name})` },
      { alg: pllAlg, comment: `// PLL (${pllCase.name})` },
    ],
  };
}

type StageLabel = 'f2l-1' | 'f2l-2' | 'f2l-3' | 'f2l-4' | 'oll' | 'pll' | 'solved';

interface Failure {
  trial: number;
  stage: StageLabel;
  scramble: string;
  value: string;
  reason: string;
  topSuggestion?: string;
}

async function runOne(trial: number, sc: Scenario): Promise<Failure[]> {
  const failures: Failure[] = [];
  const stageLabels: StageLabel[] = ['f2l-1', 'f2l-2', 'f2l-3', 'f2l-4', 'oll', 'pll', 'solved'];

  // For each transition: build value containing lines [0..lineIdx) typed,
  // place caret at end of last \n. Test Tab at this caret.
  for (let lineIdx = 0; lineIdx <= 6; lineIdx++) {
    const previousLines = sc.lines.slice(0, lineIdx).map(l => `${l.alg} ${l.comment}`);
    const value = previousLines.length ? previousLines.join('\n') + '\n' : '';
    const caret = value.length;
    const stage = stageLabels[lineIdx];

    const preStateAlg = [sc.scramble, ...sc.lines.slice(0, lineIdx).map(l => l.alg)].filter(Boolean).join(' ');
    const preState = await patternFromAlg(preStateAlg);

    const suggestions = await suggestAlg(sc.scramble, value, caret);

    if (stage === 'solved') {
      // Cube should already be solved; expect no suggestions.
      if (suggestions !== null && suggestions.length > 0) {
        failures.push({ trial, stage, scramble: sc.scramble, value, reason: 'expected no suggestions but got some',
          topSuggestion: suggestions[0].text });
      }
      continue;
    }

    if (!suggestions || suggestions.length === 0) {
      failures.push({ trial, stage, scramble: sc.scramble, value, reason: 'no suggestion returned' });
      continue;
    }

    // Verify top suggestion advances to the expected next stage.
    const top = suggestions[0];
    const post = preState.applyAlg(top.text);
    const postInfo = await detectStage(post);

    let goalReached = false;
    if (stage === 'f2l-1' || stage === 'f2l-2' || stage === 'f2l-3' || stage === 'f2l-4') {
      const expectedSlots = lineIdx + 1; // after applying, we should have lineIdx+1 slots solved
      if (postInfo.solvedSlots.length >= expectedSlots) goalReached = true;
    } else if (stage === 'oll') {
      goalReached = postInfo.stage === 'oll' || postInfo.stage === 'solved';
    } else if (stage === 'pll') {
      goalReached = postInfo.stage === 'solved';
    }

    if (!goalReached) {
      failures.push({
        trial, stage, scramble: sc.scramble, value,
        reason: `top suggestion didn't advance: post-stage=${postInfo.stage} solvedSlots=[${postInfo.solvedSlots.join(',')}]`,
        topSuggestion: top.text,
      });
    }
  }
  return failures;
}

const TARGET_N = 100;
const MAX_ATTEMPTS = 50000;
let total = 0;
const allFailures: Failure[] = [];
const failByStage: Record<StageLabel, number> = { 'f2l-1': 0, 'f2l-2': 0, 'f2l-3': 0, 'f2l-4': 0, 'oll': 0, 'pll': 0, 'solved': 0 };

for (let attempt = 0; attempt < MAX_ATTEMPTS && total < TARGET_N; attempt++) {
  const sc = makeScenario(attempt * 7919 + 31);
  if (!sc) continue;
  total++;
  const failures = await runOne(total - 1, sc);
  for (const f of failures) {
    failByStage[f.stage]++;
    allFailures.push(f);
  }
}

console.log(`Trials: ${total}`);
console.log('Failures by stage:');
for (const k of Object.keys(failByStage)) {
  const c = failByStage[k as StageLabel];
  if (c > 0) console.log(`  ${k}: ${c}`);
}
console.log(`Total failures: ${allFailures.length}`);

// Show first ~5 failures in detail
console.log('\n=== First failures (up to 5) ===');
for (const f of allFailures.slice(0, 5)) {
  console.log(`\n[trial ${f.trial}] stage=${f.stage} reason=${f.reason}`);
  console.log(`  scramble: ${simplifyAlg(f.scramble)}`);
  console.log(`  value:`);
  for (const line of f.value.split('\n')) console.log(`    > ${line}`);
  if (f.topSuggestion) console.log(`  topSuggestion: ${f.topSuggestion}`);
}

if (allFailures.length > 0) {
  process.exit(1);
}
console.log('\nALL PASS');
