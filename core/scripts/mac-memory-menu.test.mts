import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { computeRss, memoryBudget } from './mac-memory-menu.mts';

const GiB = 2 ** 30, MiB = 2 ** 20;
const root = resolve(import.meta.dirname, '../..');
const native = resolve(root, 'solver/experiments/cube48opt-rust/target/opt10/release/cube48opt-research');
const lock = { pid: 100, backend: 'opt10', entry: 'native', mode: 'generate-opt10', boot: 'same-boot' };
const nativeCommand = (mode = 'generate-opt10') => `${native} ${mode} ${resolve(root, '.tmp/cubeopt-reverse/opt9-generated/small-memory.bin')} ${resolve(root, '.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat')} ${mode === 'generate-opt10' ? '16' : '8 20 0'}`;
const command = (mode = 'generate-opt10') => `node --experimental-strip-types solver/experiments/cube48opt-rust/guard.mts opt10-v2 ${nativeCommand(mode)}`;
const identity = { guardCwd: root, commands: { 101: nativeCommand() } };
const process = (pid: number, ppid: number, name: string, rssBytes: number, state = 'S') =>
  ({ pid, ppid, name, rssBytes, cpuPercent: 0, state });
const processes = [process(100, 1, 'node', 64 * MiB), process(101, 100, 'cube48opt-research', Math.round(29.2 * GiB))];

test('Opt10 anonymous allocation does not subtract the screenshot RSS twice', () => {
  const available = 13 * GiB;
  assert.equal(((available - computeRss(processes, 0)) / GiB).toFixed(1), '-16.2');
  const budget = memoryBudget(processes, 0, available, lock, lock.boot, command(), identity);
  assert.equal(budget.marginBytes, available);
  assert.equal(budget.reservedRssBytes, 0);
  assert.equal(budget.rssBytes, 64 * MiB + Math.round(29.2 * GiB));
  assert.equal(budget.anonymousRssBytes, budget.rssBytes);
  assert.equal(budget.opt10Mode, 'generate-opt10');
});

test('Opt10 solve tree is exempt while H48 mmap and unknown owner trees remain reserved', () => {
  const rows = [process(100, 1, 'node', 64 * MiB), process(101, 100, 'time', 16 * MiB),
    process(102, 101, 'cube48opt-research', 20 * GiB), process(200, 1, 'solve_h48_h10', 8 * GiB),
    process(300, 1, 'unknown-compute', GiB), process(301, 300, 'unknown-worker', GiB / 2)];
  const solveIdentity = { guardCwd: root, commands: {101:`/usr/bin/time -l ${nativeCommand('solve-opt10')}`,102:nativeCommand('solve-opt10')} };
  const budget = memoryBudget(rows, 300, 13 * GiB, { ...lock, mode: 'solve-opt10' }, lock.boot, command('solve-opt10'),solveIdentity);
  assert.equal(budget.anonymousRssBytes, 20 * GiB + 80 * MiB);
  assert.equal(budget.reservedRssBytes, 9.5 * GiB);
  assert.equal(budget.marginBytes, 3.5 * GiB);
  assert.equal(budget.rssBytes, 29.5 * GiB + 80 * MiB);
  assert.equal(budget.opt10Mode, 'solve-opt10');
  const conservative = memoryBudget(rows, 300, 13 * GiB, null, lock.boot);
  assert.equal(conservative.reservedRssBytes, computeRss(rows, 300));
  assert.equal(conservative.marginBytes, -16.5 * GiB);
});

test('missing, stale or reused guard identities fall back to the previous conservative formula', () => {
  for (const changed of [null, {}, { ...lock, pid: 0 }, { ...lock, pid: '100' }, { ...lock, pid: 999 },
    { ...lock, backend: 'h48' }, { ...lock, entry: 'other' }, { ...lock, mode: 'verify-opt1' }, { ...lock, boot: 'old-boot' }]) {
    const result = memoryBudget(processes, 0, 13 * GiB, changed, lock.boot, command(), identity);
    assert.equal(result.reservedRssBytes, computeRss(processes, 0));
    assert.equal(result.opt10Mode, null);
  }
  for (const text of ['', 'node unrelated-script.mjs', command('solve-opt10'), command().replace(native, 'unknown-binary')]) {
    assert.equal(memoryBudget(processes, 0, 13 * GiB, lock, lock.boot, text, identity).anonymousRssBytes, 0);
  }
  for (const rows of [processes.slice(1), [process(100, 1, 'node', 64 * MiB, 'Z'), processes[1]],
    [process(100, 1, 'other-app', 64 * MiB), processes[1]], [processes[0], { ...processes[1], ppid: 1 }]]) {
    assert.equal(memoryBudget(rows, 0, 13 * GiB, lock, lock.boot, command(), identity).anonymousRssBytes, 0);
  }
  assert.equal(memoryBudget(processes, 0, 13 * GiB, lock, '', command()).anonymousRssBytes, 0);
});

test('only the actual Node guard entry and resolved working directory establish identity', () => {
  for (const text of [command().replace('node --experimental-strip-types', 'node unrelated.mjs'),
    command().replace('node --experimental-strip-types', 'node --eval unrelated'), command()+' extra']) {
    assert.equal(memoryBudget(processes,0,13*GiB,lock,lock.boot,text,identity).anonymousRssBytes,0);
  }
  for (const changed of [{}, {guardCwd:'/another/checkout',commands:identity.commands}, {guardCwd:root,commands:{}},
    {guardCwd:root,commands:{101:nativeCommand().replace(native,'/another/cube48opt-research')}}]) {
    assert.equal(memoryBudget(processes,0,13*GiB,lock,lock.boot,command(),changed).anonymousRssBytes,0);
  }
  const absolute=command().replace(' solver/experiments/',' '+root+'/solver/experiments/');
  assert.equal(memoryBudget(processes,0,13*GiB,lock,lock.boot,absolute,{commands:identity.commands}).anonymousRssBytes,computeRss(processes,0)+64*MiB);
});

test('unknown siblings, native descendants and H48 descendants are never anonymously exempt', () => {
  const rows=[...processes,process(201,100,'unknown-worker',GiB),process(202,101,'solve_h48_h10',8*GiB),
    process(203,202,'another-worker',GiB/2)];
  const budget=memoryBudget(rows,0,13*GiB,lock,lock.boot,command(),identity);
  assert.equal(budget.anonymousRssBytes,64*MiB+Math.round(29.2*GiB));
  assert.equal(budget.reservedRssBytes,9.5*GiB);
  assert.equal(budget.marginBytes,3.5*GiB);
  const wrapped=[processes[0],process(101,100,'unknown-wrapper',MiB),process(102,101,'cube48opt-research',20*GiB)];
  const wrongWrapper={guardCwd:root,commands:{101:`unknown-wrapper ${nativeCommand()}`,102:nativeCommand()}};
  const conservative=memoryBudget(wrapped,0,13*GiB,lock,lock.boot,command(),wrongWrapper);
  assert.equal(conservative.anonymousRssBytes,0);
  assert.equal(conservative.reservedRssBytes,20*GiB+65*MiB);
});

test('idle memory equals the system estimate and does not invent a calculation', () => {
  const budget = memoryBudget([process(400, 1, 'ordinary-app', 5 * GiB)], 0, 13 * GiB, lock, lock.boot, command());
  assert.deepEqual(budget, { rssBytes: 0, anonymousRssBytes: 0, reservedRssBytes: 0, marginBytes: 13 * GiB, opt10Mode: null });
});

test('official Opt10 solve has the same anonymous budget; official generation is never exempt',()=>{
  const official=native.replace('/opt10/','/opt10-official/');
  for(const mode of ['solve-opt10','generate-opt10']) {
    const nativeLine=nativeCommand(mode).replace(native,official);
    const result=memoryBudget(processes,0,13*GiB,{...lock,mode},lock.boot,command(mode).replace(native,official),
      {guardCwd:root,commands:{101:nativeLine}});
    assert.equal(result.anonymousRssBytes,mode==='solve-opt10'?64*MiB+Math.round(29.2*GiB):0);
  }
});
