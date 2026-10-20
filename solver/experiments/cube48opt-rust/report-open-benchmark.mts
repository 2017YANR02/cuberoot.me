/** Independent replay only: never starts a solver or loads a pruning table. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { openBase, openDir, openRoot, openRequest, openEngines } from './open-benchmark-policy.mts';
import { readWca100 } from './wasm-benchmark.mjs';
import { verify } from './benchmark.mjs';
import { resumeRequest, resumeOutput } from './original-resume-policy.mts';
import { candidateRequest } from './opt9-wasm-candidate-policy.mts';
const engine=process.argv[2],candidate=engine==='rust-wasm-opt9-quarter-fixed';assert(candidate||openEngines.includes(engine as any));
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const lines=(path:string)=>{const s=readFileSync(path,'utf8');assert(s.endsWith('\n'));return s.trim().split('\n').map(x=>JSON.parse(x));};
const resumed=engine==='original-wasm';
const request=candidate?candidateRequest():resumed?resumeRequest():openRequest(engine),native=engine==='rust-native';
const wasmEngine=engine==='rust-wasm'||candidate?'rust':'original';
const corpus=readWca100(resolve(openRoot,'solver/testdata/benchmarks/wca-first1000.json'),1000);
const resource=read(resolve(openBase,request.label+'-resources.json'));
const exit=read(resolve(openDir,engine+'-exit.json'));
assert.equal(exit.exitCode,0);assert.equal(resource.stopped,'');assert.equal(resource.trigger,null);
assert.equal(resource.swapouts,16);assert.equal(resource.pressure,1);assert(resource.minimumHeadroom>=2*2**30);
assert(resource.peakRss>0&&resource.peakRss<=resource.rssLimit);assert.equal(resource.openBenchmarkReceipt.engine,candidate?'rust-wasm':engine);
const rawPath=native?resolve(openDir,'rust-native.jsonl'):resolve(request.args.at(-1)!,wasmEngine,'results.jsonl');
const rows=lines(rawPath);assert.equal(rows.length,1000);
const reference=lines(resolve(openBase,'wca1000-mt16-rust-native-opt9-exp-fixed.jsonl'));assert.equal(reference.length,1000);
const {cube3x3x3}=await import(pathToFileURL(resolve(openRoot,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
const puzzle=await cube3x3x3.kpuzzle();
for(let i=0;i<1000;i++) {
  const row=rows[i],item=corpus.cases[i];assert.equal(row.id,item.id);assert.equal(reference[i].id,item.id);
  assert.equal(row.threads,16);assert.equal(row.length,reference[i].length);assert(Number.isFinite(row.seconds)&&row.seconds>=0);
  verify(puzzle,item,row);
  if(native) {assert.equal(row.cancelled,false);assert.equal(row.completed_depth,row.length-1);assert.equal(row.batch_threads,1);assert.equal(row.contexts,8);}
}
let peakRssBytes:number,summary:any,continuation:any;
if(native) {
  const stderr=readFileSync(resolve(openDir,'rust-native.stderr.log'),'utf8');
  assert(!/terminated by signal|panicked|Error:/.test(stderr));
  const rss=stderr.match(/^\s*(\d+)\s+maximum resident set size\s*$/m);assert(rss);peakRssBytes=Number(rss[1]);
} else {
  const harness=read(resolve(request.args.at(-1)!,'report.json'));
  summary=harness.engines[wasmEngine];
  assert.equal(harness.compiler,'turbofan');assert.equal(summary.processExited,true);assert.equal(summary.verifiedSolutions,1000);
  assert.equal(harness.corpusSha256,corpus.corpusSha256);assert.equal(harness.threads,16);
  peakRssBytes=summary.peakRssBytes;
}
let processTreePeakRssBytes=resource.peakRss,minimumHeadroomBytes=resource.minimumHeadroom;
if(resumed) {
  const old=read(resolve(openBase,openRequest(engine).label+'-resources.json'));
  assert.equal(old.stopped,'Benchmark child exited with status 1');assert.equal(old.trigger.reason,old.stopped);
  assert.equal(old.boot,resource.boot);assert.equal(old.swapouts,16);assert.equal(old.pressure,1);
  assert(old.minimumHeadroom>=2*2**30&&old.peakRss<=old.rssLimit);
  const prefixBytes=readFileSync(resolve(openDir,'original-wasm-setupfix/original/results.jsonl'));
  assert.equal(prefixBytes.toString().trim().split('\n').length,431);
  assert(readFileSync(rawPath).subarray(0,prefixBytes.length).equals(prefixBytes),'Original prefix must be byte-for-byte identical');
  assert.equal(summary.resume.prefixSha256,createHash('sha256').update(prefixBytes).digest('hex'));
  const messages=lines(resolve(resumeOutput,'original/raw.jsonl'));
  const solved=messages.filter((m:any)=>m.type==='result');
  assert.equal(solved.length,569);solved.forEach((m:any,i:number)=>assert.equal(m.index,i+431));
  processTreePeakRssBytes=Math.max(old.peakRss,resource.peakRss);
  minimumHeadroomBytes=Math.min(old.minimumHeadroom,resource.minimumHeadroom);
  peakRssBytes=Math.max(old.peakRss,peakRssBytes);
  continuation={...summary.resume,peakRssMethod:'Conservative upper bound: max(first segment process-tree peak, continuation solver peak)',
    upstreamWasmUnchanged:true,priorResourceSha256:createHash('sha256').update(readFileSync(resolve(openBase,openRequest(engine).label+'-resources.json'))).digest('hex')};
}
const quarterRemoved=candidate?rows.reduce((sum,r)=>sum+r.search.depthResults.flat().reduce((s:number,d:any)=>s+d.quarterRemoved,0),0):null;
if(candidate) assert(Number.isSafeInteger(quarterRemoved)&&quarterRemoved>0,'The candidate must demonstrate real quarter rejection');
const report={schema:'cuberoot.open-benchmark-result.v1',engine,id:candidate?'rust-opt9-wasm-quarter':native?'rust-opt-9':engine==='rust-wasm'?'rust-opt9-wasm':'cube48opt-wasm',
  date:new Date().toISOString(),cases:1000,threads:16,passes:1,warmupCases:0,exitCode:0,
  verifiedSolutions:1000,optimalLengthsMatched:1000,seconds:rows.reduce((sum,r)=>sum+r.seconds,0),peakRssBytes,
  processTreePeakRssBytes,minimumHeadroomBytes,swapoutsDelta:0,...(continuation?{continuation}:{}),
  nodes:native?rows.reduce((sum,r)=>sum+r.nodes,0):null,...(candidate?{quarterRemoved,searchNodes:rows.reduce((s,r)=>s+r.search.nodes,0)}:{}),compiler:native?'native official fixed':'Node v24.21.0 · V8 TurboFan (--no-liftoff)',
  corpusSha256:corpus.corpusSha256,tableBytes:15_565_455_360,
  tableSha256:read(resolve(openBase,'opt9-generated/table.json')).tableSha256,
  rawSha256:createHash('sha256').update(readFileSync(rawPath)).digest('hex'),resource, ...(summary?{harnessSummary:summary}:{})};
writeFileSync(resolve(openDir,engine+'-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({engine,seconds:report.seconds,peakRssBytes,verified:1000,treePeakRss:resource.peakRss}));
