/** Explicitly reviewed continuation. Historical counters and stop records stay immutable. */
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../../..');
const work=resolve(root,'.tmp/double-zbll-symmetry-v2');
const research=resolve(root,'.tmp/cubeopt-reverse');
export const resumeReviewPath=resolve(work,'resume-review-20261015.json');
export const previousResumeStopPath=resolve(work,'resume-stop-20261015.json');
export const observationReviewPath=resolve(work,'resume-ps-review-20261015.json');
export const resumeStopPath=resolve(work,'resume-stop-after-ps-review-20261015.json');
export const resumeDigest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export function resumeHistory() {
  const files=[resolve(research,'resource-baseline.json'),resolve(root,'.tmp/h48-corners-research/resource-baseline.json'),
    resolve(work,'opt10-official-resource-review.json'),resolve(import.meta.dirname,'opt10-release.json')];
  for(const dir of [research,...['open-benchmark-20261015','wasm-opt8-opt9-20261015','wasm-browser-20261015'].map(d=>resolve(research,d))])
    if(existsSync(dir))for(const name of readdirSync(dir))if(name.endsWith('.json')&&name.includes('stop'))files.push(resolve(dir,name));
  return Object.fromEntries([...new Set(files)].sort().filter(existsSync).map(p=>[p,resumeDigest(readFileSync(p))]));
}
type Observation={boot:string;swapouts:number;pressure:number;available:number};
export function validateResume(review:any,current:Observation,history:Record<string,string>,stopped:boolean) {
  assert(!stopped,'恢复后再次停止，必须重新复核，不能自动重试');
  assert.equal(review.schema,'cuberoot.zbll-reviewed-resume.v1');
  assert.equal(review.authorization,'修复好之后你自己来跑吧，但是我要能看到终端界面');
  assert.equal(review.scope,'double-zbll-symmetry-v2');
  assert.equal(review.originalSwapouts,0);assert.equal(review.acceptedSwapouts,48);
  assert.equal(current.boot,review.boot);assert.equal(current.swapouts,review.acceptedSwapouts);
  assert.equal(current.pressure,1);assert.deepEqual(history,review.history);
  assert(Number.isFinite(Date.parse(review.reviewedAt)));
  assert(Date.now()<Date.parse('2026-12-01T00:00:00Z'));
  assert(Array.isArray(review.observations)&&review.observations.length>=3);
  for(const observation of review.observations){
    assert.equal(observation.boot,review.boot);assert.equal(observation.swapouts,48);
    assert.equal(observation.pressure,1);assert(observation.available>=34*2**30);
  }
  return { ...review, sha256:resumeDigest(Buffer.from(JSON.stringify(review))) };
}
export function readResumeReview(current:Observation) {
  if(!existsSync(resumeReviewPath))return undefined;
  const review=JSON.parse(readFileSync(resumeReviewPath,'utf8'));
  const archive=readFileSync(resolve(work,'resume-20261015/original-progress.json'));
  assert.equal(resumeDigest(archive),review.progressSha256);
  const original=JSON.parse(archive.toString());
  assert.equal(original.status,'protected-stop');assert.equal(original.boot,review.boot);
  assert.equal(original.baselineSwapouts,review.originalSwapouts);assert.equal(original.currentSwapouts,16);
  assert.equal(original.verified,5_486_544);
  const accepted=validateResume(review,current,resumeHistory(),existsSync(resumeStopPath));
  if(!existsSync(previousResumeStopPath))return accepted;
  assert(existsSync(observationReviewPath),'上次进程查询超时后已停止；请先复核资源，结果和断点仍保留。');
  return validateObservationReview(accepted,JSON.parse(readFileSync(observationReviewPath,'utf8')),current,
    readFileSync(previousResumeStopPath),readFileSync(resolve(work,'resume-ps-review-20261015/original-progress.json')));
}
/** A human-reviewed observation failure; never change the accepted swap counter. */
export function validateObservationReview(base:any,review:any,current:Observation,stopBytes:Buffer,progressBytes:Buffer) {
  assert.equal(review.schema,'cuberoot.zbll-observation-review.v1');
  assert.equal(review.previousReviewSha256,base.sha256);
  assert.equal(review.stopSha256,resumeDigest(stopBytes));
  assert.equal(review.progressSha256,resumeDigest(progressBytes));
  assert(Number.isFinite(Date.parse(review.reviewedAt)));
  const stop=JSON.parse(stopBytes.toString()),progress=JSON.parse(progressBytes.toString());
  assert.equal(stop.stopped,'Error: spawnSync /bin/ps ETIMEDOUT');
  assert.equal(stop.trigger?.details?.observationError,stop.stopped);
  assert.equal(stop.boot,base.boot);assert.equal(stop.swapouts,base.acceptedSwapouts);
  assert.equal(progress.status,'protected-stop');assert.equal(progress.boot,base.boot);
  assert.equal(progress.baselineSwapouts,base.originalSwapouts);
  assert.equal(progress.currentSwapouts,base.acceptedSwapouts);
  assert.equal(progress.resumeReviewSha256,base.sha256);
  assert.equal(current.boot,base.boot);assert.equal(current.swapouts,base.acceptedSwapouts);assert.equal(current.pressure,1);
  assert(Array.isArray(review.observations)&&review.observations.length>=3);
  for(const observation of review.observations){
    assert.equal(observation.boot,base.boot);assert.equal(observation.swapouts,base.acceptedSwapouts);
    assert.equal(observation.pressure,1);assert(observation.available>=34*2**30);
    assert(observation.disk>=30*2**30);assert.equal(observation.processObservationHealthy,true);
  }
  return {...base,progressSha256:review.progressSha256,
    sha256:resumeDigest(Buffer.from(JSON.stringify({previous:base.sha256,review})))};
}
export function resumeBaseline(prior:any,review:ReturnType<typeof readResumeReview>,progressBytes:Buffer) {
  if(!review)return prior;
  assert.equal(prior.boot,review.boot);assert.equal(prior.baselineSwapouts,review.originalSwapouts);
  if(prior.status==='protected-stop')assert.equal(resumeDigest(progressBytes),review.progressSha256,'New protected stop cannot reuse an old review');
  else assert.equal(prior.resumeReviewSha256,review.sha256);
  return {...prior,status:'stopped',reviewedSwapouts:review.acceptedSwapouts,resumeReviewSha256:review.sha256};
}
