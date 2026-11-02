import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { addRow, digestFile, extractDelta, parseFingerprintSnapshot, planIncremental, signature, type RowDigests } from '../src/competition-fingerprints.js';

const row = '333\tf\t1234\t2000TEST01\tChina\tOld2000\t2000-01-02\t{1234,-1,NULL}\tf\ta\t';
function digest(value: string, id = 'Old2000'): RowDigests { const m: RowDigests = new Map(); addRow(m, id, value); return m; }
function previous() {
  return parseFingerprintSnapshot(`# wca-row-fingerprints 1\nOld2000\t123\t${signature(digest(row).get('Old2000'))}\t${signature(digest('person').get('Old2000'))}\n# end\n`);
}
it('preserves snapshot labels for equal contents regardless of their original algorithm', () => {
  const plan = planIncremental(previous(), digest(row), digest('person'));
  expect([...plan.changed]).toEqual([]);
  expect(plan.hashes.get('Old2000')).toBe(123n);
  const again = previous(); again.get('Old2000')!.hash = 987654321n;
  expect(planIncremental(again, digest(row), digest('person')).hashes.get('Old2000')).toBe(987654321n);
});
it('detects country-only and person-only changes, additions and deletions', () => {
  expect([...planIncremental(previous(), digest(row.replace('China', 'Hong Kong')), digest('person')).changed]).toEqual(['Old2000']);
  expect([...planIncremental(previous(), digest(row), digest('changed person')).changed]).toEqual(['Old2000']);
  expect([...planIncremental(previous(), digest(row, 'New2026'), new Map()).changed]).toEqual(['New2026', 'Old2000']);
  expect([...planIncremental(previous(), new Map(), new Map()).changed]).toEqual(['Old2000']);
});
it('retains duplicate multiplicity while ignoring row order', () => {
  const a = digest('a'); addRow(a, 'Old2000', 'b');
  const b = digest('b'); addRow(b, 'Old2000', 'a');
  expect(signature(a.get('Old2000'))).toBe(signature(b.get('Old2000')));
  addRow(b, 'Old2000', 'a'); addRow(b, 'Old2000', 'a');
  expect(signature(a.get('Old2000'))).not.toBe(signature(b.get('Old2000')));
});
it('fails closed for absent, malformed, unknown-version or duplicate snapshots', () => {
  for (const text of ['', '# wca-row-fingerprints 1\n', 'Old2000\t123\n', '# wca-row-fingerprints 2\n', '# wca-row-fingerprints 1\nOld2000\t123\t0:0:0', '# wca-row-fingerprints 1\nA\t1\t0:0:0\t0:0:0\nA\t1\t0:0:0\t0:0:0']) {
    expect(() => parseFingerprintSnapshot(text)).toThrow();
  }
});
it('extracts only changed competitions and supports a zero-change day', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'stats-delta-'));
  try {
    const source = join(dir, 'source'), target = join(dir, 'delta');
    await writeFile(source, row + '\n' + row.replace('Old2000', 'New2026') + '\n');
    expect((await digestFile(source, 5)).size).toBe(2);
    expect(await extractDelta(source, target, 5, new Set(['New2026']))).toBe(1);
    expect(await readFile(target, 'utf8')).toBe(row.replace('Old2000', 'New2026') + '\n');
    await writeFile(source, row + '\n');
    expect(await extractDelta(source, target, 5, new Set())).toBe(0);
    expect(await readFile(target, 'utf8')).toBe('');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
