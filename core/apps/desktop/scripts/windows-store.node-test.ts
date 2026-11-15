import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readIdentity, renderManifest, verifyX64Executable } from './windows-store.ts';

const env = {
  WINDOWS_STORE_IDENTITY_NAME: '12345.CubeRoot',
  WINDOWS_STORE_PUBLISHER: 'CN=00000000-0000-0000-0000-000000000000',
  WINDOWS_STORE_PUBLISHER_DISPLAY_NAME: 'Test & Co',
  WINDOWS_STORE_VERSION: '1.2.3.0',
};

test('requires explicitly supplied identity fields without a brand fallback', () => {
  for (const key of Object.keys(env)) assert.throws(() => readIdentity({ ...env, [key]: '' }));
  for (const name of ['YOUR_IDENTITY', '../escape', 'A'.repeat(51)]) {
    assert.throws(() => readIdentity({ ...env, WINDOWS_STORE_IDENTITY_NAME: name }));
  }
});

test('Store version rejects reserved revision, overflow, zero major and non-canonical input', () => {
  for (const version of ['1.2.3', '0.1.0.0', '1.2.3.1', '1.65536.0.0', '1.2.03.0', '1.2.3.0-beta', '1.2.3.0\n']) {
    assert.throws(() => readIdentity({ ...env, WINDOWS_STORE_VERSION: version }));
  }
  assert.equal(readIdentity({ ...env, WINDOWS_STORE_VERSION: '65535.65535.65535.0' }).version, '65535.65535.65535.0');
});

test('manifest escapes publisher fields and passes the entire callback URI as one argument', () => {
  const manifest = renderManifest(readIdentity({ ...env, WINDOWS_STORE_PUBLISHER: 'CN="Test & Co"' }));
  assert.ok(manifest.includes('Publisher="CN=&quot;Test &amp; Co&quot;"'));
  assert.ok(manifest.includes('<PublisherDisplayName>Test &amp; Co</PublisherDisplayName>'));
  assert.ok(manifest.includes('Name="me.cuberoot.app" Parameters="&quot;%1&quot;"'));
  assert.ok(manifest.includes('ProcessorArchitecture="x64"'));
});

test('packaging rejects non-PE, truncated PE and mismatched architecture', () => {
  assert.throws(() => verifyX64Executable(Buffer.from('not an executable')));
  const pe = Buffer.alloc(128);
  pe.write('MZ'); pe.writeUInt32LE(64, 0x3c); pe.write('PE\0\0', 64); pe.writeUInt16LE(0x8664, 68);
  assert.doesNotThrow(() => verifyX64Executable(pe));
  pe.writeUInt16LE(0xaa64, 68);
  assert.throws(() => verifyX64Executable(pe));
  pe.writeUInt32LE(127, 0x3c);
  assert.throws(() => verifyX64Executable(pe));
});
