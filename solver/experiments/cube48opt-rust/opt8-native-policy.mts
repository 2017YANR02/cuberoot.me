/** One guarded Opt8 WCA100 candidate; prior results and protection stops stay immutable. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
export const nxRoot = resolve(here, '../../..');
export const nxDir = resolve(nxRoot, '.tmp/cubeopt-reverse/opt8-native-quarter-cpu-wca100-4-20261015');
export const nxReview = resolve(nxDir, 'session.json');
export const nxStop = resolve(nxRoot, '.tmp/cubeopt-reverse/opt8-native-6ps-20261015-stop.json');
export const nxLabel = 'opt8-native-quarter-cpu-wca100-4-20261015';
export const nxBinary = resolve(nxRoot,'.tmp/cubeopt-reverse/opt8-native-quarter-cpu-source-20261015/target/release/cube48opt-research');
export const nxTableBytes = 7782727680;
export const nxBoot = '{ sec = 1791771877, usec = 170806 } Sun Oct 11 19:24:37 2026';
export const nxHash = (p: string) => {assert(statSync(p).size < 64*2**20); return createHash('sha256').update(readFileSync(p)).digest('hex');};
const table=resolve(nxRoot,'.tmp/cubeopt-reverse/opt8-generated/h48prun31h8.dat');
const small=resolve(nxRoot,'.tmp/cubeopt-reverse/opt9-generated/small-memory.bin');
export function nxRequest() {return {label:nxLabel, executable:nxBinary,
  args:['solve',small,table,'8','20','0'], env:{CUBEOPT_OPT8_NATIVE_REVIEW:nxReview,CUBEOPT_VARIANT:'8',CUBEOPT_BACKEND:'opt',CUBEOPT_SEARCH_THREADS:'4',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_MEASURE_RSS:'1'}};}
export function nxPolicy(request: {label:string;executable:string;args:string[];env:NodeJS.ProcessEnv}) {
  const expected=nxRequest();
  assert.equal(request.label,expected.label);assert.equal(request.executable,expected.executable);assert.deepEqual(request.args,expected.args);
  assert.deepEqual(Object.fromEntries(Object.entries(request.env).filter(([k])=>k.startsWith('CUBEOPT_'))),expected.env);
  return {entry:'native',mode:'existing-table-single-pass',backend:'opt',variant:8,h:null,tablePath:null,
    tableBytes:nxTableBytes,measureNativeRss:true,rssLimit:nxTableBytes+2*2**30,deadlineMs:0,
    openBenchmark:true,opt8NativeBenchmark:true,scopeStopPath:nxStop,wasmThreads:4};
}
export function validateNxReview(request: Parameters<typeof nxPolicy>[0], current:{boot:string;swapouts:number;pressure:number;available:number}) {
  const policy=nxPolicy(request), review=JSON.parse(readFileSync(nxReview,'utf8'));
  assert.equal(review.schema,'cuberoot.nxopt-review.v1');assert.equal(review.boot,nxBoot);assert.equal(review.swapouts,48);
  assert.equal(current.boot,review.boot);assert.equal(current.swapouts,48);assert.equal(current.pressure,1);
  assert(current.available>=policy.rssLimit+3*2**30,'Insufficient Opt8 startup memory');
  assert(!existsSync(nxStop),'This Opt8 candidate round stopped; no automatic restart');
  for(const [p,sha] of Object.entries(review.artifacts)) assert.equal(nxHash(p),sha,`Changed artifact: ${p}`);
  for(const [p,sha] of Object.entries(review.history)) assert.equal(nxHash(p),sha,`Changed prior protection record: ${p}`);
  assert.equal(statSync(table).size,nxTableBytes);
  const receiptPath=resolve(nxDir,'receipt.json');assert(!existsSync(receiptPath),'nxopt run already consumed');
  for(const file of ['raw.log','results.jsonl','timing.json']) assert(!existsSync(resolve(nxDir,file)),`Existing nxopt output: ${file}`);
  assert(!existsSync(resolve(nxRoot,'.tmp/cubeopt-reverse',nxLabel+'-resources.json')));
  return {receiptPath,input:Buffer.from(JSON.parse(readFileSync(resolve(nxRoot,'solver/testdata/benchmarks/wca-first100.json'),'utf8')).cases.map((c:any)=>`${c.id}\t${c.scramble}\n`).join('')),receipt:{schema:'cuberoot.nxopt-receipt.v1',reviewSha256:nxHash(nxReview),before:current,
    request:nxRequest(),consumedAt:new Date().toISOString()}};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  assert.equal(process.argv[2],'prepare');
  const artifacts=[nxBinary,small,...['opt8-native-policy.mts','guard.mts'].map(f=>resolve(here,f)),resolve(nxRoot,'solver/testdata/benchmarks/wca-first100.json')];
  assert.equal(nxHash(nxBinary),'c2afd52e4ea2206d6661bbaf56823304b4f5e45515f85dc3616d310def7eff2f');
  const history=['resource-baseline.json','opt10-resource-review-stop.json','wasm-opt8-opt9-20261015/stop.json','wasm-browser-20261015/stop.json',
    'opt8-native-quarter-wca100-4-20261015/report.json','opt8-native-quarter-wca100-4-20261015-resources.json',
    'opt8-native-specialized-wca100-4-20261015/report.json','opt8-native-specialized-wca100-4-20261015-resources.json',
    'opt8-native-search-wca100-4-20261015/report.json','opt8-native-search-wca100-4-20261015-resources.json',
    'opt8-native-batch-wca100-4-20261015/report.json','opt8-native-batch-wca100-4-20261015-resources.json',
    'opt8-native-native-cpu-wca100-4-20261015/report.json','opt8-native-native-cpu-wca100-4-20261015-resources.json'].map(f=>resolve(nxRoot,'.tmp/cubeopt-reverse',f));
  writeFileSync(nxReview,JSON.stringify({schema:'cuberoot.nxopt-review.v1',authorization:'按维护者要求复用现有表，WCA100、4线程、单轮不预热',
    boot:nxBoot,swapouts:48,preparedAt:new Date().toISOString(),request:nxRequest(),
    artifacts:Object.fromEntries(artifacts.map(p=>[p,nxHash(p)])),history:Object.fromEntries(history.map(p=>[p,nxHash(p)]))},null,2)+'\n',{flag:'wx'});
}
