// Fixed local comparison of the retained production binary and one candidate.
// Metadata only; the existing guard owns all execution and memory protection.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOfficialHistory, officialHasStop } from './opt10-official-policy.mts';
import { parseWasmBenchmarkArguments, readWca100, wasmBuildContract } from './wasm-benchmark.mjs';

const HERE=dirname(fileURLToPath(import.meta.url)), ROOT=resolve(HERE,'../../..');
const BASE=resolve(ROOT,'.tmp/cubeopt-reverse');
export const localOpt8Scope='mac4-wca100-opt8-rust-candidates';
const builds={
  release4:['build-FcRcSF','b600c699ab91c29f0bef5a14b7c2871bf1fb03d840b8813d5656266132433bb6'],
  baseline:['build-Ifxgw4','cc24da6f19f42fd90163c3ab77594c4ea085f32c98803653b61a0413b3b7a6dc'],
  quarter:['build-Nv4Vc5','007e6a2076d64f998ad26518cc8b2633fb55d4dbb4374db40109b9688ac1aeee'],
} as const;
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function record(path:string) {
  assert(statSync(path).size<4*2**20,'Evidence must be bounded');
  const bytes=readFileSync(path);return {sha256:sha(bytes),value:JSON.parse(bytes.toString())};
}
function history() {
  return Object.fromEntries(Object.entries({baseline:'resource-baseline.json',stopped:'opt10-generate-v1-resources.json',
    programStop:'multithread-resource-review-stop.json',programResources:'wca1000-mt16-rust-wasm-opt9-resources.json',
    priorResources:'wca1000-mt16-rust-native-opt10-exp-coset-resources.json'}).map(([key,name])=>[key,record(resolve(BASE,name))]));
}
export function localOpt8Request(stage:string) {
  assert(stage==='baseline'||stage==='quarter'||stage==='release4');
  const [build]=builds[stage];
  const label=`wca100-local4-opt8-${stage}-turbofan-20261014`;
  const args=[resolve(HERE,'wasm-benchmark.mjs'),'--variant','8','--threads','4','--engine','rust','--compiler','turbofan',
    '--table',resolve(BASE,'opt8-generated/h48prun31h8.dat'),
    '--small',resolve(BASE,'opt8-generated/small-memory.bin'),
    '--wasm',resolve(BASE,'rust-wasm-shared-builds',build,'cube48opt-rust8.wasm'),
    '--out',resolve(BASE,label)];
  return {label,executable:process.execPath,args};
}
export function validateLocalOpt8Review(review:any,request:any,current:any,used:boolean) {
  assert.equal(process.platform,'darwin');
  assert(!used&&!officialHasStop(),'Consumed run or a later resource/program stop; do not restart');
  const expected=localOpt8Request(review.stage);
  assert.deepEqual({label:request.label,executable:request.executable,args:request.args},expected);
  assert.equal(review.schema,'cuberoot.opt8-local-review.v1');assert.equal(review.scope,localOpt8Scope);
  assert.equal(review.commandSha256,sha(Buffer.from(JSON.stringify([expected.executable,...expected.args]))));
  assert.equal(review.stoppedLabel,'opt10-generate-v1');
  assert(Number.isFinite(Date.parse(review.reviewedAt))&&review.reason.length>20);
  const evidence=history();validateOfficialHistory(review,evidence,current);
  const prior=evidence.priorResources.value;
  assert.equal(prior.stopped,'');assert.equal(prior.trigger,null);
  assert(prior.minimumHeadroom>=2*2**30&&prior.peakRss<=prior.rssLimit);
  // Reviewed repair of a zero-case runtime failure, not a reset/retry of results.
  const failed=record(resolve(BASE,'wca100-local4-opt8-baseline-20261014-resources.json'));
  assert.equal(review.failedLocalSha256,failed.sha256);
  assert.equal(failed.value.stopped,'Local Opt8 child exited with status 1');
  assert.equal(failed.value.boot,current.boot);assert.equal(failed.value.swapouts,current.swapouts);
  assert.equal(failed.value.trigger,null);assert.equal(failed.value.pressure,1);
  assert(failed.value.minimumHeadroom>=2*2**30&&failed.value.peakRss<=failed.value.rssLimit);
  assert.equal(readFileSync(resolve(BASE,'wca100-local4-opt8-baseline-20261014/rust/results.jsonl')).length,0);
  const config=parseWasmBenchmarkArguments(request.args.slice(1));
  assert.equal(readWca100().cases.length,100);
  assert.equal(statSync(config.table).size,7_782_727_680);
  const [,digest]=builds[review.stage as keyof typeof builds];
  assert.equal(sha(readFileSync(config.wasm)),digest);assert.equal(review.wasmSha256,digest);
  const build=record(resolve(dirname(config.wasm),'build-metadata.json'));
  wasmBuildContract(config,build.value);assert.equal(build.value.wasmSha256,digest);
  assert.equal(review.buildSha256,build.sha256);
  assert(!existsSync(config.out)&&!existsSync(resolve(BASE,request.label+'-resources.json')),'Run already started');
  if(review.stage!=='baseline') {
    const old=localOpt8Request('baseline');
    const r=record(resolve(BASE,old.label,'report.json')).value;
    const resource=record(resolve(BASE,old.label+'-resources.json')).value;
    assert.equal(r.engines.rust.processExited,true);assert.equal(r.compiler,'turbofan');assert.equal(resource.stopped,'');assert.equal(resource.trigger,null);
    assert.equal(resource.boot,current.boot);assert.equal(resource.swapouts,current.swapouts);
    assert.equal(r.threads,4);assert.equal(r.cases,100);assert.equal(r.measuredPasses,1);assert.equal(r.warmupCases,0);
    assert.equal(r.engines.rust.verifiedSolutions,100);assert.equal(r.engines.rust.optimalLengthsMatched,100);
    assert.equal(r.engines.rust.artifacts.sha256.wasm,builds.baseline[1]);
  }
  return {baselineSha256:evidence.baseline.sha256,commandSha256:review.commandSha256,wasmSha256:digest};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const stage=process.argv[2],request=localOpt8Request(stage),e=history();
  const config=parseWasmBenchmarkArguments(request.args.slice(1));
  const review={schema:'cuberoot.opt8-local-review.v1',scope:localOpt8Scope,stage,
    reason:'User explicitly requested local Opt8 optimization: current production binary and candidate, four threads, same WCA100, one pass each, no warmup. Preserve all stopped records and the original zero-Swapouts baseline.',
    failedLocalSha256:record(resolve(BASE,'wca100-local4-opt8-baseline-20261014-resources.json')).sha256,
    reviewedAt:new Date().toISOString(),stoppedLabel:'opt10-generate-v1',stoppedResourcesSha256:e.stopped.sha256,
    ...Object.fromEntries(Object.entries(e).map(([k,v])=>[k+'Sha256',v.sha256])),
    boot:e.baseline.value.boot,swapouts:e.baseline.value.swapouts,
    commandSha256:sha(Buffer.from(JSON.stringify([request.executable,...request.args]))),
    wasmSha256:sha(readFileSync(config.wasm)),buildSha256:record(resolve(dirname(config.wasm),'build-metadata.json')).sha256};
  const path=resolve(BASE,request.label+'-review.json');
  writeFileSync(path,JSON.stringify(review,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({path,...request}));
}
