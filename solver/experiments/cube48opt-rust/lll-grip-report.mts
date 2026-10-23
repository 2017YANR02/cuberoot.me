/** Small, table-free reranking of saved, independently verified candidates.
 * No solver launch, no library-algorithm injection, no rewriting old evidence.
 * Uses the existing MCC engine; not a port of BLDDB or a neural model.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { algSpeed } from '../../../core/packages/client/lib/mcc.ts';
import { isAllowedZbllAlgorithm, ZBLL_ALLOWED_FAMILIES } from './zbll-mcc-notation.mts';
import { GRIP_WEIGHTS as weights, scoreGripCandidate, startLabel } from './lll-grip-scoring.mts';

interface Candidate { rank: number; algorithm: string; mcc: number; stm: number }
interface Case { id: string; name: string; setup: string; candidates: Candidate[] }
const root = resolve(import.meta.dirname, '../../..');
const source = resolve(root, '.tmp/1lll-five-20261023/no-l-no-B/report.json');
const revision = process.argv[2] ?? 'regrip-v1';
assert(/^[a-zA-Z0-9-]+$/.test(revision));
const out = resolve(root, '.tmp/1lll-five-20261023', revision);
assert(!existsSync(out), 'Preserve previous reports; use a new revision name');
const bytes = readFileSync(source);
const input: { results: Case[] } = JSON.parse(bytes.toString('utf8'));

const { Alg } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/alg/index.js'));
const { puzzles } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const identity = (await puzzles['3x3x3'].kpuzzle()).defaultPattern();
const started = performance.now();
let verified = 0;
const results = input.results.map(c => {
  const candidates = c.candidates.map(a => {
    assert(isAllowedZbllAlgorithm(a.algorithm));
    assert.equal(algSpeed(a.algorithm, false, true), a.mcc, 'Original MCC must stay unchanged');
    assert(identity.applyAlg(`${c.setup} ${a.algorithm}`).experimentalIsSolved({
      ignorePuzzleOrientation: false, ignoreCenterOrientation: true,
    }), `${c.id}/${a.rank}: independent solution check failed`);
    const scored = scoreGripCandidate(a.algorithm, a.mcc);
    const tokens = a.algorithm.split(' ');
    for (const event of scored.grip.events) assert(event.beforeMove >= 1 && event.beforeMove <= tokens.length);
    verified++;
    return { ...a, oldRank: a.rank, ...scored };
  }).sort((a, b) => a.trialScore - b.trialScore || a.midRegrips.length - b.midRegrips.length
    || a.mcc - b.mcc || a.stm - b.stm || a.oldRank - b.oldRank)
    .map((a, i) => ({ ...a, rank: i + 1 }));
  const setup = new Alg(c.candidates[0].algorithm).invert().toString().replace(/2'/g, '2');
  assert(isAllowedZbllAlgorithm(setup));
  // The displayed setup is equivalent to the source case, in the same frame.
  for (const a of candidates) assert(identity.applyAlg(`${setup} ${a.algorithm}`).experimentalIsSolved({
    ignorePuzzleOrientation: false, ignoreCenterOrientation: true,
  }));
  return { id: c.id, name: c.name, setup, candidates };
});
const seconds = (performance.now() - started) / 1000;
const report = {
  createdAt: new Date().toISOString(), source, sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  method: 'Saved candidates only; original MCC plus experimental grip preferences', weights,
  allowed: ZBLL_ALLOWED_FAMILIES, verified, seconds,
  limitations: [
    'Grip analysis executes full AUF; the original MCC column excludes boundary AUF.',
    'MCC-selected greedy path, not minimum regrip count; finger state restarts at segment boundaries.',
    'Implicit finger changes inside moves are not exhaustively traced; zero resets is not proof of no physical regrip.',
    'Support alternations are a separate heuristic, not wrist resets; initial mode is free.',
    'Additional weights express a provisional preference and intentionally add to costs already in MCC.',
    'No neural model or BLDDB finger.ts integrated; only the saved 61-candidate pool is reranked.',
  ],
  results,
};
const header = [
  '1LLL 五例 · 换手偏好试排 v1',
  `仅允许 ${ZBLL_ALLOWED_FAMILIES.join(' ')} 及逆转、半转。`,
  '试排分 = 原 MCC + 3 × 预测中途重握次数 + 0.5 × 握持模式切换次数；越低越靠前。',
  '额外权重是待试拧校准的偏好；MCC 本身已有相关代价。预握不计入中途重握。',
  '原 MCC 忽略首尾 AUF；握姿分析执行完整公式，位置按完整公式从第 1 步数。',
  '“预测重握 0”仅指 MCC 所选路径没有显式重握，不保证真人无换手，也不是最少换手证明。',
  '握持模式切换单独统计 R/l 与 r/L 类交替，首个模式不计；不是实际松手次数。',
  '本轮重排已有 61 条候选，未重新求解、未使用神经评分。',
].join('\n');
const format = (count: number) => header + '\n\n' + results.map(c => {
  const oldFirst = c.candidates.find(a => a.oldRank === 1)!;
  const comparison = oldFirst.rank === 1 ? '原第一名保持第一。'
    : `原第一名现排第 ${oldFirst.rank}；预测中途重握 ${oldFirst.midRegrips.length} 次。`;
  return `${c.id} · ${c.name}\n打乱：${c.setup}\n${comparison}\n` + c.candidates.slice(0, count).map(a => {
    const tokens = a.algorithm.split(' ');
    const resets = a.midRegrips.map(e => {
      const hand = e.hand === 'left' ? '左手' : e.hand === 'right' ? '右手' : '双手';
      return `第 ${e.beforeMove} 步 ${tokens[e.beforeMove - 1]} 前（${hand}）`;
    }).join('；');
    return [
      `${a.rank}. ${a.algorithm}`,
      `   原 MCC ${a.mcc.toFixed(1)} ｜ 试排分 ${a.trialScore.toFixed(1)} ｜ 原第 ${a.oldRank} 名`,
      `   建议起手：${startLabel(a.grip)}${a.initialResets.length ? '；模型另有起手重握调整' : ''}；预测中途重握：${a.midRegrips.length} 次${resets ? '，' + resets : ''}`,
      `   握持模式切换：${a.supportSwitches.length} 次${a.supportSwitches.length ? '，第 ' + a.supportSwitches.join('、') + ' 步' : ''}`,
    ].join('\n');
  }).join('\n\n');
}).join('\n\n') + '\n';
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
writeFileSync(resolve(out, 'top-3.txt'), format(3), { flag: 'wx' });
writeFileSync(resolve(out, 'all-candidates.txt'), format(200), { flag: 'wx' });
writeFileSync(resolve(out, 'validation.json'), JSON.stringify({ verified, seconds,
  exactOrientation: true, allowedMoves: true, originalMccUnchanged: true,
  sourceSha256: report.sourceSha256,
  mccSourceSha256: createHash('sha256').update(readFileSync(resolve(root, 'core/packages/client/lib/mcc.ts'))).digest('hex'),
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ verified, seconds, out, cases: results.map(c => ({
  name: c.name, oldWinnerNewRank: c.candidates.find(a => a.oldRank === 1)!.rank,
  top: c.candidates.slice(0, 3).map(a => ({ algorithm: a.algorithm, oldRank: a.oldRank,
    mcc: a.mcc, trialScore: a.trialScore, regrips: a.midRegrips.length, start: startLabel(a.grip),
    switches: a.supportSwitches.length })),
})) }, null, 2));
