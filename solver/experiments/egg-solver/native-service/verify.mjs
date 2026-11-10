// Independently replay the one new egg pass and the reused, verified Opt8 pass.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cube3x3x3 } from '../../../../core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js';
const [task] = process.argv.slice(2); assert(task?.startsWith('/'));
const hash = b => createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(readFileSync(p));
const rows = p => readFileSync(p,'utf8').trimEnd().split('\n').map(JSON.parse);
const planBytes = readFileSync(`${task}/plan100.json`), plan = JSON.parse(planBytes), input = read(`${task}/egg100/input.json`), report = read(`${task}/egg100/report.json`);
assert.equal(hash(planBytes),input.planSha256); assert.deepEqual(input.plan,plan);
assert.equal(plan.schema,'cuberoot.egg-h8-acceptance/v2'); assert.equal(plan.baselineReused,true);
assert.equal(hash(readFileSync(`${task}/cases100.json`)),plan.casesSha256);
const source = readFileSync(plan.source); assert.equal(hash(source),plan.sourceSha256);
const expected = JSON.parse(source).slice(0,100).map((c,i)=>({id:c.id,scramble:c.scramble,expectedLength:c.optimalLength,group:'comparison',sourceLine:i+1}));
assert.deepEqual(input.cases,expected); assert.equal(report.complete,true); assert.equal(report.measuredPasses,1); assert.equal(report.warmupCases,0); assert.equal(report.baselineReused,true);
assert(!existsSync(`${task}/egg100/failure.json`));
const old = `${task}/baseline-reused`, verificationBytes=readFileSync(`${old}/independent-verification.json`), oldVerification=JSON.parse(verificationBytes);
assert.equal(hash(verificationBytes),plan.baselineEvidenceSha256); assert.equal(oldVerification.allSolutionsVerified,true);
assert.equal(hash(readFileSync(`${old}/input.json`)),plan.baselineInputSha256);
assert.equal(hash(readFileSync(`${old}/r1-baseline/results.jsonl`)),plan.baselineResultsSha256);
for(const [name,digest] of Object.entries(oldVerification.files).filter(([name])=>name.startsWith('r1-baseline/'))) assert.equal(hash(readFileSync(`${old}/${name}`)),digest,`Changed reused evidence: ${name}`);
const oldInput=read(`${old}/input.json`);for(const k of ['pointerSha256','manifestSha256'])assert.equal(oldInput.assets[k],input.assets[k]);
const solved = (await cube3x3x3.kpuzzle()).defaultPattern();
const summarize = (rs,cpuSeconds) => { const times=rs.map(r=>r.wallSeconds).sort((a,b)=>a-b); return { count:rs.length,totalSeconds:rs.reduce((s,r)=>s+r.wallSeconds,0),cpuSeconds,p50:times[Math.ceil(times.length*.5)-1],p95:times[Math.ceil(times.length*.95)-1],p99:times[Math.ceil(times.length*.99)-1] }; };
const ticks=(dir,phase)=>{const stat=readFileSync(`${dir}/memory-${phase}.stat`,'utf8'),f=stat.slice(stat.lastIndexOf(') ')+2).trim().split(/\s+/);return Number(f[11])+Number(f[12]);};
const engines = {}, pids = new Set(); let verified = 0, boot;
for (const pass of input.passes) {
  const historical=pass.label==='opt8',dir=historical?`${old}/r1-baseline`:`${task}/egg100/${pass.label}`;
  const rs=rows(`${dir}/results.jsonl`),stats=read(`${dir}/report.json`),exit=read(`${dir}/exit.json`),start=read(`${dir}/startup.json`),resource=rows(`${dir}/resources.jsonl`);
  assert(!existsSync(`${dir}/failure.json`)); assert.equal(rs.length,100);
  if(!historical)assert.deepEqual(stats,report.engines[pass.label]);else assert.equal(stats.totalWallSeconds,plan.baselineSeconds);
  assert.equal(stats.pid,start.pid); assert.equal(stats.pid,exit.pid); assert.equal(start.readyLine,'READY\t4'); assert.equal(stats.threads,4);assert.equal(exit.code,0); assert.equal(exit.signal,null); assert.deepEqual(exit.remainingPids,[]);
  assert(!pids.has(stats.pid));pids.add(stats.pid);assert.equal(input.assets.binaries[pass.binary].sha256,pass.sha256);
  const stdout=readFileSync(`${dir}/stdout.log`,'utf8').trimEnd().split('\n');assert.equal(stdout.length,101);assert.equal(stdout[0],'READY\t4');
  for(const [i,r] of rs.entries()){const c=expected[i];assert.equal(r.id,c.id);assert.equal(r.pid,stats.pid);assert.equal(r.scramble,c.scramble);assert.equal(r.length,c.expectedLength);assert.equal(r.solution.split(' ').filter(Boolean).length,r.length);assert.equal(r.raw,stdout[i+1]);assert.equal(r.raw,`${r.id}\t${r.length}\t${r.solution}`);assert(solved.applyAlg(c.scramble).applyAlg(r.solution).isIdentical(solved),`Replay failed: ${r.id}`);assert(r.wallSeconds>=0&&r.wallSeconds<=input.limits.requestMs/1000);verified++;}
  assert(resource.length>0);boot??=resource[0].bootId;
  for(const r of resource){assert.equal(r.pid,stats.pid);assert.equal(r.bootId,boot);assert(r.treeRssBytes<=input.limits.treeRssBytes);assert(r.availableBytes>=input.limits.reserveBytes);assert(r.fullPressureAvg10===null||r.fullPressureAvg10<=input.limits.fullPressureAvg10);}
  let idle;
  if(!historical){const admission=rows(`${dir}/admission.jsonl`);assert(admission.some(r=>r.phase==='preflight'&&r.outcome==='disabled'));assert(admission.every(r=>['disabled','cancelled'].includes(r.outcome)));idle=read(`${dir}/idle.json`);assert.equal(idle.pid,stats.pid);}
  const summary=summarize(rs,(ticks(dir,'complete')-ticks(dir,'ready'))/input.clockTicks);assert.equal(summary.totalSeconds,stats.totalWallSeconds);
  engines[pass.label]={pid:stats.pid,sha256:pass.sha256,historical,measuredAt:resource[0].at,...summary,startupSeconds:stats.startupSeconds,...(idle?{idleCpuSeconds:idle.cpuTicks/input.clockTicks,idleSeconds:idle.seconds}:{}),peakRss:Math.max(...resource.map(r=>r.treeRssBytes)),maxSwap:Math.max(...resource.map(r=>r.treeSwapBytes)),minAvailable:Math.min(...resource.map(r=>r.availableBytes))};
}
const b=engines.opt8,c=engines['egg-h8'],a=plan.acceptance;
const ratios={wall:c.totalSeconds/b.totalSeconds,cpu:c.cpuSeconds/b.cpuSeconds,p50:c.p50/b.p50,p95:c.p95/b.p95,p99:c.p99/b.p99};
const checks={comparison:{wall:ratios.wall<=1-a.minWallTimeReduction,cpu:ratios.cpu<=a.maxCpuTimeRatio,p50:ratios.p50<=a.maxMedianRatio,p95:ratios.p95<=a.maxP95Ratio,p99:ratios.p99<=a.maxP99Ratio}};
const correct=verified===200,idle=c.idleSeconds===5&&c.idleCpuSeconds<=a.idleCpuSecondsMax;
const result={schema:'cuberoot.egg-h8-acceptance-result/v2',planSha256:hash(planBytes),verifiedSolutions:verified,newEggSolutions:100,reusedOpt8Solutions:100,allSolutionsAndOptimalLengths:correct,engines,ratios,checks,idle,accepted:correct&&idle&&Object.values(checks.comparison).every(Boolean),pageReference:{seconds:plan.pageBaselineSeconds,speedRatio:plan.pageBaselineSeconds/c.totalSeconds},note:'User reduced to egg WCA1–100 and reused verified Opt8 evidence. One new egg pass, no warmup/tuning; historical baseline, not a simultaneous repeatability test. Interrupted 143-case extension remains preserved and is excluded.'};
writeFileSync(`${task}/independent-verification.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));
