import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, mkdirSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { guard, GiB, repairTail, atomicJson, readJson, selectBatch, claimOwner, selectPairBatch, pairGroup, CsvTail, askSolverThreads, batchFailureReason, batchFailure, recoverableStartupStop, waitForStartupMemory } from './double-zbll-symmetry-state.mjs';

const baseline = { boot: 'same-boot', baselineSwapouts: 10 };
test('reviewed continuation keeps old counter and stops on any further swap-out',()=>{
  const reviewed={boot:'same-boot',baselineSwapouts:0,reviewedSwapouts:48};
  const memory={boot:'same-boot',swapouts:48,pressure:1,available:40*GiB,disk:100*GiB};
  assert.equal(guard(memory,reviewed,0),null);
  assert.match(guard({...memory,swapouts:49},reviewed,0)!,/48 → 49/);
  assert.match(guard(memory,{...reviewed,status:'protected-stop'},0)!,/上次已触发/);
  assert.equal(reviewed.baselineSwapouts,0);
});
const normal = { boot: 'same-boot', swapouts: 10, pressure: 1, available: 40 * GiB, disk: 100 * GiB };
test('identified anonymous memory is counted once without relaxing RSS, swap or minimum headroom', () => {
  const loaded = {...normal,available:9*GiB};
  assert.match(guard(loaded,baseline,29*GiB)!,/2 GiB/);
  assert.equal(guard(loaded,baseline,29*GiB,false,0.5*GiB),null);
  assert.match(guard(loaded,baseline,33*GiB,false,0.5*GiB)!,/32 GiB/);
  assert.match(guard({...loaded,available:2*GiB},baseline,29*GiB,false,0.5*GiB)!,/2 GiB/);
  assert.match(guard({...loaded,swapouts:baseline.baselineSwapouts+1},baseline,29*GiB,false,0)!,/换出/);
});
test('startup memory waits for three consecutive ready samples without weakening runtime guards', async () => {
  const samples = [33,34,34,33,34,34,34], states: number[] = [];
  let sleeps = 0;
  await waitForStartupMemory(baseline, () => ({ memory: { ...normal, available: samples.shift()! * GiB }, rss: GiB }),
    (_m, stable) => states.push(stable), async () => { sleeps++; });
  assert.deepEqual(states, [0,1,2,0,1,2]); assert.equal(sleeps,6); assert.equal(samples.length,0);
  for (const [change, message] of [
    [{ swapouts: 11 }, /换出/], [{ boot: 'reboot' }, /重新启动/], [{ pressure: 2 }, /压力/],
    [{ available: 2 * GiB }, /2 GiB/], [{ disk: 29 * GiB }, /磁盘/],
  ] as const) {
    let calls = 0;
    await assert.rejects(waitForStartupMemory(baseline, () => ({ memory: { ...normal, available: 33 * GiB, ...(calls++ ? change : {}) }, rss: GiB }),
      () => {}, async () => {}), message);
    assert.equal(calls,2);
  }
  await assert.rejects(waitForStartupMemory({ ...baseline, status: 'protected-stop' }, () => ({ memory: normal, rss: 0 }), () => {}, async () => {}), /不能自动/);
  await assert.rejects(waitForStartupMemory(baseline, () => ({ memory: normal, rss: 33 * GiB }), () => {}, async () => {}), /32 GiB/);
  await assert.rejects(waitForStartupMemory(baseline, () => { throw Error('cancelled'); }, () => {}, async () => {}), /cancelled/);
});
test('only a proven pre-table memory rejection is recoverable, never a hard protected stop', () => {
  const log = join(mkdtempSync(join(tmpdir(), 'zbll-startup-')), 'run.log');
  writeFileSync(log, 'Error: Insufficient resources: {"available":36214128640,"swapouts":10,"pressure":1}\n');
  const failure = batchFailure(log,0,1);
  const p = { ...baseline, status: 'protected-stop', reason: failure.reason, currentSwapouts: 10, memoryPressure: 1,
    activeCompleted: 0, activeVerified: 0, currentRssGiB: 0.27 };
  assert.equal(recoverableStartupStop(p,failure,false),true);
  assert.equal(recoverableStartupStop(p,failure,true),false);
  for (const change of [{ currentSwapouts: 11 }, { reason: 'New swap-out detected' }, { activeCompleted: 1 }, { currentRssGiB: 29 }, { memoryPressure: 2 }])
    assert.equal(recoverableStartupStop({ ...p,...change },failure,false),false);
  for (const text of ['{"available":36214128640,"swapouts":10,"pressure":2}', '{"available":36214128640,"pressure":1}', 'bad JSON']) {
    writeFileSync(log, 'Error: Insufficient resources: '+text+'\n');
    assert.equal(batchFailure(log,0,1).startupMemory,undefined);
  }
  assert.equal(p.baselineSwapouts,10); assert.equal(p.status,'protected-stop');
});
test('early batch failure reports its resource cause without borrowing an older launch error', () => {
  const log = join(mkdtempSync(join(tmpdir(), 'zbll-failure-')), 'run.log');
  const previous = 'Error: previous unrelated failure\n';
  writeFileSync(log, previous);
  assert.match(batchFailureReason(log, Buffer.byteLength(previous), 1), /查看/);
  appendFileSync(log, 'if(before.available<34*2**30)throw Error(...);\nError: Insufficient resources: {"available":36479139840,"swapouts":0,"pressure":1}\n    at runner:72\nNode.js v24.21.0\n');
  const reason = batchFailureReason(log, Buffer.byteLength(previous), 1);
  assert.match(reason, /33.97 GiB.*34 GiB/);
  assert.match(guard(normal, { ...baseline, status: 'protected-stop', reason }, 0)!, /上次原因：本批未启动/);
  assert.match(guard(normal, { ...baseline, status: 'protected-stop', reason }, 0)!, /不能自动重设/);
  writeFileSync(log, 'Error: Insufficient resources: {"available":40000000000,"pressure":2}\n');
  assert.match(batchFailureReason(log, 0, 1), /内存压力异常/);
  writeFileSync(log, 'Error: State verification failed 123\n');
  assert.match(batchFailureReason(log, 0, 1), /State verification failed 123/);
  writeFileSync(log, 'Error: Insufficient resources: invalid JSON\n');
  assert.match(batchFailureReason(log, 0, 1), /查看/);
});
test('thread prompt waits for input, rejects invalid counts, defaults safely and propagates cancellation', async () => {
  assert.equal(await askSolverThreads(18, async()=>''),16);
  assert.equal(await askSolverThreads(8, async()=>''),8);
  const answers=['0','19','2.5','no','Infinity','1e1',' 14 '], prompts:string[]=[];
  assert.equal(await askSolverThreads(18, async p=>{prompts.push(p);return answers.shift()!;}),14);
  assert.equal(prompts.length,7);assert.match(prompts[1],/请输入/);
  await assert.rejects(askSolverThreads(18,async()=>{throw Error('cancel');}),/cancel/);
});
test('live owner and concurrent stale-owner recovery cannot acquire a second launcher', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zbll-owner-')), file = join(dir, 'owner.pid');
  assert.equal(claimOwner(file), true);
  assert.equal(claimOwner(file), false);
  mkdirSync(file + '.claim');
  assert.throws(() => claimOwner(file), /启动检查/);
  assert.equal(readFileSync(file, 'utf8'), String(process.pid));
});
test('no automatic baseline reset across swap writes, reboot or protected stop', () => {
  assert.equal(guard(normal, baseline, 28 * GiB, true), null);
  assert.match(guard({ ...normal, swapouts: 11 }, baseline, 0)!, /换出/);
  assert.match(guard({ ...normal, boot: 'new-boot' }, baseline, 0)!, /重新启动/);
  assert.match(guard(normal, { ...baseline, status: 'protected-stop' }, 0)!, /不能自动/);
  assert.match(guard({ ...normal, pressure: 2 }, baseline, 0)!, /压力/);
  assert.match(guard({ ...normal, available: 33 * GiB }, baseline, 0, true)!, /34 GiB/);
  assert.match(guard({ ...normal, available: 29 * GiB }, baseline, 28 * GiB)!, /2 GiB/);
  assert.match(guard(normal, baseline, 33 * GiB)!, /32 GiB/);
  assert.match(guard({ ...normal, disk: 29 * GiB }, baseline, 0)!, /磁盘/);
  assert.match(guard({ ...normal, swapouts: NaN }, baseline, 0)!, /读取失败/);
});
test('partial append is backed up; complete rows survive and recovery is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zbll-checkpoint-')), file = join(dir, 'results.csv');
  const prefix = "3,2,R U\n5,1,L'\n";
  writeFileSync(file, prefix + '7,3,R'); repairTail(file);
  assert.equal(readFileSync(file, 'utf8'), prefix);
  const backup = readdirSync(dir).find(n => n.includes('.recovery-'))!;
  assert.equal(readFileSync(join(dir, backup), 'utf8'), prefix + '7,3,R');
  repairTail(file); assert.equal(readdirSync(dir).length, 2);
  atomicJson(join(dir, 'checkpoint.json'), { batch: 2, cursor: 17, pass: 0 });
  assert.deepEqual(readJson(join(dir, 'checkpoint.json')), { batch: 2, cursor: 17, pass: 0 });
});
test('PLL first, canonical representatives only, migrated IDs skipped, interrupted batches resume without gaps', async () => {
  const model = { N: 3, states: [{ caseIndex: 0 }, { caseIndex: 1 }, { caseIndex: 472 }], canonical: (a: number, b: number) => ({ id: Math.min(a * 3 + b, b * 3 + a) }) };
  const lengths = new Uint8Array(9); lengths[1] = 15; // Already migrated.
  const first = await selectBatch(model, lengths, 0, 0, 2, async () => {});
  assert.deepEqual(first, { ids: [2, 5], cursor: 6 });
  // One result saved before interruption; the same corpus retains the other ID.
  lengths[2] = 16;
  assert.deepEqual(first.ids.filter(id => !lengths[id]), [5]); lengths[5] = 17;
  const second = await selectBatch(model, lengths, first.cursor, 0, 2, async () => {});
  assert.deepEqual(second, { ids: [8], cursor: 9 }); lengths[8] = 18;
  const rest = await selectBatch(model, lengths, 0, 1, 20, async () => {});
  assert.deepEqual(rest, { ids: [0, 4], cursor: 9 });
  assert.deepEqual([...first.ids, ...second.ids, ...rest.ids, 1].sort((a, b) => a - b), [0, 1, 2, 4, 5, 8]);
});
test('pair scheduler keeps each pair contiguous, resumes missing states, and puts PLL last', async () => {
  const model = { N: 6, phases: [[0,1],[2,3],[4,5]], canonical: (a:number,b:number)=>({id:Math.min(a*6+b,b*6+a)}) };
  const lengths = new Uint8Array(36), finished:number[] = [];
  const select = (cursor:number,pass:number,limit:number)=>selectPairBatch(model,lengths,cursor,pass,limit,g=>finished.push(g.pair),async()=>{},2);
  const first = await select(0,0,4);
  assert.deepEqual(first.ids,[0,1,7]); assert.equal(first.cursor,1);
  lengths[0]=15; // Simulate interruption within a pair; replay skips only the saved row.
  assert.deepEqual((await select(0,0,4)).ids,[1,7]);
  first.ids.forEach(id=>lengths[id]=15);
  const second = await select(first.cursor,0,4);
  assert.deepEqual(second.ids,[2,3,8,9]); assert.equal(second.cursor,2);
  second.ids.forEach(id=>lengths[id]=16);
  const third = await select(second.cursor,0,4);
  assert.deepEqual(third.ids,[14,15,21]); third.ids.forEach(id=>lengths[id]=17);
  assert.deepEqual((await select(0,0,100)).ids,[]); assert.deepEqual(finished,[0,1,4]);
  const pll = await select(0,1,100);
  assert.deepEqual(pll.groups.map(g=>g.pair),[2,5,8]);
  assert.deepEqual(pairGroup(model,0,1).ids,pairGroup(model,1,0).ids);
  assert.equal(new Set([...first.ids,...second.ids,...third.ids,...pll.ids]).size,21);
});
test('live CSV verifier consumes only complete new rows and rejects truncation', () => {
  const file=join(mkdtempSync(join(tmpdir(),'zbll-tail-')),'results.csv'), tail=new CsvTail(), rows:string[]=[];
  writeFileSync(file,"1,2,R U\n2,1,"); tail.poll(file,line=>rows.push(line));
  assert.deepEqual(rows,['1,2,R U']);
  appendFileSync(file,"L\n3,1,F\n"); tail.poll(file,line=>rows.push(line)); tail.poll(file,line=>rows.push(line));
  assert.deepEqual(rows,['1,2,R U','2,1,L','3,1,F']);
  writeFileSync(file,''); assert.throws(()=>tail.poll(file,()=>{}),/缩短/);
});
