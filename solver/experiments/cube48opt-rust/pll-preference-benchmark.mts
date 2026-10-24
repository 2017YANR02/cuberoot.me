/** Small, table-free ranking experiment. Website first entries are explicit
 * training labels, not newly generated solutions. Saved solver output is immutable.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalize3x3WideMoves, toMoveString } from '../../../core/packages/shared/src/alg_notation.ts';
import { strictOuterForm } from '../../../core/packages/shared/src/timer/reconstruct/library_correction.ts';
import { algSpeed } from '../../../core/packages/client/lib/mcc.ts';
import { fixedCaseSetup, inverseTokens, joinMoves, moveTokens, outerKey } from './lll-oriented-notation.mts';
import { isAllowedZbllAlgorithm, ZBLL_ALLOWED_FAMILIES, wideTurnCount } from './zbll-mcc-notation.mts';
import { scoreGripCandidate } from './lll-grip-scoring.mts';
import { moveFeatures, trainPreference, preferenceScore, rankPreference, scoreContributions, type PreferenceGroup } from './lll-preference-ranking.mts';

const root = resolve(import.meta.dirname, '../../..');
const input = resolve(root, '.tmp/pll-21-20261023');
const out = resolve(process.argv[2] ?? resolve(root, '.tmp/pll-preference-20261024-v1'));
assert(!existsSync(resolve(out, 'report.json')), 'Use a new output directory; completed evidence is immutable');
mkdirSync(out, { recursive: true });
const hash = (b: string | Uint8Array) => createHash('sha256').update(b).digest('hex');
const sourceBytes = readFileSync(resolve(input, 'source.json'));
const source = JSON.parse(sourceBytes.toString());
const previousBytes = readFileSync(resolve(input, 'starting-orientation-v2/report.json'));
const previous = JSON.parse(previousBytes.toString());
const { puzzles } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const identity = (await puzzles['3x3x3'].kpuzzle()).defaultPattern();
const clean = (s: string) => canonicalize3x3WideMoves(toMoveString(s)).replace(/2'/g, '2');
const solved = (setup: string, algorithm: string) => identity.applyAlg(joinMoves(setup, algorithm)).experimentalIsSolved({ ignorePuzzleOrientation: false, ignoreCenterOrientation: true });
const family = (algorithm: string) => ['', 'D', 'D2', "D'"].map(d => outerKey(joinMoves(d, outerKey(algorithm), inverseTokens(d)))).sort()[0];
const aufs = ['', 'U', 'U2', "U'"];
const boundaries = aufs.flatMap(pre => aufs.map(post => ({ pre, post })))
  .sort((a, b) => Number(!!a.pre) + Number(!!a.post) - Number(!!b.pre) - Number(!!b.post));

function reference(raw: string, setup: string) {
  const cleaned = clean(raw), ts = moveTokens(cleaned);
  const preAuf = ts[0]?.[0] === 'U' ? ts.shift()! : '';
  const postAuf = ts.at(-1)?.[0] === 'U' ? ts.pop()! : '';
  const leading: string[] = [], trailing: string[] = [];
  while (/^[xyz]/.test(ts[0] ?? '')) leading.push(ts.shift()!);
  while (/^[xyz]/.test(ts.at(-1) ?? '')) trailing.unshift(ts.pop()!);
  const body = ts.join(' '), orientation = leading.join(' ');
  // f,d references are diagnostic until the user resolves the whitelist conflict.
  if (!ts.length || !ts.every(t => /^[RLUDFrufdEMS](?:2|')?$/.test(t))) return null;
  const correction = inverseTokens(strictOuterForm(moveTokens(cleaned)).rotation.join(' '));
  for (const boundary of boundaries) {
    const algorithm = joinMoves(boundary.pre, cleaned, correction, boundary.post);
    if (solved(setup, algorithm)) return { raw, body, orientation, algorithm,
      boundary, preAuf, postAuf, sourceFinalOrientation: trailing.join(' '), correction,
      permitted: isAllowedZbllAlgorithm(body), missingMoveFamilies: [...new Set(ts.filter(t => !isAllowedZbllAlgorithm(t)).map(t => t[0]))] };
  }
  return null;
}

const started = performance.now();
const groups = source.cases.map((c: any) => {
  const old = previous.results.find((r: any) => r.dbId === c.id); assert(old);
  const fixed = fixedCaseSetup(clean(c.setup)); assert.equal(fixed.algorithm, old.setup);
  const entries = c.algs.flat();
  const target = reference(entries[0].alg, fixed.algorithm); assert(target, `Invalid first reference: ${c.name}`);
  const candidates = new Map<string, any>();
  const add = (item: any, origin: string) => {
    assert(solved(fixed.algorithm, item.algorithm), `Invalid solution: ${c.name}`);
    const key = item.orientation + '|' + item.body;
    const existing = candidates.get(key);
    if (existing) existing.origins.push(origin);
    else candidates.set(key, { ...item, origins: [origin] });
  };
  for (const a of old.candidates) add({ body: a.body, orientation: a.orientation, algorithm: a.algorithm,
    permitted: true, queryId: a.queryId }, 'generated');
  const generatedExact = old.candidates.some((a: any) => a.body === target.body && a.orientation === target.orientation);
  const generatedPath = old.candidates.some((a: any) => a.family === family(target.algorithm));
  // A separate calibration pool contains labelled references. This cannot improve
  // generated recall and must not be reported as solver output.
  add(target, 'website-first');
  const ignored: any[] = [];
  for (let i = 1; i < entries.length; i++) {
    const e = entries[i]; if (e.tags?.length) continue;
    const a = reference(e.alg, fixed.algorithm);
    if (a && a.orientation === target.orientation) add(a, 'website-alternative');
    else ignored.push({ sourceIndex: i, reason: 'Different start frame, forbidden move, internal rotation, or no matching AUF' });
  }
  const all = [...candidates.values()].map(a => {
    const mcc = algSpeed(a.body, false, false); assert(typeof mcc === 'number');
    return { ...a, mcc, gripTrial: scoreGripCandidate(a.body, mcc).trialScore,
      features: moveFeatures(a.body), preferred: a.body === target.body && a.orientation === target.orientation };
  });
  assert.equal(all.filter(a => a.preferred).length, 1);
  return { name: c.name, dbId: c.id, sourceSetup: c.setup, setup: fixed.algorithm,
    setupCorrection: fixed.orientationCorrection, target, generatedExact, generatedPath,
    generatedCount: old.candidates.length, ignored, all };
});

// Related mirror/inverse cases stay together in the stricter held-out evaluation.
const component = new Map(source.cases.map((c: any) => [c.meta.no, c.meta.no]));
const find = (n: any): any => component.get(n) === n ? n : find(component.get(n));
for (const c of source.cases) for (const n of [c.meta.inv, c.meta.mirror]) if (component.has(n)) component.set(find(n), find(c.meta.no));
for (const g of groups) g.fold = find(source.cases.find((c: any) => c.id === g.dbId).meta.no);
const training = (gs: any[], maxGram = 3): PreferenceGroup[] => gs.map(g => ({
  preferred: { body: g.target.body, features: moveFeatures(g.target.body, maxGram) },
  alternatives: g.all.filter((a: any) => !a.preferred).map((a: any) => ({ body: a.body, features: moveFeatures(a.body, maxGram) })),
}));
const rank = (g: any, score: (a: any) => number) => {
  const p = g.all.find((a: any) => a.preferred), s = score(p);
  // Ties count against the preference; no stable-sort/source-order credit.
  return 1 + g.all.filter((a: any) => !a.preferred && score(a) <= s + 1e-8).length;
};
const rankWithPreference = (g: any, score: (a: any) => number) => {
  const ordered = rankPreference(g.all.map((a: any) => ({ ...a, score: score(a) }))) as any[];
  const p = ordered.find(a => a.preferred);
  // Equal model/MCC/wide counts remain unresolved, regardless of source order.
  return 1 + Math.max(...ordered.map((a, i) => a === p || (a.mcc === p.mcc
    && wideTurnCount(a.body) === wideTurnCount(p.body)
    && Math.round(a.score * 1e5) === Math.round(p.score * 1e5)) ? i : -1));
};
const stats = (ranks: number[]) => ({ top1: ranks.filter(r => r === 1).length,
  top3: ranks.filter(r => r <= 3).length, mrr: ranks.reduce((s, r) => s + 1 / r, 0) / ranks.length, ranks });
const baseline = { mcc: stats(groups.map((g: any) => rank(g, a => a.mcc))),
  gripTrial: stats(groups.map((g: any) => rank(g, a => a.gripTrial))) };
const runs: any[] = [];
for (const maxGram of [0, 2, 3]) {
  const variantStart = performance.now(), train = training(groups, maxGram);
  const model = trainPreference(train, { maxGram });
  const scored = (a: any, m = model) => preferenceScore(m, moveFeatures(a.body, maxGram));
  const fit = stats(groups.map((g: any) => rankWithPreference(g, a => scored(a))));
  const leaveOne: number[] = [], familyRanks: number[] = [];
  for (let i = 0; i < groups.length; i++) {
    const m = trainPreference(train.filter((_, j) => j !== i), { maxGram });
    leaveOne.push(rankWithPreference(groups[i], a => scored(a, m)));
  }
  const folds = [...new Set(groups.map((g: any) => g.fold))];
  for (const fold of folds) {
    const m = trainPreference(train.filter((_, i) => groups[i].fold !== fold), { maxGram });
    groups.forEach((g: any, i: number) => { if (g.fold === fold) familyRanks[i] = rankWithPreference(g, a => scored(a, m)); });
  }
  const result = { maxGram, model, fit, leaveOneCaseOut: stats(leaveOne), leaveFamilyOut: stats(familyRanks),
    seconds: (performance.now() - variantStart) / 1000 };
  runs.push(result);
  writeFileSync(resolve(out, `model-grams${maxGram}.json`), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ maxGram, fit: fit.top1, leaveOne: result.leaveOneCaseOut.top1,
    leaveFamily: result.leaveFamilyOut.top1, margin: model.minimumMargin, seconds: result.seconds }));
}
// Fixed sequence model, not a winner selected using held-out labels.
const selected = runs.find(r => r.maxGram === 3), model = selected.model;
const details = groups.map((g: any, i: number) => {
  const ranked = rankPreference(g.all.map((a: any) => ({ ...a, score: preferenceScore(model, a.features), features: undefined }))) as any[];
  const generated = rankPreference(ranked.filter((a: any) => a.origins.includes('generated')));
  return { ...g, all: undefined, ranked, generatedTop: generated.slice(0, 3),
    mccRank: baseline.mcc.ranks[i], trainedRank: selected.fit.ranks[i],
    heldOutRank: selected.leaveOneCaseOut.ranks[i], heldOutFamilyRank: selected.leaveFamilyOut.ranks[i],
    contributions: scoreContributions(model, moveFeatures(g.target.body)) };
});
const summary = { cases: groups.length, generatedCandidates: groups.reduce((s: number, g: any) => s + g.generatedCount, 0),
  calibrationCandidates: groups.reduce((s: number, g: any) => s + g.all.length, 0),
  generatedExactReferences: groups.filter((g: any) => g.generatedExact).length,
  generatedReferencePaths: groups.filter((g: any) => g.generatedPath).length,
  generatedTop1Matches: details.filter((g: any) => g.generatedTop[0]?.preferred).length,
  whitelistConflicts: groups.filter((g: any) => !g.target.permitted).map((g: any) => ({ name: g.name, moves: g.target.missingMoveFamilies })),
  baseline, calibrated: selected.fit, leaveOneCaseOut: selected.leaveOneCaseOut, leaveFamilyOut: selected.leaveFamilyOut,
  seconds: (performance.now() - started) / 1000, maxRSSBytes: process.resourceUsage().maxRSS * 1024,
  nativeSolverRerun: false, allowedGeneratedBody: ZBLL_ALLOWED_FAMILIES, independentSolutionsVerified: true };
const provenance = { sourceUrl: source.source, sourceScrapedAt: source.scrapedAt,
  inputHashes: { source: hash(sourceBytes), previousReport: hash(previousBytes) },
  codeHashes: Object.fromEntries(['lll-preference-ranking.mts', 'pll-preference-benchmark.mts'].map(n => [n, hash(readFileSync(resolve(import.meta.dirname, n)))])),
  labelPolicy: 'Website algs.flat()[0], not standard metadata. All these first entries preferred to all other members of their calibration pools as requested by the user.',
  poolPolicy: 'Immutable generated candidates plus explicitly labelled website references. No reference counts as generated unless it was already in the input candidate pool.',
  comparisonPolicy: 'Move body in the same starting orientation; original-frame AUF and boundary rotations excluded. Grouping and half-turn direction marks are retained for display but not modelled.',
  sameMccPolicy: 'Within every equal-MCC group, fewer two-layer turns first, regardless of model score. M/E/S are single-layer moves. Other MCC groups retain their slots.',
  validationPolicy: 'One held-out case and mirror/inverse-connected family per fold; training vocabulary fitted independently. Exploratory comparison, no independent final test set.' };
writeFileSync(resolve(out, 'report.json'), JSON.stringify({ summary, provenance, details }, null, 2) + '\n', { flag: 'wx' });
writeFileSync(resolve(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
const lines = [
  'PLL 个人偏好排序 · 校准实验',
  '网站第一条是训练目标。下列首选来自网站，不冒充新生成公式。',
  '比较忽略原朝向首尾 AUF、分组和 180° 转动方向标记；保留网站原文供试手。',
  'MCC 相同优先双层转动更少的写法；M/E/S 不算双层转动。',
  `MCC 首选命中 ${baseline.mcc.top1}/21；新模型训练内命中 ${selected.fit.top1}/21。`,
  `每次拿掉一个 PLL 再预测：${selected.leaveOneCaseOut.top1}/21；同时拿掉镜像/逆情况：${selected.leaveFamilyOut.top1}/21。`,
  `原求解池已包含网站首选相同主体 ${summary.generatedExactReferences}/21；只在生成池内排序时首选命中 ${summary.generatedTop1Matches}/21。`,
  `有 ${summary.whitelistConflicts.length} 条网站目标含未获准的 f/d，仅作为诊断目标；生成结果仍遵守原白名单。`,
  '',
  ...details.flatMap((g: any) => [
    `${g.name} → ${g.target.raw}`,
    `  网站首选；MCC 第 ${g.mccRank} → 校准第 ${g.trainedRank}；未见此例时第 ${g.heldOutRank}。`,
    `  原求解池${g.generatedExact ? '已包含相同主体' : '未生成相同主体'}${g.target.permitted ? '' : '；含未获准的 '+g.target.missingMoveFamilies.join('/') }。`,
    `  当前生成第一 → ${g.generatedTop[0].algorithm}`, '',
  ]),
];
writeFileSync(resolve(out, 'comparison.txt'), lines.join('\n') + '\n', { flag: 'wx' });
writeFileSync(resolve(out, 'generated-top-3.txt'), ['只含独立验解的已有求解结果；按新偏好模型排序。训练集内重排，不是未见情况测试。', '',
  ...details.flatMap((g: any) => [`${g.name} · 固定打乱：${g.sourceSetup}`,
    ...g.generatedTop.map((a: any, i: number) => `  ${i + 1} → ${a.algorithm}`), ''])].join('\n') + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary));
