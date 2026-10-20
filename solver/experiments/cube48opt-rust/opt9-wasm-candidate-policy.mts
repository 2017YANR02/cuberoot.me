/** One fixed candidate, one pass; all predecessor results and swap evidence retained. */
import assert from 'node:assert/strict';
import { existsSync,readFileSync,writeFileSync,statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRequest,openPolicy,openBase,openDir,openHere } from './open-benchmark-policy.mts';
import { parseWasmBenchmarkArguments,wasmBuildContract } from './wasm-benchmark.mjs';
export const candidateReviewPath=resolve(openDir,'session-opt9-quarter-fixed.json');
export const candidateStopPath=resolve(openDir,'stop-opt9-quarter-fixed.json');
export const candidateOutput=resolve(openDir,'rust-wasm-opt9-quarter-fixed');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
export function candidateRequest(wasm=read(candidateReviewPath).wasm) {
  const original=openRequest('rust-wasm');const args=[...original.args];
  args[args.indexOf('--wasm')+1]=wasm;args[args.indexOf('--out')+1]=candidateOutput;
  return {...original,label:'open16-wca1000-opt9-quarter-fixed-20261015',
    env:{CUBEOPT_WASM_CANDIDATE_REVIEW:candidateReviewPath,CUBEOPT_BACKEND:'opt',CUBEOPT_VARIANT:'9',CUBEOPT_SOLVE_THREADS:'1'},args};
}
export function candidatePolicy(request:any) {
  const wasm=request.args[request.args.indexOf('--wasm')+1];
  assert(typeof wasm==='string'&&wasm.startsWith(resolve(openBase,'rust-wasm-shared-builds')+'/build-'));
  const expected=candidateRequest(wasm);assert.equal(request.label,expected.label);
  assert.equal(request.executable,expected.executable);assert.deepEqual(request.args,expected.args);
  assert.deepEqual(Object.fromEntries(Object.entries(request.env).filter(([k])=>k.startsWith('CUBEOPT_'))),expected.env);
  return {...openPolicy(openRequest('rust-wasm')),wasmCandidate:true};
}
const sources=['guard.mts','wasm-benchmark.mjs','opt9-wasm-candidate-policy.mts','open-benchmark-policy.mts'].map(p=>resolve(openHere,p));
function historyPaths() {
  const prior=read(resolve(openDir,'session-original-resume431.json'));
  return [...new Set([...Object.keys(prior.evidence),...['original-wasm-report.json','rust-wasm-report.json','rust-native-report.json',
    'session-original-resume431.json','original-resume431-receipt.json','original-wasm-resume431/original/results.jsonl',
    'original-wasm-resume431/input.json','rust-wasm/rust/results.jsonl','rust-wasm/input.json'].map(p=>resolve(openDir,p)),
    ...['open16-wca1000-original-wasm-resume431-20261015-resources.json','open16-wca1000-rust-wasm-20261015-resources.json'].map(p=>resolve(openBase,p))])];
}
const hashes=(paths:string[])=>Object.fromEntries(paths.map(p=>[p,sha(p)]));
export function validateCandidateReview(request:any,current:any) {
  const policy=candidatePolicy(request),review=read(candidateReviewPath);assert.deepEqual(request.args,candidateRequest().args);
  assert.equal(review.authorization,'补齐 Rust Opt9 WASM，保留原版和旧版，1000 条16线程一轮不预热，原版不重跑');
  assert.equal(review.boot,'{ sec = 1791771877, usec = 170806 } Sun Oct 11 19:24:37 2026');
  assert.equal(review.swapouts,16);assert.equal(current.boot,review.boot);assert.equal(current.swapouts,16);
  assert.equal(current.pressure,1);assert(current.available>=policy.rssLimit+3*2**30);
  assert(Date.now()<Date.parse('2026-10-17T00:00:00Z'));
  assert.deepEqual(review.history,hashes(historyPaths()));assert.deepEqual(review.sources,hashes(sources));
  const build=read(resolve(dirname(review.wasm),'build-metadata.json'));
  assert.equal(build.candidate,'opt9-quarter-fixed');assert.equal(build.wasmSha256,sha(review.wasm));
  assert.equal(review.buildSha256,sha(resolve(dirname(review.wasm),'build-metadata.json')));
  assert.deepEqual(build.command.args.slice(-2),['--features','opt9-quarter-fixed']);
  wasmBuildContract(parseWasmBenchmarkArguments(request.args.slice(1)),build);
  const resources=read(resolve(openBase,'open16-wca1000-original-wasm-resume431-20261015-resources.json'));
  assert.equal(resources.stopped,'');assert.equal(resources.trigger,null);assert.equal(resources.swapouts,16);
  assert.equal(resources.boot,current.boot);assert(resources.minimumHeadroom>=2*2**30);
  for(const engine of ['original-wasm','rust-wasm','rust-native']) {
    const r=read(resolve(openDir,engine+'-report.json'));assert.equal(r.exitCode,0);
    assert.equal(r.verifiedSolutions,1000);assert.equal(r.optimalLengthsMatched,1000);
  }
  assert.equal(statSync(resolve(openBase,'opt9-generated/h48prun31h9.dat')).size,15_565_455_360);
  const receiptPath=resolve(openDir,'opt9-quarter-fixed-receipt.json');
  assert(!existsSync(receiptPath)&&!existsSync(candidateStopPath)&&!existsSync(candidateOutput));
  assert(!existsSync(resolve(openBase,request.label+'-resources.json')));
  return {receiptPath,input:Buffer.alloc(0),receipt:{schema:'cuberoot.opt9-wasm-candidate.v1',engine:'rust-wasm',candidate:'opt9-quarter-fixed',
    label:request.label,reviewSha256:sha(candidateReviewPath),before:current,consumedAt:new Date().toISOString()}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  assert.equal(process.argv[2],'prepare');const wasm=resolve(process.argv[3]);const prior=read(resolve(openDir,'session-original-resume431.json'));
  const build=read(resolve(dirname(wasm),'build-metadata.json'));assert.equal(build.candidate,'opt9-quarter-fixed');
  writeFileSync(candidateReviewPath,JSON.stringify({authorization:'补齐 Rust Opt9 WASM，保留原版和旧版，1000 条16线程一轮不预热，原版不重跑',
    boot:prior.boot,swapouts:prior.swapouts,wasm,buildSha256:sha(resolve(dirname(wasm),'build-metadata.json')),
    history:hashes(historyPaths()),sources:hashes(sources),request:candidateRequest(wasm)},null,2)+'\n',{flag:'wx'});
  console.log(candidateReviewPath);
}
