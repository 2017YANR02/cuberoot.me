import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANDROID_RELEASE_CERTIFICATE, parseAndroidRelease } from '../../packages/shared/src/android-release.ts';
import { parseOptions } from './options.ts';
import { affectsAndroidBuild } from './inputs.ts';
import { release as dispatchRelease } from './release.ts';
const release = { schemaVersion: 1, applicationId: 'me.cuberoot.app', channel: 'direct', versionName: '0.1.0', versionCode: 1005, minSdk: 26, url: 'https://static.cuberoot.me/downloads/android/CubeRoot-0.1.0-1005.apk', sha256: 'a'.repeat(64), certificateSha256: ANDROID_RELEASE_CERTIFICATE, size: 100, commit: 'b'.repeat(40), publishedAt: '2026-10-14T00:00:00Z' };
test('accepts a versioned official release and rejects unsafe update identities', () => {
  assert.equal(parseAndroidRelease(release).versionCode, 1005);
  for (const change of [{ url: 'https://evil.example/app.apk' }, { url: release.url + '?next=bad' }, { channel: 'play' }, { applicationId: 'me.cuberoot.app.debug' }, { versionCode: 1004 }, { versionCode: NaN }, { certificateSha256: 'a'.repeat(64) }, { size: 0 }, { commit: '../bad' }, { publishedAt: 'invalid' }]) {
    assert.throws(() => parseAndroidRelease({ ...release, ...change }));
  }
});
test('official release is manual and uses a protected environment', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/app_release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|schedule):/m);
  assert.match(workflow, /environment: app-release/);
});
test('release arguments fail closed instead of accidentally publishing', () => {
  for (const args of [['--build-onyl'], ['--resume'], ['--play'], ['--play', '--build-only'], ['--play', 'beta'], ['--only-play'], ['--build-only', '--build-only']]) assert.throws(() => parseOptions(args));
  assert.equal(parseOptions(['--play', 'production', '--build-only']).buildOnly, true);
  assert.equal(parseOptions(['--play', 'production', '--only-play']).onlyPlay, true);
  assert.throws(() => parseOptions(['--platform', 'windows', '--play', 'production']));
  assert.throws(() => parseOptions(['--platform', 'both', '--play', 'production', '--only-play']));
  assert.throws(() => parseOptions(['--platform', 'play']));
  assert.throws(() => parseOptions(['--notes', '   ']));
  assert.equal(parseOptions([]).platform, 'android');
  assert.equal(parseOptions(['--platform', 'both']).platform, 'both');
});
test('CLI dispatches exact main once and watches the matching request', async () => {
  const calls: string[][] = [];
  await dispatchRelease(['--platform', 'windows', '--notes', 'A release'], {
    uuid: () => 'request-1', log: () => {}, sleep: async () => {},
    gh: args => {
      calls.push(args);
      if (args[0] === 'api') return JSON.stringify({ sha: 'a'.repeat(40), commit: { message: 'Main title' } });
      if (args[1] === 'list') return JSON.stringify([{ databaseId: 42, displayTitle: 'App release request-1', url: 'https://github.com/run/42' }]);
      return '';
    },
  });
  assert.equal(calls.filter(args => args[0] === 'workflow').length, 1);
  const dispatch = calls.find(args => args[0] === 'workflow')!;
  assert.ok(dispatch.includes('app_release.yml'));
  assert.ok(dispatch.includes(`source_commit=${'a'.repeat(40)}`));
  assert.ok(dispatch.includes('platform=windows'));
  assert.ok(dispatch.includes('notes=A release'));
  assert.ok(dispatch.includes('play_track=none'));
  assert.ok(dispatch.includes('only_play=false'));
  assert.ok(dispatch.includes('build_only=false'));
  assert.deepEqual(calls.at(-1), ['run', 'watch', '42', '--repo', '2017YANR02/cuberoot.me', '--exit-status']);
});
test('explicit Play-only build keeps the requested channel without publishing website packages', async () => {
  let inputs: string[] = [];
  await dispatchRelease(['--play', 'production', '--only-play', '--build-only'], {
    uuid: () => 'play-request', log: () => {}, sleep: async () => {},
    gh: args => {
      if (args[0] === 'api') return JSON.stringify({ sha: 'b'.repeat(40), commit: { message: 'Play release' } });
      if (args[0] === 'workflow') inputs = args;
      if (args[1] === 'list') return JSON.stringify([{ databaseId: 43, displayTitle: 'App release play-request', url: 'https://github.com/run/43' }]);
      return '';
    },
  });
  for (const value of ['platform=android', 'play_track=production', 'only_play=true', 'build_only=true']) assert.ok(inputs.includes(value));
});
test('unknown dispatch outcome is not retried and local recovery never contacts GitHub', async () => {
  let dispatches = 0;
  const deps = { uuid: () => 'request-1', log: () => {}, sleep: async () => {}, gh: (args: string[]) => {
    if (args[0] === 'api') return JSON.stringify({ sha: 'a'.repeat(40), commit: { message: 'Main title' } });
    dispatches++;
    throw new Error('Network timeout');
  } };
  await assert.rejects(dispatchRelease([], deps), /outcome is unknown/);
  assert.equal(dispatches, 1);
  await assert.rejects(dispatchRelease(['--resume', '/tmp/old'], { ...deps, gh: () => { assert.fail('must not contact GitHub'); } }), /no longer/);
});
test('oversized Play notes fail before requesting a release', async () => {
  await assert.rejects(dispatchRelease(['--play', 'production', '--notes', 'a'.repeat(501)], {
    uuid: () => { assert.fail('must not start a release'); }, log: () => {}, sleep: async () => {},
    gh: args => {
      assert.equal(args[0], 'api');
      return JSON.stringify({ sha: 'a'.repeat(40), commit: { message: 'Main title' } });
    },
  }), /at most 500/);
});
test('website/API-only work skips APK builds while shared/native changes are included', () => {
  for (const path of ['core/packages/client/app/page.tsx', 'core/apps/api/src/index.ts', 'docs/app-downloads.md']) assert.equal(affectsAndroidBuild(path), false);
  for (const path of ['core/packages/timer-ui/src/Timer.tsx', 'core/packages/shared/src/rule.ts', 'core/apps/mobile/src/capacitor-host.ts', 'core/pnpm-lock.yaml', 'core/scripts/build-cubing-worker.mjs']) assert.equal(affectsAndroidBuild(path), true);
});
