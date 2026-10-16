/** One explicitly authorized suffix continuation; never resets the swap baseline. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRequest, openPolicy, openBase, openDir, openHere, openRoot } from './open-benchmark-policy.mts';
import { readWca100 } from './wasm-benchmark.mjs';

export const resumeReviewPath=resolve(openDir,'session-original-resume431.json');
export const resumeStopPath=resolve(openDir,'stop-original-resume431.json');
export const resumeOutput=resolve(openDir,'original-wasm-resume431');
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const prefix=resolve(openDir,'original-wasm-setupfix/original/results.jsonl');
const evidence=[prefix,...['session.json','session-setupfix.json','session-rust-wasm.json','stop.json','stop-setupfix.json',
  'original-wasm-partial-report.json','rust-native-report.json','rust-wasm-report.json','original-wasm-setupfix/input.json'].map(p=>resolve(openDir,p)),
  ...['resource-baseline.json','resource-review-stop.json','opt10-resource-review-stop.json','multithread-resource-review-stop.json',
  'opt10-official-stop.json','double-zbll-opt10-session-resources.json','open16-wca1000-original-wasm-20261015-setupfix-resources.json'].map(p=>resolve(openBase,p)),
  resolve(openRoot,'.tmp/h48-corners-research/resource-baseline.json')];
const sources=['guard.mts','wasm-benchmark.mjs','original-wasm-compat.mjs','original-resume-policy.mts','open-benchmark-policy.mts'].map(p=>resolve(openHere,p));
const hashes=(paths:string[])=>Object.fromEntries(paths.filter(existsSync).map(p=>[p,sha(p)]));
export function resumeRequest() {
  const original=openRequest('original-wasm');
  return {...original,label:'open16-wca1000-original-wasm-resume431-20261015',
    env:{CUBEOPT_ORIGINAL_RESUME_REVIEW:resumeReviewPath,CUBEOPT_BACKEND:'opt',CUBEOPT_VARIANT:'9',CUBEOPT_SOLVE_THREADS:'1'},
    args:[...original.args.slice(0,-2),'--resume-from',resolve(openDir,'original-wasm-setupfix'),'--out',resumeOutput]};
}
export function resumePolicy(request:any) {
  const expected=resumeRequest();
  assert.equal(request.label,expected.label); assert.equal(request.executable,expected.executable);
  assert.deepEqual(request.args,expected.args);
  assert.deepEqual(Object.fromEntries(Object.entries(request.env).filter(([k])=>k.startsWith('CUBEOPT_'))),expected.env);
  return {...openPolicy(openRequest('original-wasm')),originalResume:true};
}
export function validateResumeReview(request:any,current:any) {
  const policy=resumePolicy(request), review=read(resumeReviewPath);
  assert.equal(review.authorization,'把原版 WASM 的 unwind 问题修好，接着把剩下的跑完，前面 431 条不要重跑');
  assert.equal(review.boot,'{ sec = 1791771877, usec = 170806 } Sun Oct 11 19:24:37 2026');
  assert.equal(review.swapouts,16); assert.equal(current.boot,review.boot); assert.equal(current.swapouts,16);
  assert.equal(current.pressure,1); assert(current.available>=policy.rssLimit+3*2**30);
  assert(Date.now()<Date.parse('2026-10-17T00:00:00Z'));
  assert.deepEqual(review.evidence,hashes(evidence)); assert.deepEqual(review.sources,hashes(sources));
  assert.deepEqual(review.request,resumeRequest());
  const receiptPath=resolve(openDir,'original-resume431-receipt.json');
  assert(!existsSync(receiptPath)&&!existsSync(resumeStopPath)&&!existsSync(resumeOutput));
  assert(!existsSync(resolve(openBase,request.label+'-resources.json')));
  const previous=read(resolve(openBase,'open16-wca1000-original-wasm-20261015-setupfix-resources.json'));
  assert.equal(previous.stopped,'Benchmark child exited with status 1'); assert.equal(previous.trigger.reason,previous.stopped);
  assert.equal(previous.boot,review.boot); assert.equal(previous.swapouts,16); assert.equal(previous.pressure,1);
  assert(previous.minimumHeadroom>=2*2**30&&previous.peakRss<=previous.rssLimit);
  const partial=read(resolve(openDir,'original-wasm-partial-report.json'));
  assert.equal(partial.verifiedSolutions,431); assert.equal(partial.optimalLengthsMatched,431);
  assert.equal(partial.resourceSha256,sha(resolve(openBase,'open16-wca1000-original-wasm-20261015-setupfix-resources.json')));
  const corpus=readWca100(resolve(openRoot,'solver/testdata/benchmarks/wca-first1000.json'),1000);
  const rows=readFileSync(prefix,'utf8').trim().split('\n').map(s=>JSON.parse(s));assert.equal(rows.length,431);
  rows.forEach((r,i)=>{assert.equal(r.index,i);assert.equal(r.id,corpus.cases[i].id);assert.equal(r.verified,true);assert.equal(r.threads,16);});
  assert.equal(statSync(resolve(openBase,'opt9-generated/h48prun31h9.dat')).size,15_565_455_360);
  return {receiptPath,input:Buffer.alloc(0),receipt:{schema:'cuberoot.original-resume.v1',engine:'original-wasm',
    label:request.label,reviewSha256:sha(resumeReviewPath),before:current,completedCases:431,remainingCases:569,consumedAt:new Date().toISOString()}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  assert.equal(process.argv[2],'prepare');
  const previous=read(resolve(openDir,'session-rust-wasm.json'));
  writeFileSync(resumeReviewPath,JSON.stringify({authorization:'把原版 WASM 的 unwind 问题修好，接着把剩下的跑完，前面 431 条不要重跑',
    boot:previous.boot,swapouts:previous.swapouts,evidence:hashes(evidence),sources:hashes(sources),request:resumeRequest()},null,2)+'\n',{flag:'wx'});
  console.log(resumeReviewPath);
}
