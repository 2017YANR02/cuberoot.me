import { expect, it } from 'vitest';
import { limits, violation } from '../scripts/run-assistant-local.mts';
import { leaseLimits, leaseViolation } from '../scripts/assistant-monitor-lease.mts';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadEvaluationResume, resumeHelperSha256 } from '../scripts/assistant-evaluation-resume.mts';

it.each(['memory_headroom','monitor_lease_expired'])('resumes only unfinished keys after %s and rejects altered evidence', reason => {
  const scratch=fileURLToPath(new URL('../../../../.tmp/scratch/',import.meta.url));mkdirSync(scratch,{recursive:true});
  const root=mkdtempSync(resolve(scratch,'assistant-resume-')),prior=resolve(root,'.local-data/prior'),next=resolve(root,'.local-data/next');
  mkdirSync(prior,{recursive:true});mkdirSync(next,{recursive:true});
  const hash=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
  const save=(base:string,name:string,value:unknown)=>writeFileSync(resolve(base,name),JSON.stringify(value));
  const rows=(base:string,name:string,value:unknown[])=>writeFileSync(resolve(base,name),value.map(x=>JSON.stringify(x)).join('\n')+'\n');
  try {
    for(const v of ['before','after'])writeFileSync(resolve(next,v+'.mjs'),'frozen bundle');
    const build={variants:Object.fromEntries(['before','after'].map(v=>[v,{bundleSha256:hash(resolve(next,v+'.mjs'))}])),casesSha256:'cases',fixture:{sha256:'fixture'},sourcesSha256:null,baselineMemory:true,lockSha256:'lock'};
    save(prior,'build-manifest.json',build);save(next,'build-manifest.json',{...build,resumeHelperSha256,resumesBuildSha256:hash(resolve(prior,'build-manifest.json'))});
    save(prior,'cases.json',{cases:[{id:'A'}]});save(prior,'run-manifest.json',{configFingerprint:'configuration'});
    rows(prior,'results.jsonl',[{repeat:1,variant:'before',id:'A'}]);
    rows(prior,'provider-starts.jsonl',[{repeat:1,variant:'before',id:'A',call:1},{repeat:1,variant:'after',id:'A',call:2}]);
    rows(prior,'provider-calls.jsonl',[{repeat:1,variant:'before',id:'A',call:1,input:100,output:20}]);
    save(prior,'paid-ledger.json',{answers:2,calls:2,input:100,output:20,missingUsage:0,maxAnswers:4,maxCalls:240,maxInput:2250000,maxOutput:225000});
    const usage={boot:'old',swapouts:0,pressure:1,free:5*2**30,rss:100*2**20};
    const stop={reason,at:new Date(11951).toISOString(),unknownProviderCalls:[2]};
    save(prior,'resource-stop.json',stop);
    save(prior,'local-exit.json',{stopped:true,elapsedMs:2500,baseline:{...usage,at:new Date(10000).toISOString()},last:usage});
    const names=['build-manifest.json','run-manifest.json','cases.json','results.jsonl','provider-starts.jsonl','provider-calls.jsonl','paid-ledger.json','resource-stop.json','local-exit.json'];
    if(reason==='monitor_lease_expired') {
      rows(prior,'local-resources.jsonl',[{...usage,at:new Date(12000).toISOString()}]);
      rows(prior,'worker-monitor-leases.jsonl',[{type:'resource-sample',parent:123,sequence:1,sampledAt:12000,receivedAt:12001,deadline:100000}]);
      save(prior,'worker-monitor-stop.json',stop);
      names.push('local-resources.jsonl','worker-monitor-leases.jsonl','worker-monitor-stop.json');
    }
    const spec={version:1,priorDirectory:'.local-data/prior',reviewedUnknownCalls:[2],priorFiles:Object.fromEntries(names.map(n=>[n,hash(resolve(prior,n))]))};save(next,'resume.json',spec);
    const result=loadEvaluationResume(next,root)!;
    expect(result.done).toEqual(['1:before:A']);expect(result.ledger.answers).toBe(1);expect(result.ledger.calls).toBe(2);
    expect(result.ledger.input).toBe(100);expect(result.ledger.reservedInput).toBe(1000000);expect(result.ledger.reservedOutput).toBe(16384);
    expect(result.ledger.historicalUnknownCalls[0].call).toBe(2);expect(result.priorElapsedMs).toBe(2500);expect(result.boot).toBe('old');
    if(reason==='monitor_lease_expired') {
      const expired={...stop,at:new Date(21000).toISOString()};
      save(prior,'resource-stop.json',expired);save(prior,'worker-monitor-stop.json',expired);
      save(next,'resume.json',{...spec,priorFiles:{...spec.priorFiles,'resource-stop.json':hash(resolve(prior,'resource-stop.json')),
        'worker-monitor-stop.json':hash(resolve(prior,'worker-monitor-stop.json'))}});
      expect(()=>loadEvaluationResume(next,root)).toThrow();
      save(prior,'resource-stop.json',stop);save(prior,'worker-monitor-stop.json',stop);save(next,'resume.json',spec);
    }
    save(next,'resume.json',{...spec,reviewedUnknownCalls:[]});expect(()=>loadEvaluationResume(next,root)).toThrow();save(next,'resume.json',spec);
    writeFileSync(resolve(next,'after.mjs'),'changed');expect(()=>loadEvaluationResume(next,root)).toThrow();writeFileSync(resolve(next,'after.mjs'),'frozen bundle');
    rows(prior,'results.jsonl',[{repeat:1,variant:'before',id:'A'},{repeat:1,variant:'before',id:'A'}]);
    expect(()=>loadEvaluationResume(next,root)).toThrow(); // Original hash also binds results.
    spec.priorFiles['results.jsonl']=hash(resolve(prior,'results.jsonl'));save(next,'resume.json',spec);
    expect(()=>loadEvaluationResume(next,root)).toThrow(); // Even rehashed duplicates are rejected.
  } finally {rmSync(root,{recursive:true,force:true});}
});

it('rejects missing, stale, future and mismatched leases using the monotonic clock', () => {
  const lease = { type: 'resource-sample' as const, parent: 123, sequence: 1, sampledAt: 1795057527685, sampledMonotonicAtMs: 1000, deadlineMonotonicAtMs: 100000 };
  expect(leaseViolation(lease, 1001, 123)).toBeUndefined();
  expect(leaseViolation({...lease,sampledAt:lease.sampledAt-49}, 1001, 123)).toBeUndefined();
  expect(leaseViolation(undefined, 1001, 123)).toBe('monitor_lease_invalid');
  expect(leaseViolation(lease, 1001, 124)).toBe('monitor_lease_invalid');
  expect(leaseViolation(lease, 999, 123)).toBe('monitor_lease_expired');
  expect(leaseViolation(lease, 1000 + leaseLimits.maximumAgeMs, 123)).toBe('monitor_lease_expired');
  expect(leaseViolation(lease, 100000, 123)).toBe('time_limit');
});

// Real IPC processes: stop during an indefinitely pending task, without relying
// on a supervisor signal handler or a completed model response.
it.each(['death', 'stalled', 'replayed', 'deadline', 'clock_reversed'] as const)('checks an in-flight worker when its monitor is %s', async mode => {
  const helper = fileURLToPath(new URL('../scripts/assistant-monitor-lease.mts', import.meta.url));
  const workerCode = `import {requireResourceMonitor} from ${JSON.stringify(helper)};
    await requireResourceMonitor(reason=>{process.stdout.write(reason+'\\n');process.exit(42)},lease=>process.stdout.write('lease '+lease.sequence+'\\n'));
    process.stdout.write('ready\\n'); await new Promise(()=>{});`;
  const parentCode = `import {spawn} from 'node:child_process';
    const child=spawn(process.execPath,['--input-type=module','-e',${JSON.stringify(workerCode)}],{stdio:['ignore','inherit','inherit','ipc']});
    child.on('exit',code=>process.exit(code));
    const now=()=>Number(process.hrtime.bigint()/1_000_000n);
    const wall=Date.now();const lease={type:'resource-sample',parent:process.pid,sequence:1,sampledAt:wall,sampledMonotonicAtMs:now(),deadlineMonotonicAtMs:now()+${mode === 'deadline' || mode === 'clock_reversed' ? 900 : 30000}};
    child.send(lease);
    ${mode === 'replayed' ? 'setTimeout(()=>child.send(lease),500);' : ''}
    ${mode === 'clock_reversed' ? 'setTimeout(()=>child.send({...lease,sequence:2,sampledAt:wall-49,sampledMonotonicAtMs:now()}),200);' : ''}`;
  const parent = spawn(process.execPath, ['--input-type=module', '-e', parentCode], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  parent.stdout.on('data', chunk => {
    output += chunk;
    if (mode === 'death' && output.includes('ready')) parent.kill('SIGKILL');
  });
  try {
    await once(parent, 'close');
    expect(output).toContain('ready');
    if(mode==='clock_reversed')expect(output).toContain('lease 2');
    expect(output).toContain({ death: 'monitor_disconnected', stalled: 'monitor_lease_expired', replayed: 'monitor_lease_invalid', deadline: 'time_limit', clock_reversed: 'time_limit' }[mode]);
  } finally { parent.kill('SIGKILL'); }
}, 15000);

const baseline = { at: '2026-11-17T00:00:00Z', boot: '100', swapouts: 12, pressure: 1, free: 4 * 2 ** 30, rss: 100 * 2 ** 20 };
it('retains the original boot and swapout counter, including nonzero historical swapouts', () => {
  expect(violation(baseline, { ...baseline, rss: limits.treeRss, free: limits.minimumFree }, 10)).toBeUndefined();
  expect(violation(baseline, { ...baseline, boot: '101' }, 0)).toBe('boot_changed');
  expect(violation(baseline, { ...baseline, swapouts: 13 }, 0)).toBe('swapouts_changed');
  expect(violation(baseline, { ...baseline, swapouts: 0 }, 0)).toBe('swapouts_changed');
});
it.each([
  [{ pressure: 2 }, 0, 'memory_pressure'],
  [{ free: limits.minimumFree - 1 }, 0, 'memory_headroom'],
  [{ rss: limits.treeRss + 1 }, 0, 'tree_rss'],
  [{}, limits.milliseconds, 'time_limit'],
] as const)('fails closed at each agreed resource boundary', (change, elapsed, expected) => {
  expect(violation(baseline, { ...baseline, ...change }, elapsed)).toBe(expected);
});
