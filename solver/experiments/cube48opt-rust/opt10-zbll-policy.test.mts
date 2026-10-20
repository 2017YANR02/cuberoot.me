import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {availableParallelism} from 'node:os';
import {researchPolicy} from './guard.mts';
import {sha256,validateOpt10BatchReview,zbllOfficialPolicy,zbllOfficialReviewPath} from './opt10-zbll-policy.mts';
import {officialPaths,officialArgs} from './opt10-official-policy.mts';
test('only the reviewed persistent ZBLL session removes the per-batch deadline',()=>{
  const request={label:'double-zbll-opt10-session',executable:officialPaths.executable,args:officialArgs,
    env:{CUBEOPT_BACKEND:'opt10',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_SEARCH_THREADS:'16',CUBEOPT_ZBLL_REVIEW:zbllOfficialReviewPath}};
  assert.equal(zbllOfficialPolicy(request,18).deadlineMs,0);
  const batch=zbllOfficialPolicy({...request,label:'double-zbll-opt10-batch'},18);
  assert.equal(batch.deadlineMs,7_200_000);
  assert.equal(zbllOfficialPolicy(request,18).rssLimit,batch.rssLimit);
  assert.throws(()=>zbllOfficialPolicy({...request,args:['generate-opt10']},18));
});
const root=resolve(import.meta.dirname,'../../..');
const bin=resolve(import.meta.dirname,'target/opt10/release/cube48opt-research');
const args=['solve-opt10',resolve(root,'.tmp/cubeopt-reverse/opt9-generated/small-memory.bin'),resolve(root,'.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat'),'8','20','0'];
const env={CUBEOPT_BACKEND:'opt10',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_ZBLL_REVIEW:resolve(root,'.tmp/double-zbll-symmetry-v2/opt10-resource-review.json')};
test('batch scope admits only reviewed Opt10 solves and never expands the old single-pass scope',()=>{
  for(const n of [1,Math.min(16,availableParallelism())]){
    const p=researchPolicy('double-zbll-opt10-batch',bin,args,{...env,CUBEOPT_SOLVE_THREADS:String(n)});
    assert.equal(p.rssLimit,31_130_910_720+2**30);assert.equal(p.deadlineMs,7_200_000);
  }
  for(const change of [{CUBEOPT_SOLVE_THREADS:'0'},{CUBEOPT_SOLVE_THREADS:'999'},{CUBEOPT_SOLVE_THREADS:'1.5'},
    {CUBEOPT_OPT10_REVIEW:'old'},{CUBEOPT_BACKEND:'h10'},{CUBEOPT_H:'11'},{CUBEOPT_ZBLL_REVIEW:'other'}])
    assert.throws(()=>researchPolicy('double-zbll-opt10-batch',bin,args,{...env,...change}));
  assert.throws(()=>researchPolicy('double-zbll-opt10-batch',bin,['generate-opt10',...args.slice(1)],env));
  assert.throws(()=>researchPolicy('unrelated',bin,args,env));
  assert.throws(()=>researchPolicy('double-zbll-opt10-batch',bin,args,{CUBEOPT_BACKEND:'opt10',CUBEOPT_SOLVE_THREADS:'16'}));
});
test('review binds preserved stopped history and successful predecessor, without resetting swap or boot',()=>{
  const bytes=(x:unknown)=>Buffer.from(JSON.stringify(x));
  const baseline=bytes({boot:'boot',swapouts:0,stopped:'old stop'}),binary=Buffer.from('binary'),small=Buffer.from('small'),header=Buffer.from('header');
  const report=bytes({schema:'cuberoot.rust-opt10.wca100-report.v1',cases:100,independentlyVerifiedSolutions:100,optimalLengthsMatched:100,
    protection:{triggered:false,resource:{boot:'boot',swapouts:0,stopped:'',trigger:null,pressure:1,peakRss:10,rssLimit:20,minimumHeadroom:2**32,
      opt10ReviewReceipt:{baselineSha256:sha256(baseline),executableSha256:sha256(binary),snapshotSha256:sha256(small)}}},
    generationMetadata:{table:{headerSha256:sha256(header)}}});
  const evidence={baseline,binary,small,header,report,exit:bytes({exitCode:0,signal:null})};
  const review={schema:'cuberoot.opt10.zbll-review.v1',scope:'double-zbll-symmetry-v2',reason:'reviewed',reviewedAt:'2026-10-13T00:00:00Z',
    ...Object.fromEntries(Object.entries(evidence).map(([k,v])=>[k==='report'?'reportSha256':k+'Sha256',sha256(v)]))};
  assert.doesNotThrow(()=>validateOpt10BatchReview(review,evidence,{boot:'boot',swapouts:0}));
  for(const key of Object.keys(evidence)) assert.throws(()=>validateOpt10BatchReview(review,{...evidence,[key]:Buffer.from('changed')},{boot:'boot',swapouts:0}));
  assert.throws(()=>validateOpt10BatchReview(review,evidence,{boot:'new',swapouts:0}));
  assert.throws(()=>validateOpt10BatchReview(review,evidence,{boot:'boot',swapouts:1}));
});
