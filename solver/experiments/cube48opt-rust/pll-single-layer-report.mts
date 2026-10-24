/** Reuse saved OPT9 solutions and the saved preference model. No native solve or
 * training. Try at most two wide-to-outer substitutions, retain equal-MCC exact
 * solutions only, then enforce the user's same-MCC single-layer preference.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { algSpeed } from '../../../core/packages/client/lib/mcc.ts';
import { scoreOriented, joinMoves, moveTokens } from './lll-oriented-notation.mts';
import { isAllowedZbllAlgorithm, wideTurnCount } from './zbll-mcc-notation.mts';
import { moveFeatures, preferenceScore, rankPreference } from './lll-preference-ranking.mts';

const root = resolve(import.meta.dirname, '../../..');
const input = resolve(root, '.tmp/pll-21-20261023/starting-orientation-v2/report.json');
const previousPath = resolve(root, '.tmp/pll-preference-20261024-v2/report.json');
const modelPath = resolve(root, '.tmp/pll-preference-20261024-v2/model-grams3.json');
const out = resolve(process.argv[2] ?? resolve(root, '.tmp/pll-single-layer-20261024-v1'));
assert(!existsSync(out), 'Preserve previous evidence; choose a new output directory');
const sourceBytes = readFileSync(input), modelBytes = readFileSync(modelPath), previousBytes = readFileSync(previousPath);
const source = JSON.parse(sourceBytes.toString()), previous = JSON.parse(previousBytes.toString());
const { model } = JSON.parse(modelBytes.toString());
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const codeFiles = ['pll-single-layer-report.mts', 'lll-preference-ranking.mts', 'lll-oriented-notation.mts', 'zbll-mcc-notation.mts'];
const provenance = { inputs: { originalCandidates: digest(sourceBytes), frozenModel: digest(modelBytes), previousReport: digest(previousBytes) },
  code: Object.fromEntries(codeFiles.map(f => [f, digest(readFileSync(resolve(import.meta.dirname, f)))])),
  method: 'Generic one/two wide-to-outer substitutions of saved generated bodies, equal original MCC, exact fixed-setup solution check. Website references are used only for final coverage comparison.' };
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' });
for (const f of codeFiles) writeFileSync(resolve(out, f), readFileSync(resolve(import.meta.dirname, f)), { flag: 'wx' });
const { puzzles } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const identity = (await puzzles['3x3x3'].kpuzzle()).defaultPattern();
const solved = (setup: string, algorithm: string) => identity.applyAlg(joinMoves(setup, algorithm))
  .experimentalIsSolved({ ignorePuzzleOrientation: false, ignoreCenterOrientation: true });
const results: any[] = [];
let proposed = 0, equalMcc = 0, verifiedRewrites = 0, newBodies = 0;
const started = performance.now();
for (const c of source.results) {
  const bucket = new Map<string, any>();
  const key = (a: any) => a.orientation + '|' + a.body;
  for (const a of c.candidates) {
    assert(isAllowedZbllAlgorithm(a.body) && solved(c.setup, a.algorithm));
    if (!bucket.has(key(a))) bucket.set(key(a), { ...a, origin: 'native-opt9', score: preferenceScore(model, moveFeatures(a.body)) });
  }
  const before = rankPreference([...bucket.values()]);
  for (const a of c.candidates) {
    const ts = moveTokens(a.body), indexes = ts.flatMap((t, i) => /^[rufdlb](?:2|')?$/.test(t) ? [i] : []);
    const substitutions = indexes.flatMap((i, n) => [[i], ...indexes.slice(n + 1).map(j => [i, j])]);
    for (const changed of substitutions) {
      proposed++;
      const tokens = [...ts]; for (const i of changed) tokens[i] = tokens[i][0].toUpperCase() + tokens[i].slice(1);
      const body = tokens.join(' ');
      if (bucket.has(a.orientation + '|' + body) || !isAllowedZbllAlgorithm(body)) continue;
      if (algSpeed(body, false, false) !== a.mcc) continue;
      equalMcc++;
      const algorithm = joinMoves(a.preAuf, a.orientation, body, a.restoreOrientation, a.postAuf);
      if (!solved(c.setup, algorithm)) continue;
      const scored = scoreOriented({ preAuf: a.preAuf, orientation: a.orientation, body,
        restoreOrientation: a.restoreOrientation, postAuf: a.postAuf });
      assert.equal(scored.algorithm, algorithm); assert.equal(scored.mcc, a.mcc);
      assert(wideTurnCount(body) < wideTurnCount(a.body));
      verifiedRewrites++; newBodies++;
      bucket.set(key(scored), { ...scored, queryId: a.queryId, origin: 'verified-single-layer-rewrite',
        parentAlgorithm: a.algorithm, changedBodyMoves: changed.map(i => i + 1),
        score: preferenceScore(model, moveFeatures(body)) });
    }
  }
  const ranked = rankPreference([...bucket.values()]).map((a, i) => ({ ...a, rank: i + 1 }));
  const widths = new Map<number, number>();
  for (const a of ranked) {
    assert(isAllowedZbllAlgorithm(a.body) && solved(c.setup, a.algorithm));
    const wide = wideTurnCount(a.body);
    assert(wide >= (widths.get(a.mcc) ?? 0), 'Same-MCC wide counts must be nondecreasing');
    widths.set(a.mcc, wide);
  }
  // Comparison happens after generation and sorting, never drives substitutions.
  const target = previous.details.find((d: any) => d.dbId === c.dbId).target;
  const match = (a: any) => a.body === target.body && a.orientation === target.orientation;
  const result = { name: c.name, dbId: c.dbId, sourceSetup: c.sourceSetup, setup: c.setup,
    setupOrientationCorrection: c.setupOrientationCorrection, sourceRows: c.candidates.length,
    previousTop: before[0].algorithm, targetRank: ranked.find(a => match(a))?.rank ?? null,
    targetBody: target.body, target: target.raw, candidates: ranked.slice(0, 200) };
  appendFileSync(resolve(out, 'cases.jsonl'), JSON.stringify(result) + '\n'); results.push(result);
}
const summary = { cases: results.length, proposed, equalMcc, verifiedRewrites, newBodies,
  candidates: results.reduce((s, c) => s + c.candidates.length, 0),
  generatedReferenceBodies: results.filter(c => c.targetRank !== null).length,
  generatedTop1Matches: results.filter(c => c.targetRank === 1).length,
  nativeRerun: false, retrained: false, allSolutionsVerified: true, sameMccRuleVerified: true,
  processingSeconds: (performance.now() - started) / 1000 };
writeFileSync(resolve(out, 'report.json'), JSON.stringify({ summary, provenance, results }, null, 2) + '\n', { flag: 'wx' });
writeFileSync(resolve(out, 'top-3.txt'), ['PLL · 同 MCC 优先单层',
  '使用已有 OPT9 结果及已保存模型。等价改写均验解；未把网站参考直接加入候选。',
  'MCC 相同，双层转动少的排前；M/E/S 不属于双层转动。', '',
  ...results.flatMap(c => [`${c.name} · 固定打乱：${c.sourceSetup}`,
    ...(c.setupOrientationCorrection ? [`打乱后统一朝向：${c.setupOrientationCorrection}`] : []),
    ...c.candidates.slice(0, 3).map((a: any, i: number) => `${i + 1} → ${a.algorithm}  （MCC ${a.mcc.toFixed(1)}，双层 ${wideTurnCount(a.body)} 次）`), '']),
].join('\n') + '\n', { flag: 'wx' });
console.log(JSON.stringify({ summary, E: results.find(c => c.name === 'E')?.candidates[0] }));
