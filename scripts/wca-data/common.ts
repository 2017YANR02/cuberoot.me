import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

export const REPO = '2017YANR02/cuberoot.me';
export const TAG = 'wca-data-latest';
export const FILES = ['nemesizer/persons.bin.gz', 'nemesizer/ranks.bin.gz', 'nemesizer/counts.bin.gz', 'nemesizer/meta.json', 'persons_search.json.gz'] as const;
export const MAX_ARCHIVE = 128 * 1024 * 1024;
export type Manifest = {
  schema: 1; sourceCommit: string; generatedAt: string; exportDate: string;
  personCount: number; rankCount: number;
  archive: { name: string; bytes: number; sha256: string };
  files: { path: string; bytes: number; sha256: string }[];
};
export function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export function sha(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex'); }
export function run(command: string, args: string[], options = {}): string {
  return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, ...options }).trim();
}
export function readBounded(path: string, max = MAX_ARCHIVE): Buffer {
  const st = statSync(path);
  check(st.isFile() && st.size > 0 && st.size <= max, `Invalid file/size: ${path}`);
  return readFileSync(path);
}
export function validateDataset(root: string) {
  const meta = JSON.parse(readBounded(join(root, 'nemesizer/meta.json'), 1024 * 1024).toString());
  check(/^\d{4}-\d{2}-\d{2}$/.test(meta.exportDate) && Number.isFinite(Date.parse(meta.generatedAt)), 'Invalid dataset dates');
  check(Number.isSafeInteger(meta.personCount) && meta.personCount > 0 && meta.personCount < 2_000_000, 'Invalid personCount');
  check(Number.isSafeInteger(meta.rankCount) && meta.rankCount > 0 && meta.rankCount < 20_000_000, 'Invalid rankCount');
  // Only envelope checks here; the canonical API decoder validates the format at activation.
  // Gzip CRC validation rejects truncation; bounded decompression rejects oversized input.
  for (const file of FILES.filter(p => p.endsWith('.bin.gz'))) {
    const raw = gunzipSync(readBounded(join(root, file)), { maxOutputLength: 384 * 1024 * 1024 });
    check(raw.length >= 16, `Empty binary: ${file}`);
    const expected = file.endsWith('ranks.bin.gz') ? meta.rankCount : meta.personCount;
    check(raw.readUInt32LE(8) === expected, `Metadata/count mismatch: ${file}`);
  }
  const index = JSON.parse(gunzipSync(readBounded(join(root, 'persons_search.json.gz')), { maxOutputLength: 128 * 1024 * 1024 }).toString());
  check(Array.isArray(index) && index.length >= meta.personCount && index.length < 2_000_000, 'Invalid search index count');
  let previous = '';
  for (const row of index) {
    check(Array.isArray(row) && row.length === 3 && row.every(x => typeof x === 'string') && /^\d{4}[A-Z]{4}\d{2}$/.test(row[0]) && row[0] > previous && row[1].length > 0, 'Invalid or unsorted search index');
    previous = row[0];
  }
  return meta;
}
export function parseManifest(value: unknown): Manifest {
  const m = value as Manifest;
  check(m?.schema === 1 && /^[a-f0-9]{40}$/.test(m.sourceCommit), 'Invalid manifest/source commit');
  check(Number.isFinite(Date.parse(m.generatedAt)) && /^\d{4}-\d{2}-\d{2}$/.test(m.exportDate), 'Invalid manifest dates');
  check(m.archive && /^[a-f0-9]{64}$/.test(m.archive.sha256) && m.archive.name === `wca-data-${m.archive.sha256}.tar`, 'Invalid archive identity');
  check(Number.isSafeInteger(m.archive.bytes) && m.archive.bytes > 0 && m.archive.bytes <= MAX_ARCHIVE, 'Invalid archive size');
  check(Array.isArray(m.files) && m.files.length === FILES.length, 'Invalid file inventory');
  check(new Set(m.files.map(f => f.path)).size === FILES.length, 'Duplicate files');
  for (const f of m.files) check(FILES.includes(f.path as typeof FILES[number]) && Number.isSafeInteger(f.bytes) && f.bytes > 0 && f.bytes < MAX_ARCHIVE && /^[a-f0-9]{64}$/.test(f.sha256), 'Invalid file record');
  return m;
}
export function pack(root: string, out: string, sourceCommit: string): Manifest {
  const meta = validateDataset(root);
  mkdirSync(out, { recursive: true });
  const tar = join(out, 'candidate.tar');
  // GNU-compatible format with no macOS metadata, links, or implicit directories.
  run('tar', ['--format=ustar', '-cf', tar, '-C', root, ...FILES], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
  const bytes = readBounded(tar);
  const hash = sha(bytes);
  const m = parseManifest({ schema: 1, sourceCommit, generatedAt: meta.generatedAt, exportDate: meta.exportDate, personCount: meta.personCount, rankCount: meta.rankCount,
    archive: { name: `wca-data-${hash}.tar`, bytes: bytes.length, sha256: hash },
    files: FILES.map(path => { const b = readBounded(join(root, path)); return { path, bytes: b.length, sha256: sha(b) }; }) });
  writeFileSync(join(out, m.archive.name), bytes);
  writeFileSync(join(out, `candidate-${hash}.json`), JSON.stringify(m, null, 2));
  return m;
}
export function unpack(archive: string, manifest: Manifest, destination: string) {
  const m = parseManifest(manifest), bytes = readBounded(archive);
  check(bytes.length === m.archive.bytes && sha(bytes) === m.archive.sha256, 'Archive checksum mismatch');
  const names = run('tar', ['-tf', archive]).split('\n');
  const types = run('tar', ['-tvf', archive]).split('\n');
  check(names.length === FILES.length && new Set(names).size === FILES.length && names.every(n => FILES.includes(n as typeof FILES[number])) && types.every(t => t.startsWith('-')), 'Archive contains unexpected entries or links');
  mkdirSync(destination, { recursive: true });
  check(readdirSync(destination).length === 0, 'Extraction destination must be empty');
  run('tar', ['-xf', archive, '-C', destination, '--no-same-owner', '--no-same-permissions']);
  for (const f of m.files) { const b = readBounded(join(destination, f.path)); check(b.length === f.bytes && sha(b) === f.sha256, `Checksum mismatch: ${f.path}`); }
  const meta = validateDataset(destination);
  check(meta.generatedAt === m.generatedAt && meta.exportDate === m.exportDate && meta.personCount === m.personCount && meta.rankCount === m.rankCount, 'Manifest metadata mismatch');
  writeFileSync(join(destination, 'manifest.json'), JSON.stringify(m, null, 2));
}
export function assertFresh(next: Manifest, previous?: Manifest) {
  if (!previous) return;
  check(next.exportDate >= previous.exportDate && Date.parse(next.generatedAt) >= Date.parse(previous.generatedAt), 'Refusing stale candidate');
  if (next.generatedAt === previous.generatedAt) check(JSON.stringify(next.files) === JSON.stringify(previous.files), 'Same generation has different content');
}

// The tags endpoint does not return draft releases. Authenticated listing does.
export function resolveRelease(result: { status: number | null; stdout: string; stderr: string }, list: () => any[], create?: () => any) {
  let r: any;
  if (result.status === 0) r = JSON.parse(result.stdout);
  else {
    check(result.stderr.includes('404'), `Cannot read data Release: ${result.stderr}`);
    r = list().find(item => item.tag_name === TAG);
    if (!r) { check(create, 'Latest data Release does not exist'); r = create(); }
  }
  check(!r.immutable, 'Latest WCA data Release must be mutable');
  return r;
}

export function obsoleteAssets(assets: any[], activeName: string, completedCandidate: string, now = Date.now(), previousName?: string) {
  const liveCandidates = new Set(assets.filter(a => /^candidate-[a-f0-9]{64}\.json$/.test(a.name) && a.name !== completedCandidate && now - Date.parse(a.created_at) < 86_400_000).map(a => a.name));
  return assets.filter(a => {
    if (/^candidate-[a-f0-9]{64}\.json$/.test(a.name)) return !liveCandidates.has(a.name);
    // stage() uploads the archive before its candidate manifest. A fresh archive
    // without a manifest can belong to an upload in progress, not an orphan.
    if (/^wca-data-[a-f0-9]{64}\.tar$/.test(a.name)) return a.name !== activeName && !liveCandidates.has(`candidate-${a.name.slice(9, -4)}.json`)
      && (a.name === previousName || now - Date.parse(a.created_at) >= 86_400_000);
    return false;
  });
}
