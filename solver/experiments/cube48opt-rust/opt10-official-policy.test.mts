import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { availableParallelism } from 'node:os';
import { officialArgs, officialPaths, officialScope, officialBinarySha256, officialPolicy, validateOfficialReview } from './opt10-official-policy.mts';
import { multithreadBaselineSha256, multithreadStoppedSha256, opt9ExperimentHashes } from './multithread-policy.mts';
import { researchPolicy } from './guard.mts';
import { officialRunRequest } from './run-opt10.mts';
import { zbllOfficialPolicy, zbllOfficialReviewPath, validateZbllOfficialReview } from './opt10-zbll-policy.mts';
function fixture() {
  const label='opt10-official-fixture',path=resolve(officialPaths.reviews,label+'.json');
  const request={label,executable:officialPaths.executable,args:[...officialArgs],env:{CUBEOPT_OPT10_OFFICIAL_REVIEW:path,
    CUBEOPT_BACKEND:'opt10',CUBEOPT_SEARCH_THREADS:'16',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_MEASURE_RSS:'1'}};
  const prior={boot:'same-boot',swapouts:0},program={...prior,label:'wca1000-mt16-rust-wasm-opt9',stopped:'Multithread child exited with status 1'};
  const evidence={releaseSha256:'release',executableSha256:officialBinarySha256,
    snapshotManifestSha256:'c0fb78c5e8565ed34304448ce1346008a6ee46b144b4f5332f9f3d9db448a529',
    benchmarkSha256:'045b03b1d0fec4d36da9c780ba68fa3d941a4f2e671e5a2661ebac7eed8e70a2',
    input:{path:officialPaths.input,sha256:'fixed-input',cases:1000},table:{path:officialPaths.table},snapshot:{path:officialPaths.small},
    baseline:{sha256:multithreadBaselineSha256,value:prior},stopped:{sha256:multithreadStoppedSha256,value:prior},
    programStop:{sha256:opt9ExperimentHashes.stop,value:program},
    programResources:{sha256:opt9ExperimentHashes.failedResources,value:{...program,pressure:1,minimumHeadroom:3*2**30,peakRss:1,rssLimit:2,trigger:{reason:program.stopped}}},
    priorResources:{value:prior}};
  const review={schema:'cuberoot.opt10-official-solve-review.v1',scope:officialScope,reason:'Explicit future request for one fixed-input run',reviewedAt:'2026-10-14T12:00:00Z',
    label,executable:request.executable,args:request.args,threads:16,batchThreads:1,cases:1000,measuredPasses:1,warmupCases:0,
    releaseSha256:evidence.releaseSha256,executableSha256:evidence.executableSha256,snapshotManifestSha256:evidence.snapshotManifestSha256,
    benchmarkSha256:evidence.benchmarkSha256,input:evidence.input,table:evidence.table,snapshot:evidence.snapshot,
    baselineSha256:evidence.baseline.sha256,stoppedSha256:evidence.stopped.sha256,programStopSha256:evidence.programStop.sha256,
    programResourcesSha256:evidence.programResources.sha256,...prior};
  return {request,path,evidence,review,current:{...prior,pressure:1,available:40*2**30}};
}
test('official default routes only the exact installed solve artifact and one 16-thread batch',()=>{
  const {request,review,path}=fixture(),policy=officialPolicy(request,16);
  assert.equal(policy.rssLimit,31_130_911_744+2**30+16*16*2**20);
  assert.equal(policy.official,true);assert.deepEqual(researchPolicy(request.label,request.executable,request.args,request.env),policy);
  assert.deepEqual(officialRunRequest(path,review),request);
  for(const mutation of [
    {...request,executable:request.executable.replace('opt10-official','opt10')},
    {...request,args:['generate-opt10',...request.args.slice(1)]},
    {...request,args:['solve-h48','11','table']},
    {...request,args:[...request.args.slice(0,-1),'1']},
    {...request,label:'wca1000-mt16-rust-native-opt10-exp-coset'},
    {...request,env:{...request.env,CUBEOPT_SEARCH_THREADS:'18'}},
    {...request,env:{...request.env,CUBEOPT_SOLVE_THREADS:'16'}},
    {...request,env:{...request.env,CUBEOPT_MULTITHREAD_REVIEW:'other'}},
  ])assert.throws(()=>officialPolicy(mutation,18));
  assert.throws(()=>officialPolicy(request,15));
});
test('official review cannot drift from release, fixed input, old stop or original swap baseline',()=>{
  const {request,evidence,review,current}=fixture();
  assert.deepEqual(validateOfficialReview(review,evidence,request,current),review);
  for(const field of ['releaseSha256','executableSha256','snapshotManifestSha256','benchmarkSha256','baselineSha256','stoppedSha256','programStopSha256','programResourcesSha256'])
    assert.throws(()=>validateOfficialReview({...review,[field]:'changed'},evidence,request,current),field);
  for(const change of [{input:{...review.input,sha256:'different'}},{cases:1},{measuredPasses:3},{warmupCases:100},{boot:'new'},{swapouts:1}])
    assert.throws(()=>validateOfficialReview({...review,...change},evidence,request,current));
  for(const change of [{swapouts:1},{boot:'new'},{pressure:2},{available:2**30}])
    assert.throws(()=>validateOfficialReview(review,evidence,request,{...current,...change}));
  assert.throws(()=>validateOfficialReview(review,evidence,request,current,true));
  assert.throws(()=>validateOfficialReview(review,evidence,request,current,false,true));
  assert.throws(()=>validateOfficialReview(review,{...evidence,programStop:{...evidence.programStop,sha256:'new-stop'}},request,current));
});

test('resumable ZBLL uses official search threads with one worker, retaining its separate input scope',()=>{
  const {request}=fixture();
  const env={CUBEOPT_ZBLL_REVIEW:zbllOfficialReviewPath,CUBEOPT_BACKEND:'opt10',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_SEARCH_THREADS:'16'};
  const input={...request,label:'double-zbll-opt10-batch',env};
  for(const n of [1,16,17,18]) {
    const changed={...input,env:{...env,CUBEOPT_SEARCH_THREADS:String(n)}};
    assert.equal(zbllOfficialPolicy(changed,18).searchThreads,n);
    if(n<=availableParallelism()) assert.equal(researchPolicy(changed.label,changed.executable,changed.args,changed.env).zbllOfficial,true);
  }
  for(const changed of [
    {...input,env:{...env,CUBEOPT_SEARCH_THREADS:'19'}},
    {...input,env:{...env,CUBEOPT_SEARCH_THREADS:'1.5'}},
    {...input,env:{...env,CUBEOPT_SOLVE_THREADS:'16'}},
    {...input,env:{...env,CUBEOPT_OPT10_OFFICIAL_REVIEW:'benchmark'}},
    {...input,env:{...env,CUBEOPT_MULTITHREAD_REVIEW:'other'}},
    {...input,args:['generate-opt10',...input.args.slice(1)]},
    {...input,args:[...input.args.slice(0,-1),'10']},
    {...input,executable:input.executable.replace('opt10-official','opt10')},
  ])assert.throws(()=>zbllOfficialPolicy(changed,18));
  assert.throws(()=>zbllOfficialPolicy(input,8));
});

test('ZBLL official review accepts unchanged history but refuses a new stop, changed binary or swap reset',()=>{
  const {evidence,review,current}=fixture();
  const batch={...review,schema:'cuberoot.opt10.zbll-official-review.v1',scope:'double-zbll-symmetry-v2'};
  assert.equal(validateZbllOfficialReview(batch,evidence,current).executableSha256,officialBinarySha256);
  for(const field of ['releaseSha256','executableSha256','snapshotManifestSha256','benchmarkSha256','baselineSha256','stoppedSha256','programStopSha256','programResourcesSha256'])
    assert.throws(()=>validateZbllOfficialReview({...batch,[field]:'changed'},evidence,current));
  for(const change of [{swapouts:1},{boot:'new'},{pressure:2}])
    assert.throws(()=>validateZbllOfficialReview(batch,evidence,{...current,...change}));
  assert.throws(()=>validateZbllOfficialReview(batch,evidence,current,true));
  assert.throws(()=>validateZbllOfficialReview(batch,{...evidence,programStop:{...evidence.programStop,sha256:'new-stop'}},current));
  assert.throws(()=>validateZbllOfficialReview(review,evidence,current));
});
