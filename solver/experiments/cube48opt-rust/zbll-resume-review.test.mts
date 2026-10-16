import test from 'node:test';
import assert from 'node:assert/strict';
import {validateResume,resumeBaseline,resumeDigest,validateObservationReview} from './zbll-resume-review.mts';
test('review permits only the acknowledged counter and immutable stopped history',()=>{
  const current={boot:'same',swapouts:48,pressure:1,available:40*2**30};
  const history={'old-stop':'hash'},prior={boot:'same',baselineSwapouts:0,status:'protected-stop',verified:5486544};
  const bytes=Buffer.from(JSON.stringify(prior));
  const review={schema:'cuberoot.zbll-reviewed-resume.v1',scope:'double-zbll-symmetry-v2',
    authorization:'修复好之后你自己来跑吧，但是我要能看到终端界面',reviewedAt:'2026-10-15T17:00:00Z',
    boot:'same',originalSwapouts:0,acceptedSwapouts:48,history,observations:[current,current,current],progressSha256:resumeDigest(bytes)};
  const accepted=validateResume(review,current,history,false);
  const baseline=resumeBaseline(prior,accepted,bytes);
  assert.equal(baseline.baselineSwapouts,0);assert.equal(baseline.reviewedSwapouts,48);assert.equal(prior.status,'protected-stop');
  for(const change of [{swapouts:49},{swapouts:0},{boot:'new'},{pressure:2}])
    assert.throws(()=>validateResume(review,{...current,...change},history,false));
  assert.throws(()=>validateResume(review,current,{'old-stop':'changed'},false));
  assert.throws(()=>validateResume(review,current,history,true));
  assert.throws(()=>resumeBaseline(prior,accepted,Buffer.from('new stop')));
  assert.throws(()=>resumeBaseline({...prior,status:'running'},accepted,bytes));
  assert.equal(resumeBaseline({...baseline,status:'stopped'},accepted,bytes).reviewedSwapouts,48);
});
test('explicit observation review binds the exact failure and preserves all counters',()=>{
  const base={sha256:'prior-review',boot:'same',originalSwapouts:0,acceptedSwapouts:48};
  const observation={boot:'same',swapouts:48,pressure:1,available:40*2**30,disk:35*2**30,processObservationHealthy:true};
  const stop=Buffer.from(JSON.stringify({boot:'same',swapouts:48,stopped:'Error: spawnSync /bin/ps ETIMEDOUT',trigger:{details:{observationError:'Error: spawnSync /bin/ps ETIMEDOUT'}}}));
  const prior={status:'protected-stop',boot:'same',baselineSwapouts:0,currentSwapouts:48,resumeReviewSha256:base.sha256};
  const progress=Buffer.from(JSON.stringify(prior));
  const review={schema:'cuberoot.zbll-observation-review.v1',previousReviewSha256:base.sha256,
    stopSha256:resumeDigest(stop),progressSha256:resumeDigest(progress),reviewedAt:'2026-10-16T03:00:00Z',observations:[observation,observation,observation]};
  const accepted=validateObservationReview(base,review,observation,stop,progress);
  assert.equal(resumeBaseline(prior,accepted,progress).reviewedSwapouts,48);
  assert.equal(resumeBaseline(prior,accepted,progress).baselineSwapouts,0);
  assert.throws(()=>validateObservationReview(base,review,{...observation,swapouts:49},stop,progress));
  assert.throws(()=>validateObservationReview(base,{...review,observations:[{...observation,available:33*2**30},observation,observation]},observation,stop,progress));
  assert.throws(()=>validateObservationReview(base,review,observation,Buffer.from('new stop'),progress));
  assert.throws(()=>resumeBaseline(prior,accepted,Buffer.from('new protected stop')));
});
