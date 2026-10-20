/** One user-authorized nxopt22 generation + WCA1000 run, independent of stopped WASM runs. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
export const nxRoot = resolve(here, '../../..');
export const nxDir = resolve(nxRoot, '.tmp/cubeopt-reverse/nxopt22-wca100-4-20261015');
export const nxReview = resolve(nxDir, 'session.json');
export const nxStop = resolve(nxDir, 'stop.json');
export const nxLabel = 'nxopt22-wca100-4-20261015';
export const nxBinary = '/Users/eula/Developer/cube20src/nxopt22';
export const nxTableBytes = 9930 * (512 * 24 * 256 / 4) + 4;
export const nxBoot = '{ sec = 1791771877, usec = 170806 } Sun Oct 11 19:24:37 2026';
export const nxHash = (p: string) => {assert(statSync(p).size < 64*2**20); return createHash('sha256').update(readFileSync(p)).digest('hex');};
export function nxRequest() {return {label:nxLabel, executable:process.execPath,
  args:[resolve(here,'nxopt-benchmark.mjs')], env:{CUBEOPT_NXOPT_REVIEW:nxReview}};}
export function nxPolicy(request: {label:string;executable:string;args:string[];env:NodeJS.ProcessEnv}) {
  const expected=nxRequest();
  assert.equal(request.label,expected.label);assert.equal(request.executable,expected.executable);assert.deepEqual(request.args,expected.args);
  assert.deepEqual(Object.fromEntries(Object.entries(request.env).filter(([k])=>k.startsWith('CUBEOPT_'))),expected.env);
  return {entry:'nxopt-benchmark.mjs',mode:'existing-table-single-pass',backend:'nxopt',variant:22,h:null,tablePath:null,
    tableBytes:nxTableBytes,measureNativeRss:false,rssLimit:nxTableBytes+2*2**30,deadlineMs:0,
    openBenchmark:true,nxoptBenchmark:true,scopeStopPath:nxStop,wasmThreads:4};
}
export function validateNxReview(request: Parameters<typeof nxPolicy>[0], current:{boot:string;swapouts:number;pressure:number;available:number}) {
  const policy=nxPolicy(request), review=JSON.parse(readFileSync(nxReview,'utf8'));
  assert.equal(review.schema,'cuberoot.nxopt-review.v1');assert.equal(review.boot,nxBoot);assert.equal(review.swapouts,48);
  assert.equal(current.boot,review.boot);assert.equal(current.swapouts,48);assert.equal(current.pressure,1);
  assert(current.available>=policy.rssLimit+3*2**30,'Insufficient nxopt startup memory');
  assert(!existsSync(nxStop),'This nxopt run stopped; no automatic restart');
  for(const [p,sha] of Object.entries(review.artifacts)) assert.equal(nxHash(p),sha,`Changed artifact: ${p}`);
  for(const [p,sha] of Object.entries(review.history)) assert.equal(nxHash(p),sha,`Changed prior protection record: ${p}`);
  assert.equal(statSync(resolve(nxDir,'nxopth22b.dat')).size,nxTableBytes);
  const receiptPath=resolve(nxDir,'receipt.json');assert(!existsSync(receiptPath),'nxopt run already consumed');
  for(const file of ['raw.log','results.jsonl','timing.json']) assert(!existsSync(resolve(nxDir,file)),`Existing nxopt output: ${file}`);
  assert(!existsSync(resolve(nxRoot,'.tmp/cubeopt-reverse',nxLabel+'-resources.json')));
  return {receiptPath,input:undefined,receipt:{schema:'cuberoot.nxopt-receipt.v1',reviewSha256:nxHash(nxReview),before:current,
    request:nxRequest(),consumedAt:new Date().toISOString()}};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  assert.equal(process.argv[2],'prepare');
  const source='/Users/eula/Developer/cube20src';
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),'f430921a48306874864b9f2ac8a059b43492fd3a');
  const artifacts=[nxBinary,...['nxopt.w','cubepos.w','makefile-nxopt','nxopt.cpp','cubepos.cpp','cubepos.h'].map(f=>resolve(source,f)),
    ...['nxopt-policy.mts','nxopt-benchmark.mjs','guard.mts'].map(f=>resolve(here,f)),resolve(nxRoot,'solver/testdata/benchmarks/wca-first100.json')];
  const history=['resource-baseline.json','opt10-resource-review-stop.json','wasm-opt8-opt9-20261015/stop.json','wasm-browser-20261015/stop.json'].map(f=>resolve(nxRoot,'.tmp/cubeopt-reverse',f));
  writeFileSync(nxReview,JSON.stringify({schema:'cuberoot.nxopt-review.v1',authorization:'按维护者要求复用现有表，WCA100、4线程、单轮不预热',
    boot:nxBoot,swapouts:48,preparedAt:new Date().toISOString(),request:nxRequest(),
    artifacts:Object.fromEntries(artifacts.map(p=>[p,nxHash(p)])),history:Object.fromEntries(history.map(p=>[p,nxHash(p)]))},null,2)+'\n',{flag:'wx'});
}
