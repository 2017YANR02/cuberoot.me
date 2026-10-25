import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareReleaseVersions, parseAppReleaseRequest, parseWindowsRelease, releaseIdentity } from '../../packages/shared/src/android-release.ts';

test('release numbers are monotonic across version boundaries and reject invalid sequences', () => {
  for (const n of [1, 999, 1000, 1001, 999999]) {
    assert.equal(releaseIdentity(n).versionCode, 1000000 + n);
    if (n > 1) assert.ok(compareReleaseVersions(releaseIdentity(n).versionName, releaseIdentity(n - 1).versionName) > 0);
  }
  for (const n of [0, -1, 1.1, NaN, 1000000]) assert.throws(() => releaseIdentity(n));
});

test('Windows requires both immutable artifacts and rejects foreign URLs', () => {
  const r = { schemaVersion: 1, platform: 'windows', arch: 'x64', ...releaseIdentity(1), commit: 'a'.repeat(40), publishedAt: new Date().toISOString(), notes: 'Release', files: Object.fromEntries(['installer', 'portable'].map(kind => [kind, { url: `https://static.cuberoot.me/downloads/windows/CubeRoot-1.0.1-1000001-x64-${kind}.exe`, sha256: 'b'.repeat(64), size: 123 }])) };
  assert.equal(parseWindowsRelease(r).versionName, '1.0.1');
  assert.throws(() => parseWindowsRelease({ ...r, files: { installer: r.files.installer } }));
  assert.throws(() => parseWindowsRelease({ ...r, files: { ...r.files, portable: { ...r.files.portable, url: 'https://evil.example/a.exe' } } }));
});

test('release requests accept only a fixed platform and exact source commit', () => {
  const r = { requestId: '12345678-1234-4234-8234-123456789012', platform: 'both', commit: 'a'.repeat(40), notes: 'Fix timing' };
  assert.equal(parseAppReleaseRequest(r).platform, 'both');
  for (const patch of [{ platform: 'ios' }, { commit: 'main' }, { notes: '' }, { requestId: '../file' }, { token: 'secret' }]) assert.throws(() => parseAppReleaseRequest({ ...r, ...patch }));
});
