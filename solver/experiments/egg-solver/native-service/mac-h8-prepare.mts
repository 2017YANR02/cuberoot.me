// Reconstruct missing local h8 assets under the same guard, one table at a time.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync, writeFileSync, openSync, closeSync, statSync} from 'node:fs';
import {macDir, macPrepReview, macHash} from './mac-h8-policy.mts';
const plan = JSON.parse(readFileSync(macPrepReview, 'utf8'));
const receipt = JSON.parse(readFileSync(`${macDir}/preparation-fixed-started.json`, 'utf8'));
assert.equal(receipt.guardPid, process.ppid); assert.equal(receipt.planSha256, macHash(macPrepReview));
const commands = [
  {name: 'derive-egg-h8-fixed', bin: plan.eggGen, args: [plan.h10, plan.eggOutput], env: {EGG_SOLVER_THREADS: '18'}},
  {name: 'generate-opt8', bin: process.execPath, args: [plan.opt8Oracle, 'generate', plan.opt8Output], env: {CUBEOPT_VARIANT: '8', CUBEOPT_THREADS: '18'}},
];
for (const command of commands) {
  const stdout = openSync(`${macDir}/${command.name}.stdout`, 'wx');
  const stderr = openSync(`${macDir}/${command.name}.stderr`, 'wx');
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CUBEOPT_') && !k.startsWith('EGG_SOLVER_')));
  const start = performance.now();
  const child = spawn(command.bin, command.args, {env: {...env, ...command.env}, stdio: ['ignore', stdout, stderr]});
  const code = await new Promise((ok, no) => {child.on('error', no); child.on('close', ok);});
  closeSync(stdout); closeSync(stderr);
  const result = {...command, code, seconds: (performance.now() - start) / 1000};
  writeFileSync(`${macDir}/${command.name}.exit.json`, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  assert.equal(code, 0); console.log(JSON.stringify(result));
}
assert.equal(statSync(plan.eggOutput).size, 7_782_731_776);
const opt8 = JSON.parse(readFileSync(`${plan.opt8Output}/table.json`, 'utf8'));
// This digest was computed during the initial write, not a second table scan.
assert.equal(opt8.tableSha256, '0c742e0ad31d2c6bb428ae8658fa0fe88ffe2f7ac09072dbc3eaab8fcad850f1');
writeFileSync(`${macDir}/preparation-complete.json`, JSON.stringify({completedAt: new Date().toISOString(),
  preparationSha256: macHash(macPrepReview), opt8TableSha256: opt8.tableSha256,
  egg: 'Upstream gen derive: h10/base10 collapsed to h8/base10; no gen check or input-table scan'}, null, 2) + '\n', {flag: 'wx'});
