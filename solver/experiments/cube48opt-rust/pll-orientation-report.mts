/** Reprocess immutable native results with a separate starting frame.
 * Uses website display names, source setups and main-formula starting frames.
 * References remain outside candidate generation. No solver or table loading.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalize3x3WideMoves, toMoveString } from '../../../core/packages/shared/src/alg_notation.ts';
import { isAllowedZbllAlgorithm, ZBLL_ALLOWED_FAMILIES } from './zbll-mcc-notation.mts';
import { orientedSpellings, outerKey, joinMoves, inverseTokens, moveTokens, scoreOriented,
  splitLiteralOrientation, compareOriented, fixedCaseSetup } from './lll-oriented-notation.mts';
import { startLabel } from './lll-grip-scoring.mts';

const root = resolve(import.meta.dirname, '../../..'), inputDir = resolve(root, '.tmp/pll-21-20261023');
const out = resolve(inputDir, 'starting-orientation-v2');
const read = (name: string) => readFileSync(resolve(inputDir, name));
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const source = JSON.parse(read('source.json').toString()), q = JSON.parse(read('queries.json').toString());
const rows = read('raw.jsonl').toString().trim().split('\n').map(s => JSON.parse(s));
const queryMap = new Map(q.queries.map((r: any) => [r.id, r]));
assert.equal(new Set(rows.map((r: any) => r.id)).size, rows.length);
assert.equal(source.cases.length, 21);
const { Alg } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/alg/index.js'));
const { puzzles } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const identity = (await puzzles['3x3x3'].kpuzzle()).defaultPattern();
const clean = (s: string) => canonicalize3x3WideMoves(toMoveString(s)).replace(/2'/g, '2');
const simplify = (s: string) => new Alg(s).experimentalSimplify({ cancel: true }).toString().replace(/2'/g, '2');
const solved = (setup: string, algorithm: string) => identity.applyAlg(joinMoves(setup, algorithm)).experimentalIsSolved({ ignorePuzzleOrientation: false, ignoreCenterOrientation: true });
const family = (algorithm: string) => ['', 'D', 'D2', "D'"].map(d => outerKey(joinMoves(d, outerKey(algorithm), inverseTokens(d)))).sort()[0];
const sourceFiles = ['lll-oriented-notation.mts', 'zbll-mcc-notation.mts', 'lll-grip-scoring.mts', 'pll-orientation-report.mts'];
const provenance = { inputHashes: Object.fromEntries(['source.json', 'queries.json', 'raw.jsonl', 'completed.json'].map(f => [f, digest(read(f))])),
  codeHashes: Object.fromEntries(sourceFiles.map(f => [f, digest(readFileSync(resolve(import.meta.dirname, f)))])) };
mkdirSync(out, { recursive: true });
const provenancePath = resolve(out, 'provenance.json');
if (existsSync(provenancePath)) assert.deepEqual(JSON.parse(readFileSync(provenancePath, 'utf8')), provenance, 'Checkpoint inputs/code changed');
else writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' });
const checkpoint = resolve(out, 'cases.jsonl');
const saved = existsSync(checkpoint) ? readFileSync(checkpoint, 'utf8').trim().split('\n').filter(Boolean).map(s => JSON.parse(s)) : [];
const results: any[] = [], started = performance.now();
for (const websiteCase of source.cases) {
  const c = q.cases.find((c: any) => c.dbId === websiteCase.id); assert(c);
  const old = saved.find((r: any) => r.dbId === c.dbId);
  if (old) { results.push(old); continue; }
  const mainFormula = clean(websiteCase.algs.flat()[0].alg);
  const leading = moveTokens(mainFormula);
  if (leading[0]?.[0] === 'U') leading.shift();
  const startMoves: string[] = [];
  while (leading.length && /^[xyz]/.test(leading[0])) startMoves.push(leading.shift()!);
  const orientation = startMoves.join(' ');
  const fixedSetup = fixedCaseSetup(clean(websiteCase.setup));
  const sourceSetup = fixedSetup.algorithm;
  // Canonical solver setup and literal source setup must define the same case frame.
  assert.deepEqual(identity.applyAlg(sourceSetup).patternData, identity.applyAlg(c.setup).patternData);
  const bucket = new Map<string, any>(), pathCache = new Map<string, ReturnType<typeof orientedSpellings>>();
  let solvedInputs = 0, incompleteInputs = 0, verifiedSpellings = 0;
  for (const row of rows.filter((r: any) => r.id.startsWith(c.id + 'q'))) {
    const query: any = queryMap.get(row.id); assert(query?.caseId === c.id);
    if (row.cancelled || typeof row.solution !== 'string') { incompleteInputs++; continue; }
    assert(solved(query.scramble, row.solution)); solvedInputs++;
    const path = outerKey(joinMoves(query.prefix, row.solution));
    let variants = pathCache.get(path);
    if (!variants) { variants = orientedSpellings(path, [orientation]); pathCache.set(path, variants); }
    for (const a of variants) {
      assert(solved(sourceSetup, a.algorithm)); assert(isAllowedZbllAlgorithm(a.body)); verifiedSpellings++;
      const item = { ...a, family: family(a.algorithm), queryId: row.id };
      const previous = bucket.get(item.family);
      if (!previous || compareOriented(item, previous) < 0) bucket.set(item.family, item);
    }
  }
  const candidates = [...bucket.values()].sort(compareOriented).slice(0, 200).map((a, i) => ({ ...a, rank: i + 1 }));
  // Website order chooses the control; no score-based selection or body rewrite.
  const entries = [...websiteCase.algs.flat().filter((a: any) => !a.tags?.length), { alg: websiteCase.standard }];
  let reference: any = null;
  const skipped: any[] = [];
  const aufs = ['', 'U', 'U2', "U'"];
  const boundaries = aufs.flatMap(pre => aufs.map(post => ({ pre, post })))
    .sort((a, b) => Number(!!a.pre) + Number(!!a.post) - Number(!!b.pre) - Number(!!b.post));
  for (let index = 0; index < entries.length && !reference; index++) {
    const entry = entries[index]; if (!entry.alg) continue;
    const raw = clean(entry.alg), parsed = splitLiteralOrientation(raw);
    if (!parsed || parsed.orientation !== orientation) { skipped.push({ index, sourceAlgorithm: entry.alg, reason: 'Body whitelist or starting orientation differs' }); continue; }
    for (const { pre, post } of boundaries) {
      const algorithm = simplify(joinMoves(pre, raw, post));
      if (!solved(sourceSetup, algorithm)) continue;
      const parts = splitLiteralOrientation(algorithm); assert(parts && parts.orientation === orientation);
      const scored = scoreOriented(parts);
      const refFamily = family(scored.algorithm);
      reference = { ...scored, sourceIndex: index, sourceAlgorithm: entry.alg,
        candidateRank: 1 + candidates.filter(a => a.mcc < scored.mcc).length,
        trialRank: 1 + candidates.filter(a => a.trialScore < scored.trialScore).length,
        generatedFamily: candidates.some(a => a.family === refFamily),
        generatedExactSpelling: candidates.some(a => a.algorithm === scored.algorithm) };
      break;
    }
  }
  assert(candidates.length > 0, `No candidates for ${websiteCase.name}`);
  const result = { id: c.id, dbId: c.dbId, name: websiteCase.name, sourceSetup: websiteCase.setup, setup: sourceSetup,
    setupOrientationCorrection: fixedSetup.orientationCorrection,
    orientation, mainFormula: websiteCase.algs.flat()[0].alg, solvedInputs, incompleteInputs, verifiedSpellings,
    uniqueFamilies: bucket.size, candidates, reference, skippedReferences: skipped };
  appendFileSync(checkpoint, JSON.stringify(result) + '\n'); results.push(result);
  console.log(JSON.stringify({ name: result.name, orientation, count: candidates.length, top: candidates[0].algorithm,
    mcc: candidates[0].mcc, reference: reference?.algorithm, referenceRank: reference?.candidateRank, referenceGenerated: reference?.generatedFamily }));
}
// Revalidate every exported candidate/reference, including resumed checkpoints.
for (const c of results) for (const a of [...c.candidates, ...(c.reference ? [c.reference] : [])]) {
  assert.equal(a.orientation, c.orientation); assert(isAllowedZbllAlgorithm(a.body)); assert(solved(c.setup, a.algorithm));
  assert.deepEqual(scoreOriented(a).grip, a.grip);
}
assert.deepEqual(results.map(c => c.name), source.cases.map((c: any) => c.name));
const summary = { cases: results.length, candidates: results.reduce((n, c) => n + c.candidates.length, 0),
  nativeRerun: false, solvedInputs: results.reduce((n, c) => n + c.solvedInputs, 0),
  incompleteInputs: results.reduce((n, c) => n + c.incompleteInputs, 0),
  references: results.filter(c => c.reference).length,
  generatedReferenceFamilies: results.filter(c => c.reference?.generatedFamily).length,
  referenceTop3: results.filter(c => c.reference?.candidateRank <= 3).length,
  processingSecondsThisInvocation: (performance.now() - started) / 1000 };
const save = (f: string, v: unknown) => writeFileSync(resolve(out, f), JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
save('report.json', { summary, provenance, allowedBody: ZBLL_ALLOWED_FAMILIES,
  ranking: 'Original MCC on body, including all body U turns; starting orientation, restoration and original-frame boundary AUF excluded. Experimental grip score retained only for comparison.',
  orientationPolicy: 'Each case uses its website first displayed algorithm starting orientation. No mid-body rotations.', results });
const header = 'PLL 21 例 · 起手朝向独立记录\n名称、固定打乱与主公式起手朝向采用网站数据；打乱不随排序变化。\n主体仅允许 '+ZBLL_ALLOWED_FAMILIES.join(' ')+' 及逆转、半转；禁止主体内转体。\n按主体 MCC 排序。起手摆位、恢复朝向、原朝向首尾 AUF 不计分；主体里的 U 仍计分。起手成本不包含在这项分数中。\n每条完整执行顺序均保留，结束恢复原朝向。换手为主体手法的模型预测；参考公式单列，未注入候选。\n\n';
const detail = (a: any) => [
  `完整公式：${a.algorithm}`,
  `主体：${a.body}`,
  `顺序：AUF ${a.preAuf || '无'} → 起手 ${a.orientation || '原朝向'} → 主体 → 恢复 ${a.restoreOrientation || '无'} → AUF ${a.postAuf || '无'}`,
  `主体 MCC ${a.mcc.toFixed(1)}；${startLabel(a.grip)}；预测主体内重握 ${a.midRegrips.length} 次${a.midRegrips.length ? '（主体第 '+a.midRegrips.map((e: any) => e.beforeMove).join('、')+' 步前）' : ''}`,
].join('\n   ');
const format = (count: number) => header + results.map(c => `PLL ${c.name}\n固定打乱（网站原始 setup）：${c.sourceSetup}\n${c.setupOrientationCorrection ? '打乱后统一朝向：'+c.setupOrientationCorrection+'（补回网站打乱留下的整体朝向差）\n' : ''}统一起手朝向：${c.orientation || '原朝向'}；候选 ${c.candidates.length} 条。\n\n`+
  c.candidates.slice(0, count).map((a: any) => `${a.rank}. ${detail(a)}`).join('\n\n')+
  (c.reference ? `\n\n网站参考（独立对照）：${detail(c.reference)}\n   若插入候选并按 MCC 排序：第 ${c.reference.candidateRank}（同分并列）；${c.reference.generatedFamily ? '原始求解结果已生成该路径家族' : '本轮未生成该路径家族'}。` : '\n\n网站参考暂不满足相同主体限制，未纳入对照。')).join('\n\n')+'\n';
writeFileSync(resolve(out, 'top-3.txt'), format(3), { flag: 'wx' });
writeFileSync(resolve(out, 'all-candidates.txt'), format(200), { flag: 'wx' });
save('validation.json', { ...summary, allBodiesLegal: true, allIndependentSolutionsVerified: true, fixedSourceSetups: true,
  namesMatchSource: true, outputHashes: Object.fromEntries(['report.json', 'top-3.txt', 'all-candidates.txt'].map(f => [f, digest(readFileSync(resolve(out, f)))])) });
console.log(JSON.stringify(summary));
