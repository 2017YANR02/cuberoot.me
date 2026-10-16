/** Explicit user-reviewed, single-use comparison after the previous swap stop.
 * Keeps the original baseline and all stop records immutable. Never resumes ZBLL.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWca100, parseWasmBenchmarkArguments, wasmBuildContract } from './wasm-benchmark.mjs';
import { verifyOpt9Release } from './opt9-release.mts';

export const openHere=dirname(fileURLToPath(import.meta.url)), openRoot=resolve(openHere,'../../..');
export const openBase=resolve(openRoot,'.tmp/cubeopt-reverse'), openDir=resolve(openBase,'open-benchmark-20261015');
export const openReviewPath=resolve(openDir,'session-rust-wasm.json'), openStopPath=resolve(openDir,'stop-rust-wasm.json');
export const openEngines=['rust-native','original-wasm','rust-wasm'] as const;
const corpusPath=resolve(openRoot,'solver/testdata/benchmarks/wca-first1000.json');
const native=resolve(openHere,'target/opt9-official/release/cube48opt-research');
const wasm=resolve(openBase,'rust-wasm-shared-builds/build-Nv4Vc5/cube48opt-rust8.wasm');
const table=resolve(openBase,'opt9-generated/h48prun31h9.dat'), small=resolve(openBase,'opt9-generated/small-memory.bin');
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const read=(path:string)=>{assert(statSync(path).isFile()&&statSync(path).size<8*2**20);return readFileSync(path);};
const historyPaths=[resolve(openRoot,'.tmp/h48-corners-research/resource-baseline.json'),
  ...['resource-baseline.json','resource-review-stop.json','opt10-resource-review-stop.json',
    'multithread-resource-review-stop.json','opt10-official-stop.json','double-zbll-opt10-session-resources.json'].map(p=>resolve(openBase,p))];
const artifactPaths=[native,wasm,resolve(dirname(wasm),'build-metadata.json'),small,
  resolve(dirname(table),'table.json'),corpusPath,resolve(openHere,'guard.mts'),fileURLToPath(import.meta.url),
  resolve(openHere,'wasm-benchmark.mjs'),resolve(openRoot,'core/packages/client/public/cubeopt/cube48opt9.wasm'),
  resolve(openRoot,'core/packages/client/public/cubeopt/cube48opt9.mjs')];
const hashes=(paths:string[])=>Object.fromEntries(paths.filter(existsSync).map(p=>[p,sha(read(p))]));
export function openRequest(engine:string) {
  assert(openEngines.includes(engine as any));
  const label=`open16-wca1000-${engine}-20261015${engine==='original-wasm'?'-setupfix':''}`;
  const env:NodeJS.ProcessEnv={CUBEOPT_OPEN_BENCHMARK_REVIEW:openReviewPath,CUBEOPT_BACKEND:'opt',CUBEOPT_VARIANT:'9',CUBEOPT_SOLVE_THREADS:'1'};
  if(engine==='rust-native') Object.assign(env,{CUBEOPT_SEARCH_THREADS:'16',CUBEOPT_MEASURE_RSS:'1'});
  return {label,engine,env,executable:engine==='rust-native'?native:process.execPath,
    args:engine==='rust-native'?['solve',small,table,'8','20','0']:
      [resolve(openHere,'wasm-benchmark.mjs'),'--variant','9','--threads','16','--cases','1000',
        '--engine',engine==='rust-wasm'?'rust':'original','--compiler','turbofan','--table',table,'--small',small,
        '--wasm',wasm,'--out',resolve(openDir,engine==='original-wasm'?engine+'-setupfix':engine)]};
}
export function openPolicy(request:{label:string;executable:string;args:string[];env:NodeJS.ProcessEnv}) {
  const expected=openEngines.map(openRequest).find(r=>r.label===request.label);assert(expected,'Unknown comparison run');
  assert.equal(request.executable,expected.executable);assert.deepEqual(request.args,expected.args);
  assert.deepEqual(Object.fromEntries(Object.entries(request.env).filter(([k])=>k.startsWith('CUBEOPT_'))),expected.env);
  assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');assert(availableParallelism()>=16);
  const isNative=expected.engine==='rust-native';
  // Same per-runtime budget as multithread-policy.mts, including worker reserves.
  const rssLimit=15_565_455_360+2**30+(isNative?16*16*2**20:Math.ceil(15_565_455_360/16)+19_208_560+16*128*2**20);
  return {entry:isNative?'native':'wasm-benchmark.mjs',mode:isNative?'solve':'single-pass',backend:'opt',variant:9,h:null,
    tablePath:null,tableBytes:15_565_455_360,measureNativeRss:isNative,rssLimit,deadlineMs:60*60_000,
    ...(!isNative?{wasmThreads:16}:{}),openBenchmark:true};
}
export function validateOpenReview(request:any,current:any) {
  const policy=openPolicy(request);
  const reviewBytes=read(openReviewPath),review=JSON.parse(reviewBytes.toString());
  assert.equal(review.schema,'cuberoot.open-benchmark-review.v1');
  assert.equal(review.authorization,'允许本轮建立新基线，继续测试');
  assert.equal(review.boot,'{ sec = 1791771877, usec = 170806 } Sun Oct 11 19:24:37 2026');
  assert.equal(review.swapouts,16);assert.equal(current.boot,review.boot);assert.equal(current.swapouts,review.swapouts);
  assert(Date.now()<Date.parse('2026-10-17T00:00:00Z'),'Review expired');
  assert.equal(current.pressure,1);assert(current.available>=policy.rssLimit+3*2**30,'Insufficient memory');
  assert(!existsSync(openStopPath),'This comparison stopped; do not restart');
  // Only the recorded pre-spawn configuration assertion may be repaired. This
  // never permits another solve pass, resource-stop reset or changed swap count.
  const oldStop=resolve(openDir,'stop.json'), oldResources=resolve(openBase,'open16-wca1000-original-wasm-20261015-resources.json');
  assert.equal(review.setupFailure.stopSha256,sha(read(oldStop)));
  assert.equal(review.setupFailure.resourcesSha256,sha(read(oldResources)));
  const failed=JSON.parse(read(oldResources).toString());
  assert.equal(failed.stopped,'Benchmark child exited with status 1');assert.equal(failed.swapouts,16);
  assert.equal(failed.pressure,1);assert(failed.peakRss<2**30);
  assert(!existsSync(resolve(openDir,'original-wasm/original')),'WASM child must never have started');
  const failureLog=read(resolve(openDir,'original-wasm.stderr.log'));
  assert.equal(review.setupFailure.stderrSha256,sha(failureLog));
  assert(failureLog.toString().includes("sessionInput.variant === 8 && sessionInput.threads === 4"));
  const originalFailure=JSON.parse(read(resolve(openDir,'original-wasm-partial-report.json')).toString());
  assert.equal(originalFailure.exitCode,1);assert.equal(originalFailure.verifiedSolutions,431);
  assert.equal(review.originalFailureSha256,sha(read(resolve(openDir,'original-wasm-partial-report.json'))));
  assert.equal(review.originalStopSha256,sha(read(resolve(openDir,'stop-setupfix.json'))));
  assert.deepEqual(review.history,hashes(historyPaths),'Previous resource evidence changed');
  assert(review.history[resolve(openBase,'resource-baseline.json')]&&review.history[resolve(openBase,'opt10-resource-review-stop.json')]);
  assert.deepEqual(review.artifacts,hashes(artifactPaths),'Reviewed artifacts changed');
  assert.equal(review.artifacts[native],'3314f88daaf8be5423ae862e359c98fc741a0f9ea8bbd9695f45fd474eb857a9');
  assert.equal(review.artifacts[wasm],'007e6a2076d64f998ad26518cc8b2633fb55d4dbb4374db40109b9688ac1aeee');
  assert.deepEqual(review.requests,openEngines.map(openRequest));
  assert.equal(statSync(table).size,15_565_455_360);assert.equal(statSync(small).size,818_008);
  const corpus=readWca100(corpusPath,1000);
  const expected=openEngines.map(openRequest).find(r=>r.label===request.label)!;
  const receiptPath=resolve(openDir,expected.engine+(expected.engine==='original-wasm'?'-setupfix':'')+'-receipt.json');
  assert(!existsSync(receiptPath)&&!existsSync(resolve(openBase,request.label+'-resources.json')),'Run already started');
  if(expected.engine!=='rust-native') assert(!existsSync(expected.args.at(-1)!), 'WASM output already exists');
  if(expected.engine!=='rust-native') wasmBuildContract(parseWasmBenchmarkArguments(expected.args.slice(1)),JSON.parse(read(resolve(dirname(wasm),'build-metadata.json')).toString()));
  for(const prior of openEngines.slice(0,openEngines.indexOf(expected.engine as any))) {
    const report=JSON.parse(read(resolve(openDir,prior+(prior==='original-wasm'?'-partial-report.json':'-report.json'))).toString());
    const resources=JSON.parse(read(resolve(openBase,openRequest(prior).label+'-resources.json')).toString());
    if(prior==='original-wasm') {
      assert.equal(report.verifiedSolutions,431);assert.equal(report.optimalLengthsMatched,431);assert.equal(report.exitCode,1);
      assert.equal(report.resourceSha256,sha(read(resolve(openBase,openRequest(prior).label+'-resources.json'))));
      assert.equal(resources.stopped,'Benchmark child exited with status 1');
      assert.equal(resources.trigger.reason,resources.stopped);assert.equal(resources.pressure,1);
      assert(resources.minimumHeadroom>=2*2**30&&resources.peakRss<=resources.rssLimit);
    } else {
      assert.equal(report.verifiedSolutions,1000);assert.equal(report.optimalLengthsMatched,1000);assert.equal(report.exitCode,0);
      assert.equal(resources.stopped,'');assert.equal(resources.trigger,null);
    }
    assert.equal(resources.swapouts,review.swapouts);assert.equal(resources.boot,review.boot);
  }
  return {receiptPath,input:Buffer.from(corpus.cases.map((c:any)=>`${c.id}\t${c.scramble}\n`).join('')),
    receipt:{schema:'cuberoot.open-benchmark-consumption.v1',label:request.label,engine:expected.engine,
      reviewSha256:sha(reviewBytes),before:current,consumedAt:new Date().toISOString()}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  assert.equal(process.argv[2],'continue-rust');verifyOpt9Release();
  const boot=execFileSync('/usr/sbin/sysctl',['-n','kern.boottime'],{encoding:'utf8'}).trim();
  const vm=execFileSync('/usr/bin/vm_stat',[],{encoding:'utf8'});
  const swapouts=Number(vm.match(/Swapouts:\s+(\d+)/)?.[1]);assert.equal(swapouts,16);
  mkdirSync(openDir,{recursive:true});
  const review={schema:'cuberoot.open-benchmark-review.v1',authorization:'允许本轮建立新基线，继续测试',
    reviewedAt:new Date().toISOString(),boot,swapouts,history:hashes(historyPaths),artifacts:hashes(artifactPaths),requests:openEngines.map(openRequest),
    priorReviewSha256:sha(read(resolve(openDir,'session-setupfix.json'))),
    originalFailureSha256:sha(read(resolve(openDir,'original-wasm-partial-report.json'))),
    originalStopSha256:sha(read(resolve(openDir,'stop-setupfix.json'))),
    setupFailure:{stopSha256:sha(read(resolve(openDir,'stop.json'))),
      resourcesSha256:sha(read(resolve(openBase,'open16-wca1000-original-wasm-20261015-resources.json'))),
      stderrSha256:sha(read(resolve(openDir,'original-wasm.stderr.log')))}};
  writeFileSync(openReviewPath,JSON.stringify(review,null,2)+'\n',{flag:'wx'});
  console.log(openReviewPath);
}
