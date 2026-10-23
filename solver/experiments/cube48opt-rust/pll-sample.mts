/** PLL generation benchmark. Reference algorithms never enter solver queries. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toMoveString, canonicalize3x3WideMoves } from '../../../core/packages/shared/src/alg_notation.ts';
import { normalize } from '../../../core/packages/shared/src/recon_ground_truth.ts';
import { strictOuterForm } from '../../../core/packages/shared/src/timer/reconstruct/library_correction.ts';
import { algSpeed, getSTM } from '../../../core/packages/client/lib/mcc.ts';
import { improveNotation, isAllowedZbllAlgorithm, ZBLL_ALLOWED_FAMILIES } from './zbll-mcc-notation.mts';
import { GRIP_WEIGHTS, scoreGripCandidate, startLabel } from './lll-grip-scoring.mts';

const root = resolve(import.meta.dirname, '../../..'), out = resolve(root, '.tmp/pll-21-20261023');
const { Alg } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/alg/index.js'));
const { puzzles } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const loader = puzzles['3x3x3'], identity = (await loader.kpuzzle()).defaultPattern();
const tokens = (s: string) => s.split(/\s+/).filter(Boolean);
const canonical = (s: string) => strictOuterForm(tokens(s)).key;
const clean = (s: string) => canonicalize3x3WideMoves(toMoveString(s)).replace(/2'/g, '2');
const simplify = (s: string) => canonicalize3x3WideMoves(new Alg(s).experimentalSimplify({ cancel: true, puzzleLoader: loader }).toString()).replace(/2'/g, '2');
const inverse = (s: string) => new Alg(s).invert().toString().replace(/2'/g, '2');
const save = (f: string, v: unknown) => writeFileSync(resolve(out, f), JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
const solved = (setup: string, alg: string) => identity.applyAlg(`${setup} ${alg}`).experimentalIsSolved({ ignorePuzzleOrientation: false, ignoreCenterOrientation: true });
const mcc = (alg: string) => { const n = algSpeed(alg, false, true); assert(typeof n === 'number' && Number.isFinite(n)); return n; };
const score = (algorithm: string) => { const base = mcc(algorithm); return { algorithm, mcc: base, stm: getSTM(algorithm, true), ...scoreGripCandidate(algorithm, base) }; };
const compare = (a: any, b: any) => a.trialScore - b.trialScore || a.midRegrips.length - b.midRegrips.length || a.mcc - b.mcc || a.stm - b.stm || a.algorithm.localeCompare(b.algorithm);
const family = (s: string) => ['', 'D', 'D2', "D'"].map(d => canonical(`${d} ${canonical(s)} ${inverse(d)}`)).sort()[0];

if (process.argv[2] === 'prepare') {
  const source = JSON.parse(readFileSync(resolve(out, 'source.json'), 'utf8'));
  assert.equal(source.cases.length, 21);
  const aliases: Record<string, string> = { 'A+': 'Aa', 'A-': 'Ab', L: 'Ja', 'U+': 'Ub' };
  const cases = source.cases.map((c: any, i: number) => ({ id: `p${String(i + 1).padStart(2, '0')}`, dbId: c.id,
    name: aliases[c.name] ?? c.name, sourceName: c.name, setup: canonical(clean(c.setup)) }));
  const u = identity.applyAlg('U').patternData;
  for (const c of cases) {
    const d = identity.applyAlg(c.setup).patternData;
    for (const orbit of ['CORNERS', 'EDGES']) for (let i = 0; i < d[orbit].pieces.length; i++) {
      assert.equal(d[orbit].orientation[i], 0, `${c.name}: PLL must be oriented`);
      if (u[orbit].pieces[i] === i) assert.equal(d[orbit].pieces[i], i, `${c.name}: F2L must be fixed`);
    }
  }
  let seed = 20261023;
  const random = () => seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const moves = ZBLL_ALLOWED_FAMILIES.flatMap(f => ['', "'", '2'].map(s => f + s));
  const groups = cases.map((c: any) => {
    const queries: any[] = [], seen = new Set<string>();
    const add = (prefix: string) => {
      const normalized = normalize(tokens(`${c.setup} ${prefix}`), { expandSlices: true });
      const scramble = canonical(normalized.filter(t => /^[URFDLB]/.test(t)).join(' '));
      const state = JSON.stringify(identity.applyAlg(scramble).patternData);
      if (!scramble || seen.has(state)) return;
      seen.add(state);
      assert(identity.applyAlg(`${c.setup} ${prefix} ${inverse(scramble)}`).experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true }));
      queries.push({ id: `${c.id}q${String(queries.length).padStart(3, '0')}`, caseId: c.id, prefix, scramble });
    };
    add(''); for (const m of moves) add(m);
    let attempts = 0;
    while (queries.length < 100) {
      assert(++attempts < 10000);
      const a = moves[random() % moves.length], b = moves[random() % moves.length];
      if (a[0] !== b[0]) add(`${a} ${b}`);
    }
    return queries;
  });
  const queries = Array.from({ length: 100 }, (_, i) => groups.map((g: any[]) => g[i])).flat();
  assert.equal(queries.length, 2100);
  save('queries.json', { cases, queries, method: '100 unique prefix-completion states per PLL; 21 cases interleaved; no library solution input' });
  writeFileSync(resolve(out, 'input.tsv'), queries.map((q: any) => `${q.id}\t${q.scramble}\n`).join(''), { flag: 'wx' });
  console.log(JSON.stringify({ cases: cases.map((c: any) => c.name), queries: queries.length }));
} else if (process.argv[2] === 'report') {
  const started = performance.now();
  const q = JSON.parse(readFileSync(resolve(out, 'queries.json'), 'utf8'));
  const queries = new Map(q.queries.map((r: any) => [r.id, r]));
  const lines = readFileSync(resolve(out, 'raw.jsonl'), 'utf8').trim().split('\n').filter(Boolean);
  const rows = lines.map(line => JSON.parse(line));
  const ids = new Set<string>();
  for (const row of rows) { assert(queries.has(row.id)); assert(!ids.has(row.id)); ids.add(row.id); }
  const source = JSON.parse(readFileSync(resolve(out, 'source.json'), 'utf8'));
  const checkpoint = resolve(out, 'cases.jsonl');
  const existing = existsSync(checkpoint) ? readFileSync(checkpoint, 'utf8').trim().split('\n').filter(Boolean).map(s => JSON.parse(s)) : [];
  const results: any[] = [];
  for (const c of q.cases) {
    const saved = existing.find((e: any) => e.id === c.id);
    if (saved) { results.push(saved); continue; }
    const bucket = new Map<string, any>();
    let verified = 0, incomplete = 0;
    for (const row of rows.filter((r: any) => r.id.startsWith(c.id + 'q'))) {
      const query: any = queries.get(row.id);
      if (row.cancelled || typeof row.solution !== 'string') { incomplete++; continue; }
      assert(solved(query.scramble, row.solution)); verified++;
      const raw = canonical(`${query.prefix} ${row.solution}`);
      for (const notation of improveNotation(raw, { preserveOrientation: true, beamPerFrame: 8, completeBoundaryAUF: true })) {
        const algorithm = simplify(notation);
        assert(isAllowedZbllAlgorithm(algorithm)); assert(solved(c.setup, algorithm));
        const item = { ...score(algorithm), family: family(algorithm), queryId: row.id };
        const old = bucket.get(item.family);
        if (!old || compare(item, old) < 0) bucket.set(item.family, item);
      }
    }
    const all = [...bucket.values()].sort(compare);
    const mccSorted = [...all].sort((a, b) => a.mcc - b.mcc || a.stm - b.stm || a.algorithm.localeCompare(b.algorithm));
    const candidates = all.slice(0, 200).map((a, i) => ({ ...a, rank: i + 1, mccRank: mccSorted.indexOf(a) + 1 }));
    // Separately align library reference formulas by y-frame and boundary AUF.
    const original = source.cases.find((s: any) => s.id === c.dbId);
    const referenceEntries = [{ alg: original.standard, source: 'standard' }, ...original.algs.flat().filter((a: any) => !a.tags?.length)].filter((a: any) => a.alg);
    const refs = new Map<string, any>(), rejected: any[] = [];
    const seenRefs = new Set<string>();
    for (const entry of referenceEntries) {
      let raw: string;
      try { raw = clean(entry.alg); } catch (error) { rejected.push({ algorithm: entry.alg, reason: String(error) }); continue; }
      if (seenRefs.has(raw)) continue; seenRefs.add(raw);
      for (const y of ['', 'y', 'y2', "y'"]) {
        const path = canonical(`${y} ${raw} ${inverse(y)}`);
        const forms = improveNotation(path, { preserveOrientation: true, beamPerFrame: 8, completeBoundaryAUF: true });
        if (!y && isAllowedZbllAlgorithm(raw)) forms.push(raw);
        for (const f of new Set(forms)) for (const pre of ['', 'U', 'U2', "U'"]) for (const post of ['', 'U', 'U2', "U'"]) {
          const alg = `${pre} ${f} ${post}`.trim().replace(/\s+/g, ' ');
          if (!solved(c.setup, alg)) continue;
          const algorithm = simplify(alg);
          assert(isAllowedZbllAlgorithm(algorithm)); assert(solved(c.setup, algorithm));
          const item = { ...score(algorithm), family: family(algorithm), sourceAlgorithm: entry.alg, source: entry.source,
            rewritten: algorithm !== raw, yFrame: y, preAuf: pre, postAuf: post };
          const old = refs.get(item.family);
          if (!old || compare(item, old) < 0) refs.set(item.family, item);
        }
      }
    }
    const references = [...refs.values()].sort(compare);
    const reference = references[0] ?? null;
    const referenceHypotheticalRank = reference ? 1 + all.filter(a => compare(a, reference) < 0).length : null;
    const matchedFamilies = references.filter(r => bucket.has(r.family));
    const result = { ...c, verified, incomplete, uniqueFamilies: all.length, candidates, references, rejectedReferences: rejected,
      referenceHypotheticalRank, referenceFamiliesGenerated: matchedFamilies.length,
      originalMccWinner: mccSorted[0] ?? null, sourceUrl: 'https://cuberoot.me/zh/alg/3x3/pll',
      setupDisplay: candidates.length ? inverse(candidates[0].algorithm) : null };
    appendFileSync(checkpoint, JSON.stringify(result) + '\n');
    results.push(result);
    console.log(JSON.stringify({ name: c.name, verified, incomplete, candidates: candidates.length,
      references: references.length, referenceHypotheticalRank, matchedFamilies: matchedFamilies.length,
      best: candidates[0]?.algorithm }));
  }
  for (const c of results) for (const a of [...c.candidates, ...c.references]) {
    assert(isAllowedZbllAlgorithm(a.algorithm)); assert(solved(c.setup, a.algorithm));
  }
  const summary = { cases: results.length, inputs: q.queries.length, returned: rows.length,
    solvedInputs: results.reduce((n, c) => n + c.verified, 0), incompleteInputs: results.reduce((n, c) => n + c.incomplete, 0),
    casesWithCandidates: results.filter(c => c.candidates.length).length,
    candidates: results.reduce((n, c) => n + c.candidates.length, 0),
    casesWithReferences: results.filter(c => c.references.length).length,
    casesRecoveringReferenceFamily: results.filter(c => c.referenceFamiliesGenerated > 0).length,
    changedWinners: results.filter(c => c.candidates[0]?.algorithm !== c.originalMccWinner?.algorithm).length,
    nativeSearchSeconds: rows.reduce((n, r) => n + (r.seconds ?? 0), 0),
    postprocessSecondsThisInvocation: (performance.now() - started) / 1000 };
  save('report.json', { createdAt: new Date().toISOString(), summary, weights: GRIP_WEIGHTS, allowed: ZBLL_ALLOWED_FAMILIES,
    method: q.method, limitations: 'Bounded sample, not exhaustive. No neural model. Regrips are MCC path predictions; reference comparisons are model scores, not human speed measurements. Reference algorithms may be rewritten to obey the same move restrictions.', results });
  const header = `PLL 21 例 · OPT9 候选 / 换手偏好试排\n仅允许 ${ZBLL_ALLOWED_FAMILIES.join(' ')} 及逆转、半转。\n试排分 = MCC + 3 × 预测中途重握 + 0.5 × 握持模式切换；MCC 去首尾 AUF，手部分析含完整 AUF。\n这是有预算的采样；换手是模型预测，0 次不保证真人无换手。参考公式单列，未混入生成结果。\n\n`;
  const line = (a: any) => `${a.algorithm}\n   MCC ${a.mcc.toFixed(1)}；试排 ${a.trialScore.toFixed(1)}；${startLabel(a.grip)}；预测中途重握 ${a.midRegrips.length} 次${a.midRegrips.length ? '（第 ' + a.midRegrips.map((e: any) => e.beforeMove).join('、') + ' 步前）' : ''}；握持模式切换 ${a.supportSwitches.length} 次`;
  const format = (n: number) => header + results.map(c => `PLL ${c.name}\n${c.setupDisplay ? '打乱：' + c.setupDisplay + '\n' : ''}候选 ${c.candidates.length} 条；补全成功 ${c.verified}/100。\n` + c.candidates.slice(0, n).map((a: any) => `${a.rank}. ${line(a)}；原 MCC 第 ${a.mccRank} 名`).join('\n\n')
    + (c.references[0] ? `\n\n参考公式（合法等价写法）：${line(c.references[0])}\n若插入候选，按试排分排第 ${c.referenceHypotheticalRank}；候选中${c.referenceFamiliesGenerated ? '已出现参考公式的路径家族' : '未命中参考公式的路径家族'}。` : '\n无满足当前转动限制且验解通过的参考写法。')).join('\n\n') + '\n';
  writeFileSync(resolve(out, 'top-3.txt'), format(3), { flag: 'wx' });
  writeFileSync(resolve(out, 'all-candidates.txt'), format(200), { flag: 'wx' });
  writeFileSync(resolve(out, 'overview.txt'), header + results.map(c => `${c.name}：${c.candidates.length} 条；首选 ${c.candidates[0]?.algorithm ?? '暂无'}\n参考试排位置 ${c.referenceHypotheticalRank ?? '无'}；参考路径${c.referenceFamiliesGenerated ? '已生成' : '未生成'}`).join('\n\n') + '\n', { flag: 'wx' });
  console.log(JSON.stringify(summary));
} else throw new Error('Use prepare or report');
