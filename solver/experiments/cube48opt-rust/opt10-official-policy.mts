/** Solve-only release contract. Promotion does not authorize another benchmark. */
import assert from 'node:assert/strict';
import { constants, openSync, closeSync, fstatSync, readFileSync, readSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyOpt10Release } from './opt10-release.mts';
import { readWca100 } from './wasm-benchmark.mjs';
import { multithreadBaselineSha256, multithreadStoppedSha256, opt9ExperimentHashes } from './multithread-policy.mts';

const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../..'),BASE=resolve(ROOT,'.tmp/cubeopt-reverse');
const GiB=2**30;
export const officialScope='opt10-official-wca1000-mt16-single';
export const officialPaths={
  executable:resolve(HERE,'target/opt10-official/release/cube48opt-research'),
  release:resolve(HERE,'opt10-release.json'),
  input:resolve(BASE,'wca1000-single.tsv'),small:resolve(BASE,'opt9-generated/small-memory.bin'),
  table:resolve(BASE,'opt10-generated-v2/cuberoot-opt10.dat'),
  reviews:resolve(BASE,'opt10-official/reviews'),receipts:resolve(BASE,'opt10-official/receipts'),
  stop:resolve(BASE,'opt10-official-stop.json'),
};
export const officialArgs=['solve-opt10',officialPaths.small,officialPaths.table,'8','20','0'];
export const officialBinarySha256='bd311e05cfd541b43aafb32e67025130bacc130592033b28439a9277cee3c58c';
const cosetReportSha256='045b03b1d0fec4d36da9c780ba68fa3d941a4f2e671e5a2661ebac7eed8e70a2';
const cosetManifestSha256='c0fb78c5e8565ed34304448ce1346008a6ee46b144b4f5332f9f3d9db448a529';
const corpusSha256='5b42a18086b27e974115a73696702017b5dde0a19c9819a77c88c8014d67c8ea';
export const officialDigest=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
export type OfficialRequest={label:string;executable:string;args:string[];env:NodeJS.ProcessEnv};
type Observation={boot:string;swapouts:number;pressure:number;available:number};
export function officialPolicy(request:OfficialRequest,availableCpus:number) {
  const {label,executable,args,env}=request;
  assert(/^opt10-official-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label),'Use a fresh official solve label');
  assert.equal(executable,officialPaths.executable);assert.deepEqual(args,officialArgs);
  assert.equal(env.CUBEOPT_OPT10_OFFICIAL_REVIEW,resolve(officialPaths.reviews,`${label}.json`));
  assert.equal(env.CUBEOPT_BACKEND,'opt10');assert.equal(env.CUBEOPT_SEARCH_THREADS,'16');
  assert.equal(env.CUBEOPT_SOLVE_THREADS,'1');assert.equal(env.CUBEOPT_MEASURE_RSS,'1');
  for(const key of ['CUBEOPT_VARIANT','CUBEOPT_H','CUBEOPT_BENCHMARK','CUBEOPT_OPT10_REVIEW','CUBEOPT_RESOURCE_REVIEW','CUBEOPT_ZBLL_REVIEW','CUBEOPT_MULTITHREAD_REVIEW'])
    assert.equal(env[key],undefined,`Conflicting ${key}`);
  assert(availableCpus>=16,'Sixteen real CPUs are required');
  return {official:true as const,entry:'native',mode:'solve-opt10',backend:'opt10',variant:null,h:null,
    tablePath:officialPaths.table,tableBytes:31_130_911_744,measureNativeRss:true,searchThreads:16,
    rssLimit:31_130_911_744+GiB+16*16*2**20,deadlineMs:6*60*60_000};
}
export function readOfficialRecord(path:string,limit=4*2**20) {
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {const stat=fstatSync(fd);assert(stat.isFile()&&stat.size>0&&stat.size<=limit,'Expected bounded regular evidence');return readFileSync(fd);}
  finally {closeSync(fd);}
}
function record(path:string){const bytes=readOfficialRecord(path);return {sha256:officialDigest(bytes),value:JSON.parse(bytes.toString())};}

/** Bounded metadata only: never loads/maps the table payload or runs the binary. */
export function collectOfficialEvidence() {
  const release=verifyOpt10Release();
  assert.equal(release.executable,officialPaths.executable);
  const manifest=release.manifest;
  assert.equal(manifest.executable.sha256,officialBinarySha256);
  assert.equal(manifest.snapshot.manifestSha256,cosetManifestSha256);
  assert.equal(manifest.benchmark.sha256,cosetReportSha256);
  const report=record(release.report);assert.equal(report.sha256,cosetReportSha256);
  const r=report.value;
  assert.deepEqual([r.cases,r.threads,r.batchThreads,r.measuredPasses,r.warmupCases,r.verifiedSolutions,r.optimalLengthsMatched],[1000,16,1,1,0,1000,1000]);
  const stem=release.report.replace(/-report\.json$/,'');assert.notEqual(stem,release.report);
  const priorResources=record(stem+'-resources.json'),priorExit=record(stem+'-exit.json');
  assert.equal(priorResources.sha256,r.resourceSha256);
  const prior=priorResources.value;
  assert.equal(priorExit.value.exitCode,0);assert.equal(priorExit.value.signal,null);
  assert.equal(prior.stopped,'');assert.equal(prior.trigger,null);assert.equal(prior.pressure,1);
  assert(prior.minimumHeadroom>=2*GiB&&prior.peakRss<=prior.rssLimit);
  const baseline=record(resolve(BASE,'resource-baseline.json')),stopped=record(resolve(BASE,'opt10-generate-v1-resources.json'));
  const programStop=record(resolve(BASE,'multithread-resource-review-stop.json'));
  const programResources=record(resolve(BASE,'wca1000-mt16-rust-wasm-opt9-resources.json'));
  const corpus=readWca100(resolve(ROOT,'solver/testdata/benchmarks/wca-first1000.json'),1000);
  assert.equal(corpus.corpusSha256,corpusSha256);assert.equal(r.corpusSha256,corpusSha256);
  const inputBytes=readOfficialRecord(officialPaths.input);
  assert(inputBytes.equals(Buffer.from(corpus.cases.map((item:{id:string;scramble:string})=>`${item.id}\t${item.scramble}\n`).join(''))),'Only the unchanged first 1000 WCA scrambles are supported');
  assert.equal(officialDigest(readOfficialRecord(officialPaths.small)),r.snapshot.sha256);
  assert.equal(r.snapshot.path,officialPaths.small);assert.equal(r.table.path,officialPaths.table);
  const fd=openSync(officialPaths.table,constants.O_RDONLY|constants.O_NOFOLLOW),header=Buffer.alloc(1024);
  try {assert(fstatSync(fd).isFile());assert.equal(fstatSync(fd).size,31_130_911_744);assert.equal(readSync(fd,header,0,1024,0),1024);}
  finally {closeSync(fd);}
  assert.equal(officialDigest(header),r.table.headerSha256);
  assert.equal(header.subarray(72,104).toString('hex'),r.snapshot.sha256);
  assert.equal(header.subarray(104,136).toString('hex'),r.table.payloadSha256);
  return {releaseSha256:officialDigest(readOfficialRecord(officialPaths.release)),executableSha256:officialBinarySha256,
    snapshotManifestSha256:cosetManifestSha256,benchmarkSha256:cosetReportSha256,
    input:{path:officialPaths.input,sha256:officialDigest(inputBytes),corpusSha256,cases:1000},inputBytes,
    table:r.table,snapshot:r.snapshot,baseline,stopped,programStop,programResources,priorResources,priorExit};
}

/** Future reviewed execution only. Promotion/check never creates this review. */
export function validateOfficialReview(review:any,e:any,request:OfficialRequest,now:Observation,used=false,newerStop=false) {
  const policy=officialPolicy(request,16);
  assert(!used&&!newerStop,'Official review already consumed or a later failure requires review');
  assert.equal(review.schema,'cuberoot.opt10-official-solve-review.v1');assert.equal(review.scope,officialScope);
  assert(typeof review.reason==='string'&&review.reason.trim().length>=20);assert(Number.isFinite(Date.parse(review.reviewedAt)));
  assert.deepEqual([review.label,review.executable,review.args],[request.label,request.executable,request.args]);
  assert.deepEqual([review.threads,review.batchThreads,review.cases,review.measuredPasses,review.warmupCases],[16,1,1000,1,0]);
  for(const key of ['releaseSha256','executableSha256','snapshotManifestSha256','benchmarkSha256','input','table','snapshot'])assert.deepEqual(review[key],e[key],`Changed official ${key}`);
  assert.equal(e.executableSha256,officialBinarySha256);assert.equal(e.snapshotManifestSha256,cosetManifestSha256);assert.equal(e.benchmarkSha256,cosetReportSha256);
  validateOfficialHistory(review,e,now);
  assert.equal(now.pressure,1);assert(now.available>=policy.rssLimit+3*GiB,'Insufficient memory before an official run');
  return {...review};
}

/** Shared stopped-history check; each consumer separately binds its command and corpus scope. */
export function validateOfficialHistory(review:any,e:any,now:Observation) {
  for(const [key,expected] of [['baseline',multithreadBaselineSha256],['stopped',multithreadStoppedSha256],['programStop',opt9ExperimentHashes.stop],['programResources',opt9ExperimentHashes.failedResources]] as const){
    assert.equal(e[key].sha256,expected);assert.equal(review[`${key}Sha256`],expected);
    assert.equal(e[key].value.boot,now.boot);assert.equal(e[key].value.swapouts,now.swapouts);
  }
  assert.equal(now.swapouts,0);assert.equal(review.boot,now.boot);assert.equal(review.swapouts,now.swapouts);
  assert.equal(e.priorResources.value.boot,now.boot);assert.equal(e.priorResources.value.swapouts,now.swapouts);
  assert.equal(e.programStop.value.label,'wca1000-mt16-rust-wasm-opt9');
  assert.equal(e.programStop.value.stopped,'Multithread child exited with status 1');
  assert.equal(e.programResources.value.trigger.reason,e.programStop.value.stopped);assert.equal(e.programResources.value.trigger.details,undefined);
  assert.equal(e.programResources.value.pressure,1);assert(e.programResources.value.minimumHeadroom>=2*GiB&&e.programResources.value.peakRss<=e.programResources.value.rssLimit);
}
export function officialHasStop() {
  return ['opt10-official-stop.json','resource-review-stop.json','opt10-resource-review-stop.json','opt10-native-experiment-stop.json','opt9-native-experiment-stop.json']
    .some(name=>existsSync(resolve(BASE,name)));
}
