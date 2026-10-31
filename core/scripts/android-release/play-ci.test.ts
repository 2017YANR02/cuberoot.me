import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ANDROID_RELEASE_CERTIFICATE, releaseIdentity } from '../../packages/shared/src/android-release.ts';
import { main, parsePlayArtifact, verifyPlayBytes } from './play-ci.ts';

const bytes = Buffer.from('signed bundle fixture');
const commit = 'a'.repeat(40);
const notes = 'Release notes';
const artifact = { schemaVersion: 1, applicationId: 'me.cuberoot.app', ...releaseIdentity(7), commit,
  sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, certificateSha256: ANDROID_RELEASE_CERTIFICATE, notes };

test('Play submission binds bytes to the exact source, release sequence and production certificate', () => {
  const parsed = parsePlayArtifact(artifact, 7, commit, notes);
  verifyPlayBytes(bytes, parsed);
  assert.throws(() => verifyPlayBytes(Buffer.from('tampered bundle bytes'), parsed));
  for (const patch of [{ versionCode: 1000008 }, { versionName: '1.0.8' }, { commit: 'b'.repeat(40) },
    { applicationId: 'me.cuberoot.app.debug' }, { certificateSha256: 'f'.repeat(64) }, { notes: 'Other notes' }, { sha256: 'invalid' }]) {
    assert.throws(() => parsePlayArtifact({ ...artifact, ...patch }, 7, commit, notes));
  }
  assert.throws(() => parsePlayArtifact({ ...artifact, notes: 'a'.repeat(501) }, 7, commit, 'a'.repeat(501)));
});

test('Play entry rejects a local run or invalid mode before accessing files or credentials', async () => {
  await assert.rejects(main(['submit', '/nonexistent', 'production'], {}), /restricted to CI/);
  await assert.rejects(main(['upload', '/nonexistent', 'production'], { GITHUB_ACTIONS: 'true' }), /Expected prepare/);
});
