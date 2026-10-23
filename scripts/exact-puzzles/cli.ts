/** Explicit local preparation/restoration; external writes only in `upload`. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { download, release, upload } from '../wca-data/github.ts';
import { assetPath, hydrate, inventoryHash, prepare, readReleaseManifest, records, verifyFile, type DownloadManifest } from './assets.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const client = join(root, 'core/packages/client');
const manifestFile = join(client, 'app/[lang]/scramble/stats/_data/exact-puzzle-downloads.json');
const publicationFile = join(client, 'app/[lang]/scramble/stats/_data/exact-puzzle-publication.json');
const read = async (file: string) => JSON.parse(await readFile(file, 'utf8'));
async function atomicJson(file: string, value: unknown) {
  await mkdir(dirname(file), { recursive: true }); const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flush: true }); await rename(temporary, file);
}
async function migrate() {
  assert(!existsSync(join(root, '.local/small-puzzle-distributions.lock')), 'A guarded calculation is active; migrate after it exits');
  const manifest = await read(manifestFile) as DownloadManifest;
  const evidenceRoot = join(root, '.local/small-puzzle-distributions-20261023/download-checkpoints');
  const backup = join(dirname(evidenceRoot), 'asset-path-migration-before.json');
  const operations: Array<{ source: string; destination: string; bytes: number; sha256: string }> = [];
  // Preflight every rename before changing any path. This command deliberately
  // does not reread gzip payloads: prior full integrity evidence remains valid
  // for same-volume renames. The operation list permits a metadata-only rollback.
  for (const [event, downloads] of Object.entries(manifest.puzzles)) {
    assert(!existsSync(join(evidenceRoot, event, 'progress.json')), `Unfinished export: ${event}`);
    const assets = [[downloads.allStates, 'all.csv.gz'], ...Object.entries(downloads.byDepth).map(([depth, a]) => [a, `depth-${depth}.txt.gz`])] as [typeof downloads.allStates, string][];
    for (const [asset, name] of assets) {
      const destination = join(root, 'stats', assetPath(event, asset, name));
      assert.equal(asset.url, `/generated/exact-puzzles/${event}/${name}`, 'Already migrated or unexpected URL; inspect the migration operation list');
      assert(!existsSync(destination), `Destination exists; inspect prior migration before continuing: ${destination}`);
      const source = join(client, 'public/generated/exact-puzzles', event, name), info = await stat(source);
      assert(info.isFile()); assert.equal(info.size, asset.bytes);
      assert.equal(info.dev, (await stat(join(root, 'stats'))).dev, 'Migration must be a same-volume rename');
      operations.push({ source, destination, bytes: asset.bytes, sha256: asset.sha256 });
    }
  }
  const operationFile = join(dirname(evidenceRoot), 'asset-path-migration.json');
  const operationReport = { schemaVersion: 1, status: 'prepared',
    originalManifestSha256: createHash('sha256').update(await readFile(manifestFile)).digest('hex'), operations };
  if (!existsSync(backup)) await atomicJson(backup, manifest);
  await atomicJson(operationFile, operationReport);
  let moved = 0;
  for (const [event, downloads] of Object.entries(manifest.puzzles)) {
    const assets = [[downloads.allStates, 'all.csv.gz'], ...Object.entries(downloads.byDepth).map(([depth, a]) => [a, `depth-${depth}.txt.gz`])] as const;
    assert(!existsSync(join(evidenceRoot, event, 'progress.json')), `Unfinished export: ${event}`);
    for (const pair of assets) {
      const [asset, name] = pair as [typeof downloads.allStates, string];
      const relative = assetPath(event, asset, name), destination = join(root, 'stats', relative);
      assert(asset.url === `/generated/exact-puzzles/${event}/${name}` || asset.url === `/stats/${relative}`, 'Unexpected prior asset URL');
      const source = join(client, 'public/generated/exact-puzzles', event, name);
      await mkdir(dirname(destination), { recursive: true }); await rename(source, destination); moved++;
      asset.url = `/stats/${relative}`;
    }
  }
  manifest.inventorySha256 = inventoryHash(manifest); records(manifest);
  await atomicJson(manifestFile, manifest);
  // Model fingerprints and original computation reports are never changed.
  for (const [event, downloads] of Object.entries(manifest.puzzles)) {
    const file = join(evidenceRoot, event, 'export-evidence.json');
    if (!existsSync(file)) continue;
    const evidence = await read(file); assert.equal(evidence.completed, true);
    const old = evidence.downloads;
    for (const [depth, asset] of Object.entries(downloads.byDepth)) assert.equal(old.byDepth[depth].sha256, asset.sha256);
    assert.equal(old.allStates.sha256, downloads.allStates.sha256);
    evidence.downloads = downloads; await atomicJson(file, evidence);
  }
  await atomicJson(publicationFile, { schemaVersion: 1, published: null });
  await atomicJson(operationFile, { ...operationReport, status: 'completed', movedFiles: moved,
    completedAt: new Date().toISOString(), inventorySha256: manifest.inventorySha256 });
  console.log(JSON.stringify({ migratedFiles: moved, events: Object.keys(manifest.puzzles).length, inventorySha256: manifest.inventorySha256 }));
}
const [command, arg, arg2, arg3] = process.argv.slice(2);
if (command === 'migrate') await migrate();
else if (command === 'prepare') {
  assert(arg, 'prepare OUTPUT_DIRECTORY');
  const result = await prepare(await read(manifestFile), join(root, 'stats'), resolve(arg));
  console.log(JSON.stringify({ manifest: result.path, archives: result.manifest.archives.length, inventorySha256: result.manifest.inventorySha256 }));
} else if (command === 'hydrate') {
  assert(arg && arg2 && arg3, 'hydrate MANIFEST ARCHIVE_DIRECTORY DESTINATION_STATS_ROOT');
  console.log(JSON.stringify(await hydrate(resolve(arg), resolve(arg2), resolve(arg3))));
} else if (command === 'upload') {
  assert(arg, 'upload PREPARED_MANIFEST');
  const file = resolve(arg), manifest = await readReleaseManifest(file), current = release();
  assert(!current.draft, 'Existing wca-data-latest Release must be published');
  for (const archive of manifest.archives) { const path = join(dirname(file), archive.name); await verifyFile(path, archive); upload(current, path, archive.name); }
  upload(current, file, basename(file)); // Independent immutable manifest, last; never mutate the shared Release body.
  console.log(JSON.stringify({ uploaded: basename(file), activatedOnStatic: false }));
} else if (command === 'hydrate-release') {
  assert(arg && /^exact-puzzles-[a-f0-9]{64}\.json$/.test(arg) && arg2, 'hydrate-release MANIFEST_NAME DESTINATION_STATS_ROOT');
  const temporary = await mkdtemp(join(tmpdir(), 'exact-puzzle-release-'));
  try {
    const current = release(), file = join(temporary, arg); download(current, arg, file);
    const manifest = await readReleaseManifest(file);
    for (const archive of manifest.archives) download(current, archive.name, join(temporary, archive.name));
    console.log(JSON.stringify(await hydrate(file, temporary, resolve(arg2))));
  } finally { await rm(temporary, { recursive: true, force: true }); }
} else if (command === 'verify-published') {
  assert(arg, 'verify-published PREPARED_MANIFEST (read-only network check, then records publication availability)');
  const manifest = await readReleaseManifest(resolve(arg)), current = await read(manifestFile) as DownloadManifest;
  assert.equal(inventoryHash(current), manifest.inventorySha256, 'Current website manifest differs');
  for (const files of records(current).values()) for (const file of files) {
    const response = await fetch(`https://static.cuberoot.me${file.url}`, { signal: AbortSignal.timeout(300000) });
    assert(response.ok && response.body, `Unavailable: ${file.url}`);
    const hash = createHash('sha256'); let bytes = 0;
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) { bytes += chunk.length; assert(bytes <= file.bytes); hash.update(chunk); }
    assert.equal(bytes, file.bytes); assert.equal(hash.digest('hex'), file.sha256);
  }
  await atomicJson(publicationFile, { schemaVersion: 1, published: { inventorySha256: manifest.inventorySha256,
    manifest: basename(arg), origin: 'https://static.cuberoot.me', verifiedAt: new Date().toISOString() } });
  console.log('Verified immutable static assets; production download links are now eligible for the next code release.');
} else throw Error('Commands: migrate | prepare OUTPUT | hydrate MANIFEST ARCHIVES STATS_ROOT | upload MANIFEST | hydrate-release NAME STATS_ROOT | verify-published MANIFEST');
