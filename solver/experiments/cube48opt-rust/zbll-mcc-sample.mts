/** Single-case candidate sampling with the existing frozen Opt9, not MCC-optimal search. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { normalize } from '../../../core/packages/shared/src/recon_ground_truth.ts';
import { strictOuterForm } from '../../../core/packages/shared/src/timer/reconstruct/library_correction.ts';
import { canonicalize3x3WideMoves } from '../../../core/packages/shared/src/alg_notation.ts';
import { algSpeed, normalizeLine, MCC_DEFAULTS, getSTM } from '../../../core/packages/client/lib/mcc.ts';
import { compareZbllNotation, improveNotation, isAllowedZbllAlgorithm, ZBLL_ALLOWED_FAMILIES } from './zbll-mcc-notation.mts';

const root = resolve(import.meta.dirname, '../../..');
const out = resolve(root, '.tmp/zbll-mcc-20261023');
const { Alg } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/alg/index.js'));
const { puzzles } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const loader = puzzles['3x3x3'];
const kp = await loader.kpuzzle();
const selected = JSON.parse(readFileSync(resolve(out, 'case.json'), 'utf8'));
const setup: string = selected.setup;
const start = kp.defaultPattern().applyAlg(setup);
const tokens = (alg: string): string[] => alg.trim().split(/\s+/).filter(Boolean);
const simplify = (alg: string): string => canonicalize3x3WideMoves(new Alg(alg).experimentalSimplify({cancel: true, puzzleLoader: loader}).toString());
const score = (alg: string): number => {
  const result = algSpeed(normalizeLine(alg), false, true, MCC_DEFAULTS);
  assert(typeof result === 'number' && Number.isFinite(result), `Invalid MCC: ${alg}: ${result}`);
  return result;
};
const solved = (alg: string): boolean => start.applyAlg(alg).experimentalIsSolved({ignorePuzzleOrientation: true, ignoreCenterOrientation: true});
const stateKey = (pattern: any): string => JSON.stringify({EDGES: pattern.patternData.EDGES, CORNERS: pattern.patternData.CORNERS, centers: pattern.patternData.CENTERS.pieces});
const save = (name: string, data: unknown) => writeFileSync(resolve(out, name), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});

async function prepare() {
  assert(!existsSync(resolve(out, 'input.tsv')));
  const families = ZBLL_ALLOWED_FAMILIES;
  const moves = families.flatMap(f => ['', "'", '2'].map(s => f + s));
  const axis = (m: string) => 'RrLlM'.includes(m[0]) ? 0 : 'UuDdE'.includes(m[0]) ? 1 : 2;
  const queries: any[] = [];
  const states = new Set<string>();
  const add = (prefix: string) => {
    const original = [setup, prefix].filter(Boolean).join(' ');
    const normalized = normalize(tokens(original), {expandSlices: true});
    const rotation = normalized.filter(t => /^[xyz]/.test(t)).join(' ');
    const scramble = simplify(normalized.filter(t => /^[URFDLB]/.test(t)).join(' '));
    assert(/^(?:[URFDLB](?:2|')?(?: |$))+$/.test(scramble));
    const a = kp.defaultPattern().applyAlg(original);
    const b = kp.defaultPattern().applyAlg([rotation, scramble].filter(Boolean).join(' '));
    assert.equal(stateKey(a), stateKey(b), 'Lossless frame conversion');
    assert(solved([prefix, new Alg(scramble).invert().toString()].filter(Boolean).join(' ')), 'Completion frame proof');
    const key = stateKey(kp.defaultPattern().applyAlg(scramble));
    if (states.has(key)) return;
    states.add(key);
    queries.push({id: `q${String(queries.length).padStart(4, '0')}`, prefix, scramble, rotation});
  };
  add('');
  for (const a of moves) add(a);
  for (const a of moves) for (const b of moves) if (axis(a) !== axis(b)) add(`${a} ${b}`);
  let seed = 20261023;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  let attempts = 0;
  while (queries.length < 5000) {
    assert(++attempts < 200000, 'Insufficient distinct prefix states');
    const prefix: string[] = [];
    while (prefix.length < 3) {
      const m = moves[next() % moves.length];
      if (!prefix.length || axis(m) !== axis(prefix.at(-1)!)) prefix.push(m);
    }
    add(prefix.join(' '));
  }
  save('queries.json', {schema: 'cuberoot.zbll-mcc-queries.v1', setup, count: queries.length, moves,
    strategy: 'all one/two moves on different axes plus seeded three-move prefixes; unique normalized successor states', seed: 20261023, queries});
  writeFileSync(resolve(out, 'input.tsv'), queries.map(q => `${q.id}\t${q.scramble}\n`).join(''), {flag: 'wx'});
  console.log(JSON.stringify({prepared: queries.length, setup, input: resolve(out, 'input.tsv')}));
}

async function report() {
  const began = performance.now();
  const input = JSON.parse(readFileSync(resolve(out, 'queries.json'), 'utf8'));
  const queries = new Map<string, any>(input.queries.map((q: any) => [q.id, q]));
  const runDir = resolve(out, 'single');
  const lines = readFileSync(resolve(runDir, 'raw.jsonl'), 'utf8').trim().split('\n').filter(Boolean);
  const rows = lines.map(line => JSON.parse(line));
  const unique = new Map<string, any>();
  let verified = 0, incomplete = 0;
  const seen = new Set<string>();
  function retain(algorithm: string, provenance: any, enforceAllowed = false) {
    const simplified = simplify(algorithm);
    // Cube-aware same-axis simplification can introduce an excluded wide move.
    // In the final pass, preserve the legal spelling using only same-family cancellation.
    algorithm = enforceAllowed && !isAllowedZbllAlgorithm(simplified)
      ? canonicalize3x3WideMoves(new Alg(algorithm).experimentalSimplify({cancel: true}).toString())
      : simplified;
    if (enforceAllowed) assert(isAllowedZbllAlgorithm(algorithm), `Forbidden output move: ${algorithm}`);
    assert(solved(algorithm), `Independent replay failed: ${algorithm}`);
    const key = strictOuterForm(tokens(algorithm)).key;
    const candidate = {algorithm, mcc: score(algorithm), stm: getSTM(algorithm, true), outerHtm: tokens(key).length, key, ...provenance};
    const previous = unique.get(key);
    if (!previous || compare(candidate, previous) < 0) unique.set(key, candidate);
  }
  function compare(a: any, b: any) {return a.mcc - b.mcc || a.stm - b.stm || a.outerHtm - b.outerHtm || compareZbllNotation(a.algorithm, b.algorithm);}
  for (const row of rows) {
    const q = queries.get(row.id);
    assert(q && !seen.has(row.id), 'Unknown or repeated native output'); seen.add(row.id);
    if (row.cancelled || typeof row.solution !== 'string') {incomplete++; continue;}
    assert(kp.defaultPattern().applyAlg(`${q.scramble} ${row.solution}`).experimentalIsSolved({ignorePuzzleOrientation:false, ignoreCenterOrientation:true}));
    verified++;
    retain([q.prefix, row.solution].filter(Boolean).join(' '), {source:'Opt9 prefix completion', queryId: row.id, prefix:q.prefix, nativeSolution:row.solution, nativeSeconds:row.seconds});
  }
  const beforeNotation = [...unique.values()].sort(compare);
  // The raw prefix-completion archive predates the corrected move whitelist.
  // Keep its paths as search evidence, but never let its spellings enter the final ranking.
  unique.clear();
  for (const row of beforeNotation) {
    for (const alternative of improveNotation(row.algorithm)) retain(alternative, {
      source: row.source, queryId:row.queryId, prefix:row.prefix, nativeSolution:row.nativeSolution, nativeSeconds:row.nativeSeconds,
    }, true);
  }
  // D commutes with a last-layer-only state. Conjugating a solution by D
  // creates a low-value variation; keep just the best MCC spelling per orbit.
  assert.equal(stateKey(start.applyAlg('D')), stateKey(kp.defaultPattern().applyAlg(`D ${setup}`)));
  const dClasses = new Map<string, any>();
  for (const candidate of unique.values()) {
    const equivalenceKey = ['', 'D', 'D2', "D'"].map(d =>
      strictOuterForm(tokens([d, candidate.key, new Alg(d).invert().toString()].filter(Boolean).join(' '))).key).sort()[0];
    const previous = dClasses.get(equivalenceKey);
    if (!previous || compare(candidate, previous) < 0) dClasses.set(equivalenceKey, {...candidate, equivalenceKey});
  }
  const candidates = [...dClasses.values()].sort(compare);
  const top = candidates.slice(0, 200).map((row, i) => ({rank:i+1,...row}));
  assert(top.length === 200, `Only ${top.length} distinct paths`);
  assert(candidates.every(row => isAllowedZbllAlgorithm(row.algorithm)), 'All ranked candidates must obey the move whitelist');
  const resourcesPath = resolve(root,'.tmp/cubeopt-reverse/zbll-mcc-20261023-opt9-single-resources.json');
  const resources = JSON.parse(readFileSync(resourcesPath,'utf8'));
  const run = JSON.parse(readFileSync(resolve(runDir,'run.json'),'utf8'));
  const summary = {
    schema:'cuberoot.zbll-mcc-report.v1', completedAt: new Date().toISOString(), case:selected.selection, setup,
    engine:'Frozen official native Opt9', method:input.strategy, generatedInputs:input.count,
    allowedOutputMoveFamilies:ZBLL_ALLOWED_FAMILIES, allowedSuffixes:['', "'", '2'],
    revision:'Restricted move families and preferred fewer wide/slice turns for tied MCC/length; reused saved native solutions without rerunning the solver.',
    notationTieBreak:'For equal MCC and move counts, prefer fewer wide/slice turns, then lexical order. This is a representation preference, not measured execution speed.',
    completedOutputs:rows.length, verifiedSolutions:verified, incomplete, pathsBeforeDConjugationDedup:unique.size,
    uniquePaths:candidates.length, deduplication:'Canonical outer paths, then D-conjugate solution families; lowest MCC representation retained', returned:top.length,
    searchSeconds:rows.reduce((s,r)=>s+r.seconds,0), wallSeconds:run.wallSeconds, postprocessSeconds:(performance.now()-began)/1000,
    peakRssBytes:resources.peakRss, minimumHeadroomBytes:resources.minimumHeadroom, swapoutsBefore:resources.openBenchmarkReceipt.before.swapouts,
    swapoutsAfter:resources.swapouts, boot:resources.boot, guardPid:resources.guardPid, childPid:resources.childPid,
    guardExitCode:run.exitCode, guardStopped:resources.stopped, mcc:selected.mcc,
    limits:['Best 200 among this sampled candidate set; not a global MCC optimum.', 'The native engine optimizes the outer-turn completion only. Full candidates are not necessarily HTM optimal.', 'Equivalent outer paths and D-conjugate solution families are deduplicated; all output algorithms solve the exact setup up to whole-cube orientation.', 'Starting and ending AUF moves remain in the algorithms but are excluded by the website default MCC score.', 'MCC is a model score, not a measured execution time.'],
    existingLibraryComparison:selected.existingAlgorithms.map((a:any)=>({algorithm:a.algorithm,mcc:a.mcc})), top,
  };
  save('report.json',summary);
  save('all-candidates.json',candidates);
  const allowedText = ZBLL_ALLOWED_FAMILIES.join(' ');
  const heading = `ZBLL U 3 / UR1 — Opt9 候选集 MCC 前 200\n打乱：${setup}\n仅允许：${allowedText}，以及各自的逆转和半转。\nMCC 使用网站默认参数，忽略首尾 AUF；公式保留完整 AUF。均经独立验解。同分、同步数时优先使用更少宽层和切片转动的写法。\n本结果是采样候选集排序，不保证全局 MCC 最优，也不保证每条 HTM 最短。\n\n排名\tMCC\tSTM（去AUF）\t公式\n`;
  writeFileSync(resolve(out,'top-200.txt'),heading+top.map(r=>`${r.rank}\t${r.mcc.toFixed(1)}\t${r.stm}\t${r.algorithm}`).join('\n')+'\n',{flag:'wx'});
  const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  writeFileSync(resolve(out,'top-200.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ZBLL U 3 · MCC 前 200</title><style>body{font:16px system-ui;max-width:1100px;margin:32px auto;padding:0 20px;line-height:1.6}code,td:last-child{font-family:ui-monospace,monospace}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #ddd}th{position:sticky;top:0;background:white}input{font:inherit;padding:6px;width:95%}small{color:#555}</style><h1>ZBLL U 3 · MCC 前 200</h1><p>打乱：<code>${esc(setup)}</code></p><p>仅允许：<code>${esc(allowedText)}</code>，以及各自的逆转和半转。</p><p>${verified} 条 Opt9 补全，${candidates.length} 个去重路径；求解 ${summary.searchSeconds.toFixed(3)} 秒，含载表运行 ${summary.wallSeconds.toFixed(3)} 秒。内存峰值 ${(summary.peakRssBytes/1e9).toFixed(2)} GB。</p><p>公式均通过独立验解。MCC 使用网站默认参数，忽略首尾 AUF，分值越低越好；公式保留完整 AUF。同分、同步数时优先使用更少宽层和切片转动的写法。<strong>这是采样候选集的排名，不保证全局 MCC 最优或每条 HTM 最短。</strong></p><p><a href="top-200.txt" download>下载文本</a> · <a href="report.json" download>完整记录</a> · <a href="https://cuberoot.me/zh/alg/3x3/zbll/ur1">情况页面</a> · <a href="https://cuberoot.me/zh/scramble/mcc">MCC 参数</a></p><input id="filter" type="search" placeholder="筛选公式"><table><thead><tr><th>排名</th><th>MCC</th><th>STM<br><small>去AUF</small></th><th>公式</th></tr></thead><tbody>${top.map(r=>`<tr><td>${r.rank}</td><td>${r.mcc.toFixed(1)}</td><td>${r.stm}</td><td>${esc(r.algorithm)}</td></tr>`).join('')}</tbody></table><script>document.querySelector('#filter').addEventListener('input',e=>{for(const row of document.querySelectorAll('tbody tr'))row.hidden=!row.lastElementChild.textContent.includes(e.target.value)})</script></html>`,{flag:'wx'});
  console.log(JSON.stringify({...summary,top:top.slice(0,10)},null,2));
}

const mode=process.argv[2];
if(mode==='prepare') await prepare(); else if(mode==='report') await report(); else throw Error('Use prepare or report; solver execution must go through guard.mts.');
