// Bounded file fixtures only: no WASM instantiation, large table or solving.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { verifyTableBundle } from './oracle.mjs';
import { getVariant } from './variants.mjs';
import { researchPolicy } from './guard.mts';
import { blockedCompute } from '../../../.codex/hooks/block-unprotected-memory-compute.mts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const source = dirname(fileURLToPath(import.meta.url));
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'cubeopt-init-'));
  const variant = { ...getVariant('6'), tableBytes: 128, smallMemoryBytes: 64 };
  const table = Buffer.alloc(variant.tableBytes, 42), small = Buffer.alloc(variant.smallMemoryBytes, 7);
  const metadata = { schema: 'cuberoot.cube48opt6.table.v1', wasmSha256: variant.wasmSha256,
    wrapperSha256: variant.wrapperSha256, tableBytes: variant.tableBytes, tableSha256: hash(table),
    tablePath: '/another-machine/old-location.dat' };
  writeFileSync(join(directory, variant.tableName), table);
  writeFileSync(join(directory, 'small-memory.bin'), small);
  writeFileSync(join(directory, 'table.json'), JSON.stringify(metadata));
  writeFileSync(join(directory, 'small-tables.json'), JSON.stringify({ schema: 'cuberoot.cube48opt6.small-tables.v1',
    bytes: variant.smallMemoryBytes, sha256: hash(small), file: '/another-machine/small-memory.bin' }));
  return { directory, variant, metadata };
}

test('complete bundles can move between machines and are reused without rewriting', async () => {
  const f = fixture();
  const moved = `${f.directory}-moved`;
  renameSync(f.directory, moved);
  try {
    const before = readFileSync(join(moved, 'table.json'));
    const result = await verifyTableBundle(moved, f.variant);
    assert.equal(result.reused, true);
    assert.equal(result.tablePath, join(moved, f.variant.tableName));
    assert.deepEqual(readFileSync(join(moved, 'table.json')), before);
  } finally { rmSync(moved, { recursive: true }); }
});

test('incomplete, wrong-variant and corrupted bundles fail without replacing files', async () => {
  const f = fixture();
  try {
    await assert.rejects(verifyTableBundle(f.directory, { ...f.variant, id: 5 }), /variant/);
    writeFileSync(join(f.directory, 'small-memory.bin'), Buffer.alloc(64, 8));
    await assert.rejects(verifyTableBundle(f.directory, f.variant), /checksum/);
    writeFileSync(join(f.directory, 'small-memory.bin'), Buffer.alloc(64, 7));
    writeFileSync(join(f.directory, f.variant.tableName), Buffer.alloc(128, 1));
    await assert.rejects(verifyTableBundle(f.directory, f.variant), /checksum/);
    writeFileSync(join(f.directory, f.variant.tableName), Buffer.alloc(12));
    await assert.rejects(verifyTableBundle(f.directory, f.variant), /size/);
    rmSync(join(f.directory, 'table.json'));
    await assert.rejects(verifyTableBundle(f.directory, f.variant), /ENOENT/);
    assert.equal(readFileSync(join(f.directory, f.variant.tableName)).length, 12);
  } finally { rmSync(f.directory, { recursive: true }); }
});

test('native init stays protected and its existing generator retains the full guard budget', () => {
  const root = resolve(source, '../../..');
  const args = [join(source, 'oracle.mjs'), 'generate', '/tmp/new-opt6', '--reuse'];
  const policy = researchPolicy('opt6-init-123', process.execPath, args, { CUBEOPT_VARIANT: '6' });
  assert.equal(policy.mode, 'generate');
  assert.equal(policy.variant, 6);
  assert.equal(policy.tableBytes, 1_945_681_920);
  assert.equal(policy.rssLimit, Math.ceil(1_945_681_920 * 18 / 16) + 768 * 2 ** 20);
  assert.ok(blockedCompute(`node ${args.join(' ')}`, root));
  assert.ok(blockedCompute(`${source}/target/init-cli/release/cube48opt-research init --memory 2G`, root));
  assert.equal(blockedCompute(`node ${source}/guard.mts opt6-init-123 ${process.execPath} ${args.join(' ')}`, root), undefined);
});
