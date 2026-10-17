import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStatsResume,validateStatsRun,statsStartupReady} from './stats-resume-review.mts';
test('new manual runs accept historical counters but never accept changes within a run',()=>{
 const now={boot:'current',swapouts:80,pressure:1,available:40*2**30,computeRunning:false,lockExists:false,sampledAt:''};
 assert.doesNotThrow(()=>statsStartupReady(now,16));
 assert.doesNotThrow(()=>validateStatsRun(now,now));
 assert.throws(()=>validateStatsRun(now,{...now,swapouts:81}));
 assert.throws(()=>validateStatsRun(now,{...now,boot:'new'}));
 assert.throws(()=>statsStartupReady({...now,pressure:2},16));
 assert.throws(()=>statsStartupReady({...now,available:30*2**30},16));
 assert.throws(()=>statsStartupReady({...now,computeRunning:true},16));
 assert.throws(()=>statsStartupReady({...now,lockExists:true},16));
});
test('statistics continuation binds history and stops on new swap, boot, pressure or stop',()=>{
 const now={boot:'boot',swapouts:48,pressure:1};
 const history={'old-stop':'unchanged'};
 const review={schema:'cuberoot.stats-opt10-reviewed-resume.v1',scope:'scramble-stats-opt10-session',
  authorization:'允许，复核后准备好，我自己启动',originalSwapouts:0,acceptedSwapouts:48,boot:'boot',
  reviewedAt:'2026-10-17T00:00:00Z',history,
  observations:Array.from({length:3},()=>({...now,available:40*2**30,computeRunning:false,lockExists:false}))};
 assert.doesNotThrow(()=>validateStatsResume(review,now,history,false));
 for(const change of [{swapouts:49},{boot:'reboot'},{pressure:2}])
  assert.throws(()=>validateStatsResume(review,{...now,...change},history,false));
 assert.throws(()=>validateStatsResume(review,now,history,true));
 assert.throws(()=>validateStatsResume(review,now,{'old-stop':'changed'},false));
 assert.throws(()=>validateStatsResume({...review,acceptedSwapouts:49},now,history,false));
});
