import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPushConfig, loadPushEnv, reportPushConfig } from './android-push-config.ts';

test('empty optional config is disabled; required app/vendor omissions fail', () => {
  assert.deepEqual(checkPushConfig({}, 'release').errors, []);
  assert.equal(checkPushConfig({}, 'release').rows[0].status, 'disabled');
  assert.ok(checkPushConfig({ ANDROID_PUSH_REQUIRED: 'true' }, 'release').errors.length);
  assert.ok(checkPushConfig({ GETUI_APP_ID: 'fixture', ANDROID_PUSH_VENDORS: 'oppo' }, 'release').errors.length);
  assert.ok(checkPushConfig({ ANDROID_PUSH_REQUIRED: 'tru' }, 'release').errors.length);
  assert.ok(checkPushConfig({ ANDROID_PUSH_VENDORS: 'unknown' }, 'release').errors.length);
});

test('partial vendor configuration and absent base fail; debug never borrows release', () => {
  const env = { GETUI_APP_ID: 'fixture', GETUI_OPPO_APP_KEY: 'fixture' };
  assert.ok(checkPushConfig(env, 'release').errors.some(error => error.includes('GETUI_OPPO_APP_SECRET')));
  const complete = { ...env, GETUI_OPPO_APP_SECRET: 'fixture' };
  assert.deepEqual(checkPushConfig(complete, 'release').errors, []);
  assert.ok(checkPushConfig({ GETUI_OPPO_APP_KEY: 'fixture', GETUI_OPPO_APP_SECRET: 'fixture' }, 'release').errors.length);
  assert.ok(checkPushConfig({ ...complete, ANDROID_PUSH_REQUIRED: 'true' }, 'debug').errors.some(error => error.includes('GETUI_DEBUG_APP_ID')));
});

test('local file rejects server/unknown keys and shell values win', () => {
  const dir = mkdtempSync(join(tmpdir(), 'android-push-'));
  const path = join(dir, '.env');
  try {
    writeFileSync(path, 'GETUI_APP_ID=filefixture\n');
    assert.equal(loadPushEnv(path, { GETUI_APP_ID: 'shellfixture' }).GETUI_APP_ID, 'shellfixture');
    writeFileSync(path, 'GETUI_MASTER_SECRET=privatefixture\n');
    assert.throws(() => loadPushEnv(path, {}), /unsupported keys/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('report never exposes credential values, even malformed values', (context) => {
  const output: string[] = [];
  context.mock.method(console, 'log', (line: string) => output.push(line));
  context.mock.method(console, 'error', (line: string) => output.push(line));
  for (const value of ['privatefixture', 'privatefixture\n<xml>']) {
    assert.equal(reportPushConfig({ GETUI_APP_ID: value, ANDROID_PUSH_REQUIRED: 'true' }, 'release'), !value.includes('\n'));
  }
  assert.ok(!output.join('\n').includes('privatefixture'));
});
