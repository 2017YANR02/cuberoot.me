/** Publish only completed, verified WCA100 reports. This never launches solvers. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { setTimeout } from 'node:timers/promises';
const root = resolve(import.meta.dirname, '../../..');
const directory = resolve(process.argv[2]);
const watch = process.argv.includes('--watch');
const run = basename(directory).replace(/^benchmark-/, '');
assert(/^wca100-(?:h10|opt[1-9])$/.test(run));
const corpusFile = resolve(root, 'solver/testdata/benchmarks/wca-first100.json');
const corpus = JSON.parse(readFileSync(corpusFile, 'utf8'));
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const pageFile = resolve(root, 'core/packages/client/app/[lang]/dev/solvers/compare/unified-benchmark.ts');
type Result = {id:string;seconds:number;peakRssBytes:number|null};
function update(results:Result[], status:{zh:string;en:string}) {
  const previous = JSON.parse(readFileSync(pageFile,'utf8').split('export const WCA100 = ')[1].trim().replace(/;$/, ''));
  assert.equal(previous.corpusSha256, corpus.corpusSha256);
  const data = {...previous, status, results:[...previous.results.filter((r:Result)=>!results.some(n=>n.id===r.id)),...results]};
  writeFileSync(pageFile+'.tmp', '/** Verified WCA100 results; raw reports: .tmp/cubeopt-reverse/benchmark-wca100-*/\nexport const WCA100 = '+JSON.stringify(data,null,2)+';\n');
  renameSync(pageFile+'.tmp',pageFile);
}
const deadline = Date.now() + 65 * 60_000;
while (!existsSync(resolve(directory, 'report.json'))) {
  const resourceFile = resolve(root, `.tmp/cubeopt-reverse/${run}-resources.json`);
  const stopped = existsSync(resourceFile) && JSON.parse(readFileSync(resourceFile, 'utf8')).stopped;
  if (stopped || existsSync(resolve(directory, 'failure.json')) || Date.now() > deadline) {
    update([], {zh:`${run.replace('wca100-','').toUpperCase()} 未完成`,en:`${run} incomplete`});
    throw Error('Benchmark incomplete; no performance result published. See ' + directory);
  }
  if (!watch) throw Error('No completed report: ' + directory);
  await setTimeout(5000);
}
const input = JSON.parse(readFileSync(resolve(directory, 'input.json'), 'utf8'));
const report = JSON.parse(readFileSync(resolve(directory, 'report.json'), 'utf8'));
const h10 = run === 'wca100-h10';
assert.equal(input.casesSourceSha256 ?? input.corpusFileSha256, digest(readFileSync(corpusFile)));
assert.deepEqual(input.cases, corpus.cases);
assert.equal(report.cases, 100);
assert.equal(report.mode, 'benchmark');
assert.equal(input.measurementRounds, 3);
assert.equal(report.verifiedSolutions, 1600);
const rows = readFileSync(resolve(directory, 'results.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
assert.equal(rows.length, 1600);
assert(rows.every(r => r.verified === true));
for (const side of h10 ? ['rust','c'] : ['native', 'wasm']) {
  const totals: number[] = [];
  for (const round of [1, 2, 3]) {
    const batch = rows.filter(r => r.side === side && r.phase === 'measure' && r.round === round);
    assert.deepEqual(batch.map(r => r.id), corpus.cases.map((r: {id: string}) => r.id));
    totals.push(batch.reduce((sum, r) => sum + r.seconds, 0));
  }
  assert.deepEqual(totals, h10 ? report.totals[side].map((r:{seconds:number})=>r.seconds) : report.groups.all[side].totalSecondsByRound);
  assert.equal(totals.toSorted((a,b) => a-b)[1], h10 ? report[`${side}MedianTotalSeconds`] : report.groups.all[side].medianRoundTotalSeconds);
}
const results:Result[] = h10 ? ['c','rust'].map(side=>({id:side==='c'?'nissy-h10':'rust-h10',seconds:report[`${side}MedianTotalSeconds`],peakRssBytes:Math.max(...report.batches.filter((b:{side:string})=>b.side===side).map((b:{peakRssBytes:number})=>b.peakRssBytes))})) : [{ id: `opt-${report.variant}`, seconds: report.groups.all.wasm.medianRoundTotalSeconds, peakRssBytes: null }];
if(!h10) assert.equal(run, `wca100-opt${report.variant}`);
update(results, {zh:'100 条 · 三轮中位数',en:'100 scrambles · median of 3 rounds'});
console.log(JSON.stringify({published:results}));
