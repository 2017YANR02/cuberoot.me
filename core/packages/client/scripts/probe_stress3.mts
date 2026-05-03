/**
 * Stress test 3: include slice/wide/rotation algs from the DB. These shift
 * centers, so synthesis must account for orientation drift between lines.
 *
 * Strategy: pick any alg from DB (no face-turn filter). At each line transition,
 * verify autofill returns a prefix-compatible suggestion that advances stage.
 * The user's "intended" alg may be one with rotations — autofill needs to
 * handle the resulting non-canonical center frames.
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

function pickRandom<T>(arr: T[], r: () => number): T { return arr[Math.floor(r() * arr.length)]; }
function pickAny(c: Case, oriIdx: number, r: () => number): string | null {
  const v = (c.algs[oriIdx] ?? []).filter(x => x.alg);
  return v.length ? pickRandom(v, r).alg : null;
}

interface Failure { trial: number; tag: string; reason: string }
const failures: Failure[] = [];

const TARGET_N = 50;
const MAX_ATTEMPTS = 5000;
let total = 0;

for (let attempt = 0; attempt < MAX_ATTEMPTS && total < TARGET_N; attempt++) {
  let s = attempt * 7919 + 53;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  const f2lAlgs: (string | null)[] = [];
  for (let oriIdx = 0; oriIdx < 4; oriIdx++) {
    const c = pickRandom(f2lCases, rand);
    f2lAlgs.push(pickAny(c, oriIdx, rand));
  }
  const ollC = pickRandom(ollCases, rand);
  const ollAlg = pickAny(ollC, 0, rand);
  const pllC = pickRandom(pllCases, rand);
  const pllAlg = pickAny(pllC, 0, rand);
  if (f2lAlgs.some(a => !a) || !ollAlg || !pllAlg) continue;

  const slotOrder = [0, 1, 2, 3].sort(() => rand() - 0.5);
  const orderedF2l = slotOrder.map(i => f2lAlgs[i]!);
  const intendedAlgs = [...orderedF2l, ollAlg, pllAlg];

  const solution = intendedAlgs.join(' ');
  const scramble = invertAlg(solution);

  total++;
  const trial = attempt;

  let prev = '';
  let okSoFar = true;
  for (let lineIdx = 0; lineIdx < 6; lineIdx++) {
    const userAlg = intendedAlgs[lineIdx];
    const moves = [...new Alg(userAlg).experimentalLeafMoves()].map(m => m.toString());

    // For each line: test at k=0 (blank line) and k=floor(len/2) (mid-typing) and k=len-1 (almost done).
    const ks = [0, Math.floor(moves.length / 2), Math.max(0, moves.length - 1)];

    for (const k of ks) {
      const partial = moves.slice(0, k).join(' ');
      const value = prev + (partial ? partial + ' ' : '');
      const caret = value.length;
      const suggestions = await suggestAlg(scramble, value, caret);

      const preStateAlg = [scramble, prev.split('\n').filter(Boolean).map(l => l.split('//')[0].trim()).filter(Boolean).join(' ')].filter(Boolean).join(' ');
      const preState = await patternFromAlg(preStateAlg);

      if (!suggestions || !suggestions.length) {
        failures.push({ trial, tag: `line${lineIdx} k=${k}`, reason: 'no suggestions' });
        okSoFar = false; break;
      }
      let validFound = false;
      for (const sg of suggestions) {
        const sm = [...new Alg(sg.text).experimentalLeafMoves()].map(m => m.toString());
        if (sm.length < k) continue;
        let pfx = true;
        for (let i = 0; i < k; i++) if (sm[i] !== moves[i]) { pfx = false; break; }
        if (!pfx) continue;
        const post = preState.applyAlg(sg.text);
        const postInfo = await detectStage(post);
        let advanced = false;
        if (lineIdx <= 3) advanced = postInfo.solvedSlots.length >= lineIdx + 1;
        else if (lineIdx === 4) advanced = postInfo.stage === 'oll' || postInfo.stage === 'solved';
        else if (lineIdx === 5) advanced = postInfo.stage === 'solved';
        if (advanced) { validFound = true; break; }
      }
      if (!validFound) {
        failures.push({ trial, tag: `line${lineIdx} k=${k}`, reason: `no prefix-compat suggestion advances` });
        okSoFar = false; break;
      }
    }
    if (!okSoFar) break;

    prev += `${userAlg} // line ${lineIdx + 1}\n`;
  }
}

console.log(`Trials: ${total}, failures: ${failures.length}`);
if (failures.length > 0) {
  const byTag: Record<string, number> = {};
  for (const f of failures) byTag[f.tag] = (byTag[f.tag] ?? 0) + 1;
  for (const k of Object.keys(byTag).sort()) console.log(`  ${k}: ${byTag[k]}`);
  console.log('\nFirst 5 failures (with seeds):');
  for (const f of failures.slice(0, 5)) {
    console.log(`  [trial ${f.trial}] ${f.tag}: ${f.reason}`);
  }
  process.exit(1);
}
console.log('ALL PASS');
void simplifyAlg;
