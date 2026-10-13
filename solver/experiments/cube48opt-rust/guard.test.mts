// Pure policy / 512-byte synthetic-header tests. Never open a PDB or spawn a solver.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { h48FileBytes, researchPolicy, validateH48Metadata } from './guard.mts';

const here = dirname(fileURLToPath(import.meta.url));
const native = resolve(here, 'target/release/cube48opt-research');
const sizes = [31_683_944, 61_307_240, 120_553_832, 239_047_016, 476_033_384,
  950_006_120, 1_897_951_528, 3_793_842_344, 7_585_624_040, 15_169_187_432, 30_336_314_216];
const environment = (h: number): NodeJS.ProcessEnv => ({ CUBEOPT_BACKEND: 'h48', CUBEOPT_H: String(h) });
function mainHeader(h: number) {
  const header = Buffer.alloc(512);
  const mainBytes = sizes[h] - 2_060_648;
  header.writeBigUInt64LE(512n, 176);
  header.writeBigUInt64LE(BigInt(mainBytes + 512), 184);
  header.writeBigUInt64LE(BigInt(3393 * 34650 * 2 ** h + 2 * (mainBytes / 64)), 200);
  header.writeBigUInt64LE(BigInt(mainBytes + 512), 216);
  header.write(`h48 solver h =${String(h).padStart(2, ' ')}`, 224);
  header[324] = h;
  header[325] = 2;
  header[326] = h < 4 ? 8 : h < 8 ? 9 : 10;
  header[327] = 3;
  return header;
}

test('H0–H10 use exact padded file sizes and one-table RSS budgets', () => {
  for (let h = 0; h <= 10; h++) {
    assert.equal(h48FileBytes(h), sizes[h]);
    for (const mode of ['solve-h48', 'query-h48']) {
      const p = researchPolicy('protocol-only', native, [mode, String(h), 'not-opened.dat'], environment(h));
      assert.equal(p.h, h);
      assert.equal(p.tableBytes, sizes[h]);
      assert.equal(p.rssLimit, sizes[h] + 768 * 2 ** 20);
      assert.equal(p.deadlineMs, 600_000);
      assert.equal(validateH48Metadata(h, sizes[h], mainHeader(h)), sizes[h]);
    }
  }
});

test('renamed, truncated, oversized, wrong-H and wrong-format tables are rejected from metadata', () => {
  const header = mainHeader(7);
  for (const bytes of [0, sizes[7] - 1, sizes[7] + 1, 60_670_567_784])
    assert.throws(() => validateH48Metadata(7, bytes, header));
  assert.throws(() => validateH48Metadata(7, sizes[7], header.subarray(1)));
  for (const offset of [176, 184, 200, 216, 224, 324, 325, 326, 327]) {
    const invalid = Buffer.from(header);
    invalid[offset] ^= 1;
    assert.throws(() => validateH48Metadata(7, sizes[7], invalid), `offset ${offset}`);
  }
  const disguisedH11 = Buffer.from(header);
  disguisedH11[324] = 11;
  assert.throws(() => validateH48Metadata(7, sizes[7], disguisedH11));
});

test('backend, H, entry, arity and option mismatches cannot reach a child', () => {
  for (const [args, env] of [
    [['solve-h48', '7', 'renamed.dat'], {}],
    [['solve-h48', '7', 'renamed.dat'], { CUBEOPT_BACKEND: 'h48' }],
    [['solve-h48', '7', 'renamed.dat'], environment(6)],
    [['solve-h48', '07', 'renamed.dat'], environment(7)],
    [['solve-h48', '11', 'renamed.dat'], environment(10)],
    [['query-h48', '0', 'renamed.dat'], environment(11)],
    [['solve-h11', 'renamed.dat'], { CUBEOPT_BACKEND: 'h10' }],
    [['solve-h48', '7'], environment(7)],
    [['query-h48', '7', 'renamed.dat', '8'], environment(7)],
    [['solve-h48', '7', 'renamed.dat', '9'], environment(7)],
    [['solve-h48', '7', 'renamed.dat', '2'], environment(7)],
    [['solve-h48', '7', 'renamed.dat', '0'], environment(7)],
    [['solve-h48', '7', 'renamed.dat', '8', '21'], environment(7)],
    [['solve-h48', '7', 'renamed.dat', '8', '20', '-1'], environment(7)],
    [['solve-h10', 'renamed.dat'], environment(7)],
    [['solve', 'small', 'table'], { CUBEOPT_BACKEND: 'opt', CUBEOPT_H: '7' }],
  ] as [string[], NodeJS.ProcessEnv][])
    assert.throws(() => researchPolicy('protocol-only', native, args, env), JSON.stringify({ args, env }));
  assert.throws(() => researchPolicy('protocol-only', native + '-alias', ['solve-h48', '7', 'table'], environment(7)));
  assert.throws(() => researchPolicy('protocol-only', process.execPath, ['/tmp/guard.mts', native], environment(7)));
  assert.throws(() => h48FileBytes(11));
});

test('existing Opt and H10 budgets and entry separation remain intact', () => {
  assert.equal(researchPolicy('opt1', native, ['solve', 'small', 'table'], {}).tableBytes, 30_401_280);
  assert.equal(researchPolicy('opt9', native, ['solve', 'small', 'table'], { CUBEOPT_VARIANT: '9' }).tableBytes, 15_565_455_360);
  assert.equal(researchPolicy('h10', native, ['solve-h10', 'table'], { CUBEOPT_BACKEND: 'h10' }).tableBytes, sizes[10]);
  const small = researchPolicy('small', process.execPath, [resolve(here, 'verify-h10.mjs')], { CUBEOPT_BACKEND: 'h10' });
  assert.equal(small.rssLimit, 512 * 2 ** 20);
  const sequential = researchPolicy('opt9', process.execPath, [resolve(here, 'benchmark.mjs'), 'native', 'small', 'table', 'out', '--sequential'], { CUBEOPT_VARIANT: '9' });
  assert.equal(sequential.rssLimit, 15_565_455_360 + 2 ** 30);
});

test('actual guard rejects H11 before any table or memory access, without spawning native', () => {
  const env = { ...process.env, CUBEOPT_BACKEND: 'h48', CUBEOPT_H: '11' };
  const result = spawnSync(process.execPath, [resolve(here, 'guard.mts'), 'must-not-run', native,
    'solve-h48', '11', '/does-not-exist/renamed-table.dat'],
  { env, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /H11 execution is prohibited/);
  assert.doesNotMatch(result.stderr, /ENOENT|memory observation|Insufficient memory/);
});
