import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { encodePersons, encodeRanks, encodeCounts } from '../../core/packages/shared/src/nemesizer_format.ts';
import { FILES, pack, unpack, parseManifest, assertFresh, sha } from './common.ts';
import { activate, finalize, recover } from './deploy.ts';

const commit = '1'.repeat(40);
function fixture(root: string, day = '2026-10-20', name = 'Test Person') {
  mkdirSync(join(root, 'nemesizer'), { recursive: true });
  writeFileSync(join(root, 'nemesizer/meta.json'), JSON.stringify({ exportDate: day, generatedAt: `${day}T00:00:00.000Z`, personCount: 1, rankCount: 1 }));
  writeFileSync(join(root, 'nemesizer/persons.bin.gz'), gzipSync(encodePersons({ continents: ['Asia'], persons: [{ wcaId: '2017YANR02', name, countryIso2: 'cn', continentIdx: 0 }] })));
  writeFileSync(join(root, 'nemesizer/ranks.bin.gz'), gzipSync(encodeRanks([{ personIdx: 0, eventIdx: 0, kind: 0, worldRank: 1, best: 500 }])));
  writeFileSync(join(root, 'nemesizer/counts.bin.gz'), gzipSync(encodeCounts(new Uint32Array([0]), new Uint32Array([0]))));
  writeFileSync(join(root, 'persons_search.json.gz'), gzipSync(JSON.stringify([['2017YANR02', name, 'cn']])));
}
function workspace(t: any) { const dir = mkdtempSync(join(tmpdir(), 'wca-data-test-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; }
const noop = async () => {};

test('archive preserves all bytes and rejects corruption, missing members and path substitution', t => {
  const d = workspace(t), source = join(d, 'source'), out = join(d, 'out'); fixture(source);
  const m = pack(source, out, commit), archive = join(out, m.archive.name);
  unpack(archive, m, join(d, 'extracted'));
  for (const f of FILES) assert.deepEqual(readFileSync(join(source, f)), readFileSync(join(d, 'extracted', f)));
  assert.throws(() => parseManifest({ ...m, files: m.files.slice(1) }), /inventory/);
  assert.throws(() => parseManifest({ ...m, files: m.files.map((f, i) => i ? f : { ...f, path: '../escape' }) }), /record/);
  const bad = readFileSync(archive); bad[1024] ^= 1; writeFileSync(archive, bad);
  assert.throws(() => unpack(archive, m, join(d, 'bad')), /checksum/);
});

test('invalid gzip and mixed generation counts fail before publication', t => {
  const d = workspace(t); fixture(d);
  writeFileSync(join(d, 'nemesizer/counts.bin.gz'), gzipSync(encodeCounts(new Uint32Array([0, 0]), new Uint32Array([0, 0]))));
  assert.throws(() => pack(d, join(d, 'out'), commit), /count mismatch/);
  writeFileSync(join(d, 'nemesizer/counts.bin.gz'), Buffer.from('broken'));
  assert.throws(() => pack(d, join(d, 'out'), commit));
});

test('successful switch leaves one dataset and never touches sibling static files', async t => {
  const d = workspace(t), live = join(d, 'live'), source = join(d, 'source'), out = join(d, 'out');
  fixture(live); fixture(source, '2026-10-21');
  mkdirSync(join(live, 'comp')); writeFileSync(join(live, 'comp/keep.json'), 'keep');
  const m = pack(source, out, commit), reloads: string[] = [];
  await activate(live, join(out, m.archive.name), m, async meta => { reloads.push(meta.exportDate); }, noop);
  assert.equal(existsSync(join(live, '.wca-data/transaction.json')), true);
  finalize(live, m.archive.sha256);
  assert.deepEqual(reloads, ['2026-10-21']);
  assert.deepEqual(readdirSync(join(live, '.wca-data/datasets')), [m.archive.sha256]);
  assert.equal(readFileSync(join(live, 'comp/keep.json'), 'utf8'), 'keep');
  assert.equal(existsSync(join(live, '.wca-data/legacy')), false);
  await activate(live, join(out, m.archive.name), m, noop, noop);
  finalize(live, m.archive.sha256);
});

test('failed API/static activation restores complete old data, including after a prior migration', async t => {
  const d = workspace(t), live = join(d, 'live'), source = join(d, 'source'), out = join(d, 'out');
  fixture(live); fixture(source, '2026-10-21');
  const m = pack(source, out, commit), before = FILES.map(f => sha(readFileSync(join(live, f))));
  const reloads: string[] = [];
  await assert.rejects(activate(live, join(out, m.archive.name), m, async meta => { reloads.push(meta.exportDate); }, async () => { throw new Error('static failed'); }), /static failed/);
  assert.deepEqual(FILES.map(f => sha(readFileSync(join(live, f)))), before);
  assert.deepEqual(reloads, ['2026-10-21', '2026-10-20']);
  await activate(live, join(out, m.archive.name), m, noop, noop); finalize(live, m.archive.sha256);
  fixture(source, '2026-10-22'); const n = pack(source, out, commit);
  await assert.rejects(activate(live, join(out, n.archive.name), n, async meta => { if (meta.exportDate === '2026-10-22') throw new Error('reload failed'); }, noop), /reload failed/);
  assert.equal(JSON.parse(readFileSync(join(live, 'nemesizer/meta.json'), 'utf8')).exportDate, '2026-10-21');
});

test('interrupted activation rolls back unless Release commit already succeeded', async t => {
  for (const committed of [false, true]) {
    const d = workspace(t), live = join(d, 'live'), source = join(d, 'source'), out = join(d, 'out'); fixture(live); fixture(source, '2026-10-21');
    const m = pack(source, out, commit);
    await activate(live, join(out, m.archive.name), m, noop, noop);
    await recover(live, committed ? m.archive.sha256 : 'none', noop);
    assert.equal(JSON.parse(readFileSync(join(live, 'nemesizer/meta.json'), 'utf8')).exportDate, committed ? '2026-10-21' : '2026-10-20');
    assert.equal(existsSync(join(live, '.wca-data/transaction.json')), false);
  }
});

test('stale candidates and same-generation changes are rejected', async t => {
  const d = workspace(t), live = join(d, 'live'), source = join(d, 'source'), out = join(d, 'out'); fixture(live, '2026-10-21'); fixture(source);
  const old = pack(source, out, commit);
  await assert.rejects(activate(live, join(out, old.archive.name), old, noop, noop), /older/);
  fixture(source, '2026-10-21', 'Changed'); const changed = pack(source, out, commit);
  await assert.rejects(activate(live, join(out, changed.archive.name), changed, noop, noop), /differs/);
  assert.throws(() => assertFresh(old, changed), /stale/);
});
