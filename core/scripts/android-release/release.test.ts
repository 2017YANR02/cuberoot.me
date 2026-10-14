import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANDROID_RELEASE_CERTIFICATE, parseAndroidRelease } from '../../packages/shared/src/android-release.ts';
import { parseOptions } from './options.ts';
const release = { schemaVersion: 1, applicationId: 'me.cuberoot.app', channel: 'direct', versionName: '0.1.0', versionCode: 1005, minSdk: 26, url: 'https://static.cuberoot.me/downloads/android/CubeRoot-0.1.0-1005.apk', sha256: 'a'.repeat(64), certificateSha256: ANDROID_RELEASE_CERTIFICATE, size: 100, commit: 'b'.repeat(40), publishedAt: '2026-10-14T00:00:00Z' };
test('accepts a versioned official release and rejects unsafe update identities', () => {
  assert.equal(parseAndroidRelease(release).versionCode, 1005);
  for (const change of [{ url: 'https://evil.example/app.apk' }, { url: release.url + '?next=bad' }, { channel: 'play' }, { applicationId: 'me.cuberoot.app.debug' }, { versionCode: 1004 }, { versionCode: NaN }, { certificateSha256: 'a'.repeat(64) }, { size: 0 }, { commit: '../bad' }, { publishedAt: 'invalid' }]) {
    assert.throws(() => parseAndroidRelease({ ...release, ...change }));
  }
});
test('formal build is manual and contains no production signing secrets', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/android_release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|schedule):/m);
  assert.doesNotMatch(workflow, /secrets\./);
});
test('release arguments fail closed instead of accidentally publishing', () => {
  for (const args of [['--build-onyl'], ['--resume'], ['--play'], ['--play', '--build-only'], ['--play', 'beta'], ['--only-play'], ['--build-only', '--build-only']]) assert.throws(() => parseOptions(args));
  assert.equal(parseOptions(['--play', 'production', '--build-only']).flags.has('--build-only'), true);
});
