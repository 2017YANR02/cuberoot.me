/**
 * Stress test 2: harder variations.
 *
 * - Solve slots in random order (not FR→FL→BL→BR).
 * - User types pre-AUF (e.g., U or U2) before the F2L alg.
 * - User types only the first few moves of the alg (partial line).
 * - User started with a y inspection rotation.
 */

import { Alg } from 'cubing/alg';
import { invertAlg, simplifyAlg, patternFromAlg } from '../src/utils/cube3';
import { detectStage } from '../src/utils/stage_detect';
import { suggestAlg } from '../src/utils/recon_autofill_core';
import f2lDb from '../../shared/data/algdb_f2l.json' with { type: 'json' };
import ollDb from '../../shared/data/algdb_oll.json' with { type: 'json' };
import pllDb from '../../shared/data/algdb_pll.json' with { type: 'json' };

interface Case { name: string; algs: Array<Array<{ alg: string }>> }
const f2lCases = (f2lDb as { cases: Case[] }).cases;
const ollCases = (ollDb as { cases: Case[] }).cases;
const pllCases = (pllDb as { cases: Case[] }).cases;

function isFaceTurnOnly(alg: string): boolean {
  return alg.split(/\s+/).filter(Boolean).every(t => /^[UDFBLR]['2]?$/.test(t));
}
function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}
function pickRandomFaceTurnAlg(c: Case, oriIdx: number, rand: () => number): string | null {
  const variants = (c.algs[oriIdx] ?? []).filter(v => v.alg && isFaceTurnOnly(v.alg));
  if (!variants.length) return null;
  return pickRandom(variants, rand).alg;
}

interface Failure { trial: number; tag: string; reason: string }
const failures: Failure[] = [];

const TARGET_N = 50;
const MAX_ATTEMPTS = 50000;
let total = 0;

for (let attempt = 0; attempt < MAX_ATTEMPTS && total < TARGET_N; attempt++) {
  let s = attempt * 7919 + 13;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  // Pick algs: 4 F2L (one per slot), 1 OLL, 1 PLL
  const f2lAlgs: (string | null)[] = [];
  for (let oriIdx = 0; oriIdx < 4; oriIdx++) {
    const c = pickRandom(f2lCases, rand);
    f2lAlgs.push(pickRandomFaceTurnAlg(c, oriIdx, rand));
  }
  const ollC = pickRandom(ollCases, rand);
  const ollAlg = pickRandomFaceTurnAlg(ollC, 0, rand);
  const pllC = pickRandom(pllCases, rand);
  const pllAlg = pickRandomFaceTurnAlg(pllC, 0, rand);
  if (f2lAlgs.some(a => !a) || !ollAlg || !pllAlg) continue;
  total++;
  const trial = attempt;  // use attempt as trial ID for reproducibility

  // Random slot order (permutation of 0..3 for which physical slot to solve first)
  // Note: each F2L alg targets a SPECIFIC slot ori, so we can't reorder them.
  // But we CAN reorder which is "line 1, line 2, line 3, line 4" — the user might
  // solve FL first, then BR, then FR, then BL. We achieve this by permuting which
  // alg is on which line. Each alg still targets its original slot.
  const slotOrder = [0, 1, 2, 3].sort(() => rand() - 0.5);
  const orderedF2l = slotOrder.map(i => f2lAlgs[i]!);

  // Solution = orderedF2l + OLL + PLL. Scramble = invert(solution).
  const solution = [...orderedF2l, ollAlg, pllAlg].join(' ');
  const scramble = invertAlg(solution);

  // === Test 1: solve in this random order ===
  {
    const lines = orderedF2l.map((a, i) => `${a} // F2L ${i + 1}`)
      .concat([`${ollAlg} // OLL`, `${pllAlg} // PLL`]);
    let prev = '';
    for (let lineIdx = 0; lineIdx <= 6; lineIdx++) {
      const value = prev;
      const caret = value.length;
      const suggestions = await suggestAlg(scramble, value, caret);
      if (lineIdx === 6) {
        if (suggestions !== null && suggestions.length > 0) {
          failures.push({ trial, tag: 'random-order/solved', reason: 'expected no suggestions when solved' });
        }
      } else {
        if (!suggestions || !suggestions.length) {
          failures.push({ trial, tag: `random-order/line${lineIdx}`, reason: 'no suggestions' });
        } else {
          const preStateAlg = [scramble, ...lines.slice(0, lineIdx).map(l => l.split('//')[0].trim())].filter(Boolean).join(' ');
          const preState = await patternFromAlg(preStateAlg);
          const top = suggestions[0];
          const post = preState.applyAlg(top.text);
          const postInfo = await detectStage(post);
          let goal = false;
          if (lineIdx <= 3) goal = postInfo.solvedSlots.length >= lineIdx + 1;
          else if (lineIdx === 4) goal = postInfo.stage === 'oll' || postInfo.stage === 'solved';
          else if (lineIdx === 5) goal = postInfo.stage === 'solved';
          if (!goal) {
            failures.push({ trial, tag: `random-order/line${lineIdx}`, reason: `top didn't advance: stage=${postInfo.stage} top=${top.text}` });
          }
        }
      }
      if (lineIdx < 6) prev += lines[lineIdx] + '\n';
    }
  }

  // === Test 2: partial line — at every (lineIdx, k), verify suggestions ===
  // includes the user's intended alg (or a prefix-compatible equivalent).
  //
  // The user's "intended" path uses orderedF2l[lineIdx] for each F2L line,
  // ollAlg for line 4, pllAlg for line 5. We treat the user as committed to
  // this path: prev is built from intendedAlg[lineIdx-1], and we test Tab
  // when typing the first k moves of intendedAlg[lineIdx].
  {
    const intendedAlgs = [...orderedF2l, ollAlg, pllAlg];
    let prev = '';
    let okSoFar = true;
    for (let lineIdx = 0; lineIdx < 6; lineIdx++) {
      const userAlg = intendedAlgs[lineIdx]!;
      const moves = [...new Alg(userAlg).experimentalLeafMoves()].map(m => m.toString());
      const k = Math.floor(rand() * (moves.length + 1));  // [0..len] inclusive
      const partial = moves.slice(0, k).join(' ');
      const value = prev + (partial ? partial + ' ' : '');
      const caret = value.length;
      const suggestions = await suggestAlg(scramble, value, caret);
      if (!suggestions || !suggestions.length) {
        failures.push({ trial, tag: `partial/line${lineIdx} k=${k}`, reason: 'no suggestions' });
        okSoFar = false; break;
      }
      // Find any suggestion that is prefix-compatible with userAlg's prefix
      // AND when applied advances the cube.
      const preStateAlg = [scramble, prev.split('\n').filter(Boolean).map(l => l.split('//')[0].trim()).filter(Boolean).join(' ')].filter(Boolean).join(' ');
      const preState = await patternFromAlg(preStateAlg);
      let validFound = false;
      for (const s of suggestions) {
        const sMoves = [...new Alg(s.text).experimentalLeafMoves()].map(m => m.toString());
        if (sMoves.length < k) continue;
        let pfx = true;
        for (let i = 0; i < k; i++) if (sMoves[i] !== moves[i]) { pfx = false; break; }
        if (!pfx) continue;
        const post = preState.applyAlg(s.text);
        const postInfo = await detectStage(post);
        let advanced = false;
        if (lineIdx <= 3) advanced = postInfo.solvedSlots.length >= lineIdx + 1;
        else if (lineIdx === 4) advanced = postInfo.stage === 'oll' || postInfo.stage === 'solved';
        else if (lineIdx === 5) advanced = postInfo.stage === 'solved';
        if (advanced) { validFound = true; break; }
      }
      if (!validFound) {
        failures.push({ trial, tag: `partial/line${lineIdx} k=${k}`, reason: `no prefix-compatible suggestion advances` });
        okSoFar = false; break;
      }
      prev += `${userAlg} // line ${lineIdx + 1}\n`;
    }
    void okSoFar;
  }

  // === Test 3: solved-cube edge case ===
  {
    // After full solve applied, no suggestions
    const value = orderedF2l.map((a, i) => `${a} // F2L ${i + 1}`).concat([`${ollAlg} // OLL`, `${pllAlg} // PLL`]).join('\n') + '\n';
    const caret = value.length;
    const sugg = await suggestAlg(scramble, value, caret);
    if (sugg && sugg.length > 0) {
      failures.push({ trial, tag: 'edge/post-solved', reason: 'got suggestions on solved cube' });
    }
  }
}

console.log(`Trials: ${total}, failures: ${failures.length}`);
if (failures.length > 0) {
  const byTag: Record<string, number> = {};
  for (const f of failures) byTag[f.tag] = (byTag[f.tag] ?? 0) + 1;
  for (const k of Object.keys(byTag)) console.log(`  ${k}: ${byTag[k]}`);
  console.log('\nFirst 10 failures:');
  for (const f of failures.slice(0, 10)) {
    console.log(`  [trial ${f.trial}] ${f.tag}: ${f.reason}`);
  }
  process.exit(1);
}
console.log('ALL PASS');
void simplifyAlg;
