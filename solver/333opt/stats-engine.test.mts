import test from 'node:test';
import assert from 'node:assert/strict';
import {statsEngine} from './stats-engine.mts';
import {researchPolicy} from '../experiments/cube48opt-rust/guard.mts';
import {officialPaths,officialArgs} from '../experiments/cube48opt-rust/opt10-official-policy.mts';
import {zbllOfficialReviewPath} from '../experiments/cube48opt-rust/opt10-zbll-policy.mts';
test('daily default selects Opt10 independently of retired H10 table',()=>{
 const c=statsEngine('/repo',{}); assert.equal(c.engine,'opt10'); assert.equal(c.expectedBytes,31130911744);
 assert.equal(c.table,'/repo/.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat');
 assert.equal(statsEngine('/repo',{H10_ENGINE:'c',H48_H10_TABLE:'/old'}).table,'/old');
 assert.throws(()=>statsEngine('/repo',{H10_ENGINE:'typo'}));
});
test('statistics guard admits only official solve and one batch worker',()=>{
 const env={CUBEOPT_BACKEND:'opt10',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_SEARCH_THREADS:'1',CUBEOPT_ZBLL_REVIEW:zbllOfficialReviewPath};
 const policy=researchPolicy('scramble-stats-opt10-session',officialPaths.executable,officialArgs,env);
 assert.equal(policy.deadlineMs,0); assert.equal(policy.rssLimit,31130911744+2**30+16*2**20);
 assert.throws(()=>researchPolicy('scramble-stats-opt10-session',officialPaths.executable,['generate-opt10'],env));
 assert.throws(()=>researchPolicy('scramble-stats-opt10-session',officialPaths.executable,officialArgs,{...env,CUBEOPT_SOLVE_THREADS:'2'}));
});
