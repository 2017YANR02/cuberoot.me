/** User-authorized statistics baseline; never mutates earlier task records. */
import assert from 'node:assert/strict';
import {existsSync, readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {resumeHistory, resumeDigest} from './zbll-resume-review.mts';
import {execFileSync} from 'node:child_process';
import {parseVm,memorySummary} from '../../../core/scripts/mac-system-recorder.mts';
export const statsReviewPath=resolve(import.meta.dirname,'../../../.tmp/scramble-stats-opt10/review-20261017.json');
export const statsStopPath=resolve(import.meta.dirname,'../../../.tmp/scramble-stats-opt10/protected-stop.json');
export function statsHistory() {
  const history=resumeHistory();
  for(const file of ['guard.mts','stats-resume-review.mts','../../333opt/stats-engine.mts','../../333opt/solve_h10.mts','../../333opt/rust-h10-adapter.mts']) {
    const path=resolve(import.meta.dirname,file); history[path]=resumeDigest(readFileSync(path));
  }
  return history;
}
export function validateStatsResume(review:any, now:{boot:string;swapouts:number;pressure:number}, history:Record<string,string>, stopped:boolean) {
  assert(!stopped,'Statistics previously stopped; a new explicit review is required');
  assert.equal(review.schema,'cuberoot.stats-opt10-reviewed-resume.v1');
  assert.equal(review.scope,'scramble-stats-opt10-session');
  assert.equal(review.authorization,'允许，复核后准备好，我自己启动');
  assert.equal(review.acceptedSwapouts,48); assert.equal(review.originalSwapouts,0);
  assert.equal(now.boot,review.boot,'系统已重启，统计资源基线需要重新复核');
  assert.equal(now.swapouts,review.acceptedSwapouts,
    `统计内存保护：系统换出计数从 ${review.acceptedSwapouts} 变为 ${now.swapouts}。Opt10 未启动，已有结果保留；必须复核资源并明确授权后才能更新基线。`);
  assert.equal(now.pressure,1,'当前内存压力异常，统计已停止');
  assert.deepEqual(history,review.history);
  assert(Number.isFinite(Date.parse(review.reviewedAt)));
  assert(review.observations?.length>=3);
  for(const o of review.observations) {
    assert.equal(o.boot,review.boot); assert.equal(o.swapouts,48); assert.equal(o.pressure,1);
    assert(o.available>=31_130_911_744+4*2**30+18*16*2**20);
    assert.equal(o.computeRunning,false); assert.equal(o.lockExists,false);
  }
  return {...review,sha256:resumeDigest(Buffer.from(JSON.stringify(review)))};
}
export function readStatsResume(now:{boot:string;swapouts:number;pressure:number}) {
  return validateStatsResume(JSON.parse(readFileSync(statsReviewPath,'utf8')),now,statsHistory(),existsSync(statsStopPath));
}
export function observeStatsResources() {
  const run=(bin:string,args:string[]=[])=>execFileSync(bin,args,{encoding:'utf8',timeout:5000});
  const vm=parseVm(run('/usr/bin/vm_stat')), summary=memorySummary(vm);
  assert(summary&&Number.isSafeInteger(vm.pages.Swapouts));
  return {sampledAt:new Date().toISOString(),boot:run('/usr/sbin/sysctl',['-n','kern.boottime']).trim(),
    swapouts:vm.pages.Swapouts,pressure:Number(run('/usr/sbin/sysctl',['-n','kern.memorystatus_vm_pressure_level']).trim()),
    available:summary.reclaimableEstimateBytes,
    computeRunning:/solve_h48_h10|cube48opt-research|table_generator|nxopt\d+/.test(run('/bin/ps',['-axo','comm'])),
    lockExists:existsSync(resolve(import.meta.dirname,'../../../.tmp/cubeopt-reverse/compute.lock'))};
}
export function statsStartupReady(observation:ReturnType<typeof observeStatsResources>, threads:number) {
  validateStatsRun(observation,observation);
  assert(!observation.computeRunning&&!observation.lockExists,'Another computation or retained lock prevents startup');
  assert(observation.available>=31_130_911_744+4*2**30+threads*16*2**20,'Insufficient Opt10 startup memory');
}
/** Each explicit launch starts a new observation window; never refresh it in a run. */
export function validateStatsRun(start:{boot:string;swapouts:number},now:{boot:string;swapouts:number;pressure:number}) {
  assert(start.boot&&Number.isSafeInteger(start.swapouts)&&start.swapouts>=0,'Invalid statistics baseline');
  assert.equal(now.boot,start.boot,'系统已重启，本轮统计停止');
  assert.equal(now.swapouts,start.swapouts,'本轮发生新增内存换出，统计停止；已完成结果保留');
  assert.equal(now.pressure,1,'当前内存压力异常，统计未启动或已停止');
}
export function beginStatsRun(now:{boot:string;swapouts:number;pressure:number;available:number}) {
  validateStatsRun(now,now);
  const directory=resolve(import.meta.dirname,'../../../.tmp/scramble-stats-opt10/runs',`${Date.now()}-${process.pid}`);
  mkdirSync(directory,{recursive:true});
  const run={...now,directory,stopPath:resolve(directory,'protected-stop.json'),
    schema:'cuberoot.stats-opt10-run.v2',startedAt:new Date().toISOString(),history:statsHistory()};
  writeFileSync(resolve(directory,'baseline.json'),JSON.stringify(run,null,2)+'\n',{flag:'wx'});
  return run;
}
