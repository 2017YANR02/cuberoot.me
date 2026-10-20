/** Resumable ZBLL scope, separate from the consumed one-shot WCA100 review. */
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { officialPaths, officialArgs, validateOfficialHistory, type OfficialRequest } from './opt10-official-policy.mts';
export const zbllOfficialReviewPath = resolve(import.meta.dirname,'../../../.tmp/double-zbll-symmetry-v2/opt10-official-resource-review.json');

/** Long-job input remains supplied by the checkpoint runner, never the benchmark corpus. */
export function zbllOfficialPolicy({label,executable,args,env}:OfficialRequest,cpus:number) {
  assert(/^double-zbll-opt10-[a-z0-9-]+$/.test(label));
  assert.equal(executable,officialPaths.executable);assert.deepEqual(args,officialArgs);
  assert.equal(env.CUBEOPT_ZBLL_REVIEW,zbllOfficialReviewPath);
  assert.equal(env.CUBEOPT_BACKEND,'opt10');assert.equal(env.CUBEOPT_SOLVE_THREADS,'1');
  const threads=Number(env.CUBEOPT_SEARCH_THREADS);
  assert(Number.isInteger(threads)&&threads>=1&&threads<=Math.min(18,cpus)&&String(threads)===env.CUBEOPT_SEARCH_THREADS);
  for(const key of ['CUBEOPT_VARIANT','CUBEOPT_H','CUBEOPT_BENCHMARK','CUBEOPT_OPT10_REVIEW','CUBEOPT_RESOURCE_REVIEW','CUBEOPT_OPT10_OFFICIAL_REVIEW','CUBEOPT_MULTITHREAD_REVIEW','CUBEOPT_MEASURE_RSS'])
    assert.equal(env[key],undefined,`Conflicting ${key}`);
  return {entry:'native',mode:'solve-opt10',backend:'opt10',variant:null,h:null,tablePath:officialPaths.table,
    tableBytes:31_130_911_744,measureNativeRss:false,rssLimit:31_130_911_744+2**30+threads*16*2**20,
    // One authorized task owns this process across all checkpoint batches.
    // Resource stops and the task's absolute authorization expiry still apply.
    deadlineMs:label === 'double-zbll-opt10-session' ? 0 : 2*60*60_000,
    zbll:true,zbllOfficial:true,searchThreads:threads};
}

export function validateZbllOfficialReview(review:any,e:any,current:{boot:string;swapouts:number;pressure:number;available:number},newerStop=false) {
  assert(!newerStop,'A newer stop requires review before resuming ZBLL');
  assert.equal(review.schema,'cuberoot.opt10.zbll-official-review.v1');
  assert.equal(review.scope,'double-zbll-symmetry-v2');
  assert(typeof review.reason==='string'&&review.reason.trim().length>=20);
  assert(Number.isFinite(Date.parse(review.reviewedAt)));
  for(const key of ['releaseSha256','executableSha256','snapshotManifestSha256','benchmarkSha256','table','snapshot'])
    assert.deepEqual(review[key],e[key],`Changed ZBLL official ${key}`);
  validateOfficialHistory(review,e,current);
  assert.equal(current.pressure,1);
  return {reviewSha256:sha256(Buffer.from(JSON.stringify(review))),releaseSha256:e.releaseSha256,executableSha256:e.executableSha256,
    baselineSha256:e.baseline.sha256,programStopSha256:e.programStop.sha256};
}
export const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
export function validateOpt10BatchReview(review: any, evidence: {
  baseline: Buffer; report: Buffer; exit: Buffer; binary: Buffer; small: Buffer; header: Buffer;
}, current: { boot: string; swapouts: number }) {
  const prior = JSON.parse(evidence.baseline.toString()), report = JSON.parse(evidence.report.toString());
  const exit = JSON.parse(evidence.exit.toString()), resource = report.protection?.resource;
  const receipt = resource?.opt10ReviewReceipt;
  if (review?.schema !== 'cuberoot.opt10.zbll-review.v1' || review.scope !== 'double-zbll-symmetry-v2'
      || !review.reason || !Number.isFinite(Date.parse(review.reviewedAt))
      || review.baselineSha256 !== sha256(evidence.baseline) || review.reportSha256 !== sha256(evidence.report)
      || review.exitSha256 !== sha256(evidence.exit) || review.binarySha256 !== sha256(evidence.binary)
      || review.smallSha256 !== sha256(evidence.small) || review.headerSha256 !== sha256(evidence.header))
    throw Error('Opt10 ZBLL review evidence changed; review again without resetting the baseline');
  if (report.schema !== 'cuberoot.rust-opt10.wca100-report.v1' || report.cases !== 100
      || report.independentlyVerifiedSolutions !== 100 || report.optimalLengthsMatched !== 100
      || report.protection.triggered !== false || exit.exitCode !== 0 || exit.signal !== null
      || resource.stopped !== '' || resource.trigger !== null || resource.pressure !== 1
      || resource.peakRss > resource.rssLimit || !(resource.minimumHeadroom >= 2 ** 31)
      || receipt?.baselineSha256 !== review.baselineSha256 || receipt.executableSha256 !== review.binarySha256
      || receipt.snapshotSha256 !== review.smallSha256 || report.generationMetadata?.table?.headerSha256 !== review.headerSha256)
    throw Error('Opt10 ZBLL requires the completed, independently verified predecessor and unchanged artifacts');
  if (typeof prior.boot !== 'string' || !Number.isSafeInteger(prior.swapouts)
      || current.boot !== prior.boot || current.swapouts !== prior.swapouts
      || resource.boot !== prior.boot || resource.swapouts !== prior.swapouts)
    throw Error('Opt10 ZBLL boot/Swapouts changed; cannot reset the baseline');
  return { reviewSha256: sha256(Buffer.from(JSON.stringify(review))), baselineSha256: review.baselineSha256 };
}
