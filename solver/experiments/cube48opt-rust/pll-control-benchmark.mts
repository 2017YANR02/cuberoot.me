/** Fixed-order, literal library controls: selection never consults their score.
 * This is diagnostic, not a human speed or preference benchmark. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalize3x3WideMoves, toMoveString } from '../../../core/packages/shared/src/alg_notation.ts';
import { algSpeed } from '../../../core/packages/client/lib/mcc.ts';
import { isAllowedZbllAlgorithm } from './zbll-mcc-notation.mts';
import { scoreGripCandidate, startLabel } from './lll-grip-scoring.mts';

const root = resolve(import.meta.dirname, '../../..'), dir = resolve(root, '.tmp/pll-21-20261023');
const source = JSON.parse(readFileSync(resolve(dir, 'source.json'), 'utf8'));
const report = JSON.parse(readFileSync(resolve(dir, 'report.json'), 'utf8'));
const { Alg } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/alg/index.js'));
const { puzzles } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const loader = puzzles['3x3x3'], identity = (await loader.kpuzzle()).defaultPattern();
const solved = (setup: string, algorithm: string) => identity.applyAlg(`${setup} ${algorithm}`).experimentalIsSolved({ ignorePuzzleOrientation: false, ignoreCenterOrientation: true });
const auf = ['', 'U', 'U2', "U'"];
const boundaries = auf.flatMap(pre => auf.map(post => ({ pre, post })))
  .sort((a, b) => Number(!!a.pre) + Number(!!a.post) - Number(!!b.pre) - Number(!!b.post));
const controls = report.results.map((c: any) => {
  const src = source.cases.find((s: any) => s.id === c.dbId);
  const entries = [{ alg: src.standard, source: 'standard' }, ...src.algs.flat().filter((a: any) => !a.tags?.length)];
  const skipped: any[] = [];
  for (let index = 0; index < entries.length; index++) {
    const e = entries[index]; if (!e.alg) continue;
    const raw = canonicalize3x3WideMoves(toMoveString(e.alg)).replace(/2'/g, '2');
    if (!isAllowedZbllAlgorithm(raw)) { skipped.push({ index, reason: 'outside allowed move set', sourceAlgorithm: e.alg }); continue; }
    for (const { pre, post } of boundaries) {
      const combined = `${pre} ${raw} ${post}`.trim().replace(/\s+/g, ' ');
      if (!solved(c.setup, combined)) continue;
      const algorithm = canonicalize3x3WideMoves(new Alg(combined).experimentalSimplify({ cancel: true, puzzleLoader: loader }).toString()).replace(/2'/g, '2');
      assert(isAllowedZbllAlgorithm(algorithm)); assert(solved(c.setup, algorithm));
      const mcc = algSpeed(algorithm, false, true); assert(typeof mcc === 'number');
      const grip = scoreGripCandidate(algorithm, mcc);
      const mccRank = 1 + c.candidates.filter((a: any) => a.mcc < mcc).length;
      const trialRank = 1 + c.candidates.filter((a: any) => a.trialScore < grip.trialScore).length;
      return { name: c.name, candidates: c.candidates.length, sourceAlgorithm: e.alg, sourceIndex: index, pre, post,
        algorithm, mcc, ...grip, mccRank, trialRank, skipped, winner: c.candidates[0].algorithm,
        exactSpellingRecovered: c.candidates.some((a: any) => a.algorithm === algorithm) };
    }
    skipped.push({ index, reason: 'no boundary AUF matches the exact case frame', sourceAlgorithm: e.alg });
  }
  return { name: c.name, skipped, algorithm: null };
});
const valid = controls.filter((c: any) => c.algorithm);
const summary = { controlledCases: valid.length, missingControls: controls.filter((c: any) => !c.algorithm).map((c: any) => c.name),
  standardControls: valid.filter((c: any) => c.sourceIndex === 0).length,
  mccTop3: valid.filter((c: any) => c.mccRank <= 3).length,
  trialTop3: valid.filter((c: any) => c.trialRank <= 3).length,
  rankImproved: valid.filter((c: any) => c.trialRank < c.mccRank).length,
  rankWorsened: valid.filter((c: any) => c.trialRank > c.mccRank).length,
  exactSpellingRecovered: valid.filter((c: any) => c.exactSpellingRecovered).length };
writeFileSync(resolve(dir, 'controls.json'), JSON.stringify({ summary, selection: 'Website standard first, then untagged entries in source order; first legal solving spelling after AUF alignment. No score-based selection.', ranking: '1 + count of strictly better-scored generated candidates (ties share the best rank).', controls }, null, 2) + '\n', { flag: 'wx' });
const lines = controls.map((c: any) => c.algorithm ? [
  `PLL ${c.name}（生成 ${c.candidates} 条）`,
  `候选第一：${c.winner}`,
  `固定参考：${c.algorithm}`,
  `参考 MCC ${c.mcc.toFixed(1)}，插入后第 ${c.mccRank}；换手试排分 ${c.trialScore.toFixed(1)}，插入后第 ${c.trialRank}。`,
  `参考起手：${startLabel(c.grip)}；预测中途重握 ${c.midRegrips.length} 次。`,
  c.sourceIndex === 0 ? '参考采用网站标准公式，仅调整 AUF。' : '网站标准公式不适用；按库顺序选首条满足限制且验解通过的参考。',
].join('\n') : `PLL ${c.name}：暂无可直接使用的合法参考。`);
writeFileSync(resolve(dir, 'benchmark.txt'), [
  'PLL 21 例 · 固定参考对照',
  '参考按网站既有顺序选取，不按 MCC 挑选；参考只用于对照，未混入生成候选。',
  '所有展示公式均符合 R L U D F r u E M S 限制，并已按相同状态、相同朝向验解。',
  '名次为插入生成候选后的分数名次，同分并列；参考公式不是个人手感真值。',
  `完整生成结果：21 个情况，${report.summary.candidates} 条候选；${report.summary.solvedInputs}/2100 次补全成功。`,
  `固定参考：${summary.controlledCases} 个；原 MCC 前三 ${summary.mccTop3} 个，换手试排前三 ${summary.trialTop3} 个。`,
  `换手试排使参考排名改善 ${summary.rankImproved} 个、下降 ${summary.rankWorsened} 个。`,
  '', ...lines.map(s => s + '\n'),
].join('\n'), { flag: 'wx' });
console.log(JSON.stringify({ summary, cases: valid.map((c: any) => ({ name: c.name, sourceIndex: c.sourceIndex, mccRank: c.mccRank, trialRank: c.trialRank, algorithm: c.algorithm })) }, null, 2));
