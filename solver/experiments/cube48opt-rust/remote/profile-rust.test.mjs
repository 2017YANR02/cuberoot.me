import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { profilerNodeFlags } from '../wasm-benchmark.mjs';
import { conflictingProcesses, monitoredSession } from './production-benchmark.mjs';
import { assertProfileArtifact, describeProfileLogs, parseProfileArguments, PROFILE_WASM_SHA256 } from './profile-rust.mjs';

test('function 12 diagnosis accepts only the sampled V2 artifact', () => {
  assert.doesNotThrow(() => assertProfileArtifact({ artifacts: { rust: { sha256: { wasm: PROFILE_WASM_SHA256 } } } }));
  assert.throws(() => assertProfileArtifact({ artifacts: { rust: { sha256: { wasm: 'f'.repeat(64) } } } }), /pinned to the sampled V2/);
});

test('normal sessions keep empty Node flags; only controlled Linux Rust groups can profile', () => {
  assert.deepEqual(profilerNodeFlags(null, 'original', false, 'darwin'), []);
  assert.deepEqual(profilerNodeFlags('/tmp/profile', 'rust', true, 'linux'),
    ['--prof', '--logfile=/tmp/profile/v8.log', '--logfile-per-isolate', '--print-wasm-code', '--print-wasm-code-function-index=12']);
  for (const args of [['/tmp/profile', 'original', true, 'linux'], ['/tmp/profile', 'rust', false, 'linux'],
    ['/tmp/profile', 'rust', true, 'darwin'], ['relative', 'rust', true, 'linux']]) assert.throws(() => profilerNodeFlags(...args));
});
test('diagnostic CLI has no original, warmup, pass or arbitrary V8 flag option; conflicts cover parent and orphan child', async () => {
  const args = ['--fixture-input','/fixture.json','--baseline-dir','/old','--baseline-sha256','a'.repeat(64),'--out','/new'];
  assert.equal(parseProfileArguments(args).out, '/new');
  assert.throws(() => parseProfileArguments([...args,'--engine','original']));
  assert.throws(() => parseProfileArguments([...args,'--v8-flags','--prof-cpp']));
  assert.equal(conflictingProcesses([{pid:2,command:'node /other/profile-rust.mjs --out /different'},
    {pid:3,command:'node --prof --logfile=/logs/v8.log /other/wasm-benchmark.mjs --worker /input.json rust'}],1).length,2);
  await assert.rejects(monitoredSession('/none','rust','/none',{schema:'cuberoot.opt8.production-benchmark-input.v1'},
    {profileDirectory:'/none'}), /production-profile-input/);
});
test('closed profile manifest requires main plus four isolate logs bound to actual child pid', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'cubeopt-profile-files-'));
  try {
    for(let i=0;i<4;i++) writeFileSync(resolve(dir,`isolate-0x${i}-123-v8.log`),'v8-version,fixture\n');
    await assert.rejects(describeProfileLogs(dir,123), /all four/);
    writeFileSync(resolve(dir,'isolate-0x4-123-v8.log'),'v8-version,fixture\n');
    const logs = await describeProfileLogs(dir,123); assert.equal(logs.length,5); assert(logs.every(log=>/^[a-f0-9]{64}$/.test(log.sha256)));
    await assert.rejects(describeProfileLogs(dir,456), /another process/);
    writeFileSync(resolve(dir,'unexpected.txt'),'invalid'); await assert.rejects(describeProfileLogs(dir,123),/Unexpected profiler/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
