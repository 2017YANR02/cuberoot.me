import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { cpus, hostname, release } from 'node:os';
import { LIMITS, memorySettings, resolveAssets, runEngine } from '../../cube48opt-rust/remote/native-service-benchmark.mjs';

assert.equal(process.platform, 'linux'); assert.equal(process.arch, 'x64');
const [task] = process.argv.slice(2); assert(task?.startsWith('/'));
const hash = b => createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(readFileSync(p));
const identity = p => { const s = statSync(p, { bigint: true }); return Object.fromEntries(['dev','ino','size','mtimeNs','ctimeNs'].map(k => [k,String(s[k])])); };
const planBytes = readFileSync(`${task}/plan100.json`), plan = JSON.parse(planBytes), caseBytes = readFileSync(`${task}/cases100.json`), cases = JSON.parse(caseBytes);
assert.equal(hash(caseBytes), plan.casesSha256); assert.equal(cases.length, 100);
assert.equal(new Set(cases.map(c => c.id)).size, 100);
assert.deepEqual(plan.groups.map(g => g.range), [[1,100]]);
assert.equal(plan.schema, 'cuberoot.egg-h8-acceptance/v2'); assert.equal(plan.baselineReused, true);
assert.equal(plan.threads, 4); assert.equal(plan.eggLanes, 40);
const config = { store: process.env.CUBEOPT_BENCH_STORE, out: `${task}/egg100`, candidates: 'fixed egg comparison' };
assert(config.store?.startsWith('/')); mkdirSync(config.out);
const pointer = read(`${config.store}/current.json`), root = `${config.store}/bundles/${pointer.bundle}`;
const manifest = read(`${root}/manifest.json`), generation = read(`${task}/egg-h8.dat.generation.json`), build = read(`${task}/candidate/build.json`);
assert.equal(manifest.engine, 'rust-native'); assert.equal(manifest.files.binary.sha256, plan.baselineSha256);
assert.equal(generation.upstream, plan.upstream); assert.equal(generation.k, 8); assert.equal(generation.bytes, 7_782_731_776);
assert.equal(statSync(`${task}/egg-h8.dat`).size, generation.bytes);
assert.equal(build.files['cuberoot-egg'].sha256, plan.eggSha256);
const passes = [
  { label:'opt8', candidate:'opt8', kind:'native', binary:`${root}/${manifest.files.binary.path}`, sha256:plan.baselineSha256, simd:'avx2', checkIdle:true },
  { label:'egg-h8', candidate:'egg-h8', kind:'egg-native', binary:`${task}/candidate/cuberoot-egg`, sha256:plan.eggSha256, simd:'avx2', table:`${task}/egg-h8.dat`, checkIdle:true },
];
const assets = resolveAssets(config, passes, null);
const baselineInputBytes = readFileSync(`${task}/baseline-reused/input.json`);
assert.equal(hash(baselineInputBytes), plan.baselineInputSha256);
const baselineInput = JSON.parse(baselineInputBytes);
assert.equal(assets.pointerSha256, baselineInput.assets.pointerSha256);
assert.equal(assets.manifestSha256, baselineInput.assets.manifestSha256);
assert.equal(hash(readFileSync(`${task}/baseline-reused/r1-baseline/results.jsonl`)), plan.baselineResultsSha256);
assert.equal(hash(readFileSync(`${task}/baseline-reused/independent-verification.json`)), plan.baselineEvidenceSha256);
assert.deepEqual(cases.map(c=>({id:c.id,scramble:c.scramble})),baselineInput.cases.map(c=>({id:c.id,scramble:c.scramble})));
assets.extraTables = [{ path:`${task}/egg-h8.dat`, identity:identity(`${task}/egg-h8.dat`), sha256:generation.sha256 }];
const save = (name, value) => writeFileSync(`${config.out}/${name}`, JSON.stringify(value,null,2)+'\n', {flag:'wx'});
const clockTicks = Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'})); assert(clockTicks > 0);
save('input.json', { plan, planSha256:hash(planBytes), cases, passes, assets, limits:LIMITS, build, generation, clockTicks,
  harnessSha256:hash(readFileSync(new URL('../../cube48opt-rust/remote/native-service-benchmark.mjs',import.meta.url))),
  driverSha256:hash(readFileSync(import.meta.filename)), machine:{hostname:hostname(),release:release(),cpu:cpus()[0].model,logicalCpus:cpus().length,node:process.version}, memorySettings:memorySettings() });
try {
  const engines = {}, started = performance.now();
  const pass = passes.find(p=>p.kind==='egg-native');
  engines[pass.label] = (await runEngine(config, assets, cases, pass, started)).report;
  save('report.json', { complete:true, engines, measuredPasses:1, warmupCases:0, baselineReused:true, note:'User requested only egg WCA1–100. Reuse the verified same-host/same-binary Opt8 pass; no new baseline run or second group.' });
} catch (error) { save('failure.json', { error:String(error.stack) }); throw error; }
