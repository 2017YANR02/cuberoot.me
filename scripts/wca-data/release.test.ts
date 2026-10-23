import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encodePersons, encodeRanks, encodeCounts } from '../../core/packages/shared/src/nemesizer_format.ts';
import { FILES, TAG, pack, unpack, parseManifest, assertFresh, sha, resolveRelease, obsoleteAssets } from './common.ts';
import { activate, finalize, recover } from './deploy.ts';
import { managed } from './snapshot.ts';

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

test('released datasets and retired build bundles cannot re-enter the Git index', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const paths = FILES.flatMap(f => [`stats/${f}`, `stats/data/${f}`]);
  assert.equal(execFileSync('git', ['ls-files', '--', '_assets/', ...paths], { cwd: root, encoding: 'utf8' }).trim(), '');
  const tracked = execFileSync('git', ['ls-files', '--', 'stats', ':(exclude)stats/tutorial/**'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.deepEqual(tracked.filter(path => managed(path.slice(6)) || path.startsWith('stats/data/')), []);
  const candidates = [...paths, '_assets/retired-build.js', 'stats/all_past_comps.json', 'stats/all_past_comps.json.next', 'stats/scramble/distribution.json', 'stats/scramble/downloads/a.txt', 'stats/records/history/a.json', 'stats/data/old.json'];
  const ignored = execFileSync('git', ['check-ignore', '--no-index', '--', ...candidates], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(ignored.sort(), candidates.sort());
});

test('draft Release lookup falls back to authenticated listing without creating duplicates', () => {
  const missing = { status: 1, stdout: '', stderr: 'gh: Not Found (HTTP 404)' };
  const draft = { id: 42, tag_name: TAG, draft: true, immutable: false };
  assert.equal(resolveRelease(missing, () => [draft], () => { throw new Error('duplicate'); }), draft);
  assert.equal(resolveRelease(missing, () => [], () => draft), draft);
  assert.throws(() => resolveRelease({ ...missing, stderr: 'HTTP 403' }, () => { throw new Error('unexpected listing'); }), /403/);
  assert.throws(() => resolveRelease(missing, () => [{ ...draft, immutable: true }]), /mutable/);
});

test('cleanup removes superseded and expired files but preserves current and queued data', () => {
  const now = Date.parse('2026-10-21T00:00:00Z');
  const assets = ['a', 'b', 'c', 'd'].flatMap(letter => ['wca-data-', 'candidate-'].map(prefix => ({ name: `${prefix}${letter.repeat(64)}${prefix === 'candidate-' ? '.json' : '.tar'}`, created_at: letter === 'd' ? '2026-10-19T00:00:00Z' : '2026-10-21T00:00:00Z' })));
  assets.splice(3, 1); // b is the previous published archive, with no pending candidate.
  const remove = obsoleteAssets(assets, `wca-data-${'a'.repeat(64)}.tar`, `candidate-${'a'.repeat(64)}.json`, now, `wca-data-${'b'.repeat(64)}.tar`).map(a => a.name);
  assert.deepEqual(remove, [`candidate-${'a'.repeat(64)}.json`, `wca-data-${'b'.repeat(64)}.tar`, `wca-data-${'d'.repeat(64)}.tar`, `candidate-${'d'.repeat(64)}.json`]);
});

test('cleanup preserves an archive while its candidate manifest is still uploading', () => {
  const now = Date.parse('2026-10-21T00:00:00Z');
  const fresh = { name: `wca-data-${'e'.repeat(64)}.tar`, created_at: new Date(now - 1000).toISOString() };
  const old = { name: `wca-data-${'f'.repeat(64)}.tar`, created_at: new Date(now - 86_400_001).toISOString() };
  assert.deepEqual(obsoleteAssets([fresh, old], `wca-data-${'a'.repeat(64)}.tar`, `candidate-${'a'.repeat(64)}.json`, now), [old]);
});

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
