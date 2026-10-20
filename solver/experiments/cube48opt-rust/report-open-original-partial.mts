/** Preserve the failed upstream run. No extrapolated 1000-state time. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openRoot, openBase, openDir, openRequest } from './open-benchmark-policy.mts';
import { verify } from './benchmark.mjs';
import { readWca100 } from './wasm-benchmark.mjs';
const bytes=readFileSync(resolve(openBase,openRequest('original-wasm').label+'-resources.json'));
const resource=JSON.parse(bytes.toString());
assert.equal(resource.stopped,'Benchmark child exited with status 1');assert.equal(resource.trigger.reason,resource.stopped);
assert.equal(resource.pressure,1);assert.equal(resource.swapouts,16);assert(resource.minimumHeadroom>=2*2**30&&resource.peakRss<=resource.rssLimit);
const rows=readFileSync(resolve(openDir,'original-wasm-setupfix/original/results.jsonl'),'utf8').trim().split('\n').map(x=>JSON.parse(x));
const reference=readFileSync(resolve(openDir,'rust-native.jsonl'),'utf8').trim().split('\n').map(x=>JSON.parse(x));
const corpus=readWca100(resolve(openRoot,'solver/testdata/benchmarks/wca-first1000.json'),1000);
assert.equal(rows.length,431);
const {cube3x3x3}=await import(pathToFileURL(resolve(openRoot,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
const puzzle=await cube3x3x3.kpuzzle();
for(let i=0;i<rows.length;i++) {assert.equal(rows[i].id,corpus.cases[i].id);assert.equal(rows[i].length,reference[i].length);verify(puzzle,corpus.cases[i],rows[i]);}
assert(readFileSync(resolve(openDir,'original-wasm-setupfix/original/stderr.log'),'utf8').trim().endsWith('unwind'));
const report={engine:'original-wasm',exitCode:1,verifiedSolutions:431,optimalLengthsMatched:431,
  expected:1000,failedIndex:432,failedId:corpus.cases[431].id,reason:'Node WASM session exited with unwind',
  resourceSha256:createHash('sha256').update(bytes).digest('hex'),partialSeconds:rows.reduce((sum,r)=>sum+r.seconds,0),
  rankingEligible:false,resource};
writeFileSync(resolve(openDir,'original-wasm-partial-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({completed:431,failedId:report.failedId,rankingEligible:false});
