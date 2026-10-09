/** Prepare one bounded music batch into a local content-addressed library. */
import { existsSync, mkdirSync, readFileSync, renameSync, statfsSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GIB, MIB, SHA256, assertOutsideSource, readJson, textSha256, validateArgs, writeJsonAtomic } from './music-shared.js';
import { SourceRecord, MEDIA_EXTENSIONS, readInventory, scanInventory, validateInventory } from './music-prepare-inventory.js';
import { AssetBinding, AssetContext, PreparedBinding, mapConcurrent, prepareTrack, preparedValid, quarantine } from './music-prepare-assets.js';
import { buildMusicOutputs } from './music-prepare-bindings.js';

interface Options {
  sourceRoot: string; outputRoot: string; inventoryPath: string; batchBytes: number; concurrency: number;
  pilot: boolean; refreshInventory: boolean; replayLastBatch: boolean; plan: boolean; ffmpeg: string; ffprobe: string;
}
interface LastBatch { version: 1; createdAtUtc: string; trackIds: string[]; estimatedOutputBytes: number; outputs: Array<{ id: string; sha256: string; extension: string }> }
function value(args: string[], name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} requires a value.`);
  return args[index + 1];
}
export function parseOptions(args: string[]): Options {
  validateArgs(args, ['--pilot', '--refresh-inventory', '--replay-last-batch', '--plan'],
    ['--source-root', '--staging-root', '--output-root', '--inventory', '--batch-bytes', '--concurrency', '--ffmpeg', '--ffprobe']);
  const sourceRoot = value(args, '--source-root', process.env.MUSIC_SOURCE_ROOT);
  const stagingRoot = value(args, '--staging-root', process.env.MUSIC_STAGING_ROOT);
  const outputRoot = value(args, '--output-root', process.env.MUSIC_LIBRARY_ROOT ?? (stagingRoot ? join(stagingRoot, 'library') : undefined));
  const inventoryPath = value(args, '--inventory', stagingRoot ? join(stagingRoot, 'inventory', 'source-manifest.jsonl') : outputRoot ? join(dirname(outputRoot), 'inventory', 'source-manifest.jsonl') : undefined);
  if (!sourceRoot || !outputRoot || !inventoryPath) throw new Error('Provide --source-root and --staging-root, or explicit --output-root and --inventory. Environment equivalents: MUSIC_SOURCE_ROOT, MUSIC_STAGING_ROOT.');
  const batchBytes = Number(value(args, '--batch-bytes', String(GIB)));
  const concurrency = Number(value(args, '--concurrency', '4'));
  if (!Number.isSafeInteger(batchBytes) || batchBytes < MIB || batchBytes > GIB) throw new Error('batch-bytes must be between 1 MiB and 1 GiB.');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('concurrency must be 1..4.');
  const pilot = args.includes('--pilot'), replayLastBatch = args.includes('--replay-last-batch'), refreshInventory = args.includes('--refresh-inventory');
  if (pilot && replayLastBatch) throw new Error('Pilot and ReplayLastBatch cannot be used together.');
  if (replayLastBatch && refreshInventory) throw new Error('ReplayLastBatch requires the unchanged inventory used by the original batch.');
  const options: Options = {
    sourceRoot: resolve(sourceRoot), outputRoot: resolve(outputRoot), inventoryPath: resolve(inventoryPath), batchBytes, concurrency,
    pilot, replayLastBatch, refreshInventory, plan: args.includes('--plan'),
    ffmpeg: value(args, '--ffmpeg', process.env.MUSIC_FFMPEG_PATH ?? 'ffmpeg')!,
    ffprobe: value(args, '--ffprobe', process.env.MUSIC_FFPROBE_PATH ?? 'ffprobe')!,
  };
  if (!existsSync(options.sourceRoot) || !statSync(options.sourceRoot).isDirectory()) throw new Error(`SourceRoot does not exist: ${options.sourceRoot}`);
  assertOutsideSource(options.sourceRoot, options.outputRoot, 'OutputRoot');
  assertOutsideSource(options.sourceRoot, options.inventoryPath, 'InventoryPath');
  return options;
}
function readBindings(ctx: AssetContext): void {
  const inventoryDirectory = dirname(ctx.inventoryPath);
  const preparedPath = join(inventoryDirectory, 'prepared-index.v1.json');
  if (existsSync(preparedPath)) {
    const index = readJson<{ version: number; tracks: PreparedBinding[] }>(preparedPath);
    if (index.version !== 1) throw new Error('Unsupported prepared-index version.');
    for (const binding of index.tracks ?? []) {
      if (SHA256.test(binding.id) && SHA256.test(binding.outputSha256) && ['.mp3', '.m4a', '.flac', '.wav'].includes(binding.extension)) ctx.prepared.set(binding.id, binding);
    }
  }
  const assetPath = join(inventoryDirectory, 'asset-bindings.v1.json');
  if (existsSync(assetPath)) {
    const index = readJson<{ version: number; tracks: AssetBinding[] }>(assetPath);
    if (index.version !== 1) throw new Error('Unsupported asset-bindings version.');
    for (const binding of index.tracks ?? []) if (SHA256.test(binding.id)) ctx.assets.set(binding.id, binding);
  }
}
function canonical(records: SourceRecord[]): { media: SourceRecord[]; unique: SourceRecord[] } {
  const media = records.filter(record => record.kind === 'media');
  if (!media.length) throw new Error('Source inventory contains no supported media.');
  const byHash = new Map<string, SourceRecord>();
  for (const record of [...media].sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en'))) {
    if (!record.id || !SHA256.test(record.id)) throw new Error(`Media inventory has invalid id: ${record.relativePath}`);
    if (!byHash.has(record.contentSha256)) byHash.set(record.contentSha256, record);
  }
  return { media, unique: [...byHash.values()] };
}
function freeBytes(path: string): number {
  const available = statfsSync(path);
  return Number(available.bavail) * Number(available.bsize);
}
function writeInventoryAtomic(path: string, records: SourceRecord[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const part = join(dirname(path), `source-manifest.part.${randomUUID()}.jsonl`);
  writeFileSync(part, records.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');
  renameSync(part, path);
}
function summarizeActions(records: SourceRecord[]): Array<{ action: string; tracks: number }> {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.action ?? '', (counts.get(record.action ?? '') ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([action, tracks]) => ({ action, tracks }));
}
export async function prepareMusic(options: Options): Promise<void> {
  const inventoryDirectory = dirname(options.inventoryPath);
  const ctx: AssetContext = {
    sourceRoot: options.sourceRoot, outputRoot: options.outputRoot, inventoryPath: options.inventoryPath,
    quarantineDirectory: join(dirname(options.outputRoot), '.work', 'quarantine'),
    ffmpeg: options.ffmpeg, ffprobe: options.ffprobe, prepared: new Map(), assets: new Map(),
  };
  readBindings(ctx);
  const inventoryExists = existsSync(options.inventoryPath);
  let regenerated = !inventoryExists || options.refreshInventory;
  let records: SourceRecord[];
  if (inventoryExists && !options.refreshInventory) {
    records = readInventory(options.inventoryPath);
    if (!validateInventory(records)) {
      console.log('Existing inventory predates content hashes; rebuilding from read-only source...');
      records = await scanInventory(options.sourceRoot, options.ffprobe);
      regenerated = true;
    }
  } else {
    console.log('Scanning source inventory (read-only)...');
    records = await scanInventory(options.sourceRoot, options.ffprobe);
  }
  const { media, unique } = canonical(records);
  console.log(`Content index: source media=${media.length}; unique content=${unique.length}; exact duplicate sources=${media.length - unique.length}.`);
  const lastBatchPath = join(inventoryDirectory, 'last-batch.v1.json');
  let lastBatch: LastBatch | undefined;
  const expectedHashes = new Map<string, string>();
  if (options.replayLastBatch) {
    if (!existsSync(lastBatchPath)) throw new Error(`ReplayLastBatch requires ${lastBatchPath}.`);
    lastBatch = readJson<LastBatch>(lastBatchPath);
    if (lastBatch.version !== 1) throw new Error('Unsupported last-batch receipt version.');
    for (const output of lastBatch.outputs ?? []) if (SHA256.test(output.id) && SHA256.test(output.sha256)) expectedHashes.set(output.id, output.sha256);
  }
  let candidates: SourceRecord[];
  if (options.pilot) {
    candidates = MEDIA_EXTENSIONS.map(extension => unique.filter(record => record.extension === extension).sort((a, b) => a.bytes - b.bytes || a.relativePath.localeCompare(b.relativePath, 'en'))[0]);
    if (candidates.some(record => !record)) throw new Error(`Pilot requires one source for each of ${MEDIA_EXTENSIONS.length} supported sample extensions.`);
  } else if (options.replayLastBatch) {
    const ids = lastBatch?.trackIds ?? [];
    if (!ids.length) throw new Error('The last-batch receipt contains no track IDs.');
    const byId = new Map(unique.map(record => [record.id, record]));
    candidates = ids.map(id => { const record = byId.get(id); if (!record) throw new Error('The last-batch receipt no longer matches the current source inventory.'); return record; });
  } else candidates = unique;
  const pending: SourceRecord[] = [];
  for (const record of candidates) {
    if (!await preparedValid(ctx, record, options.replayLastBatch ? expectedHashes.get(record.id ?? '') : undefined)) pending.push(record);
  }
  let selected: SourceRecord[];
  if (options.pilot || options.replayLastBatch) selected = pending;
  else {
    selected = [];
    let planned = 0;
    for (const record of pending) {
      const estimate = record.estimatedOutputBytes ?? 0;
      if (estimate > options.batchBytes) {
        if (!selected.length) throw new Error(`Track id ${record.id} exceeds BatchBytes; raise the explicit limit for this track.`);
        break;
      }
      if (selected.length && planned + estimate > options.batchBytes) break;
      selected.push(record);
      planned += estimate;
    }
  }
  const batchRecords = options.replayLastBatch ? candidates : selected;
  const estimatedBytes = selected.reduce((sum, record) => sum + (record.estimatedOutputBytes ?? 0), 0);
  const actionSummary = summarizeActions(selected).map(entry => `${entry.action}=${entry.tracks}`).join(', ');
  const mode = options.pilot ? 'pilot' : options.replayLastBatch ? 'replay last batch' : 'one batch';
  console.log(`Plan: mode=${mode}; tracks=${selected.length}; estimated=${(estimatedBytes / MIB).toFixed(1)} MiB; concurrency=${options.concurrency}; ${actionSummary}`);
  if (options.plan) return;
  for (const name of ['', 'tracks', 'covers', 'lyrics']) mkdirSync(join(options.outputRoot, name), { recursive: true });
  mkdirSync(ctx.quarantineDirectory, { recursive: true });
  const legacyReview = join(options.outputRoot, 'manual-review.v1.json');
  if (existsSync(legacyReview)) quarantine(ctx, legacyReview, 'legacy-public-manual-review');
  if (regenerated) writeInventoryAtomic(options.inventoryPath, records);
  const freeBefore = freeBytes(options.outputRoot);
  const reserveBytes = 20 * GIB;
  if (freeBefore < Math.ceil(estimatedBytes * 1.15) + reserveBytes) throw new Error(`Insufficient free space: need 115% of estimated batch and retain 20 GiB; free=${(freeBefore / GIB).toFixed(1)} GiB.`);
  const createdAtUtc = lastBatch?.createdAtUtc ?? new Date().toISOString();
  if (!options.pilot && !options.replayLastBatch) writeJsonAtomic(lastBatchPath, {
    version: 1, createdAtUtc, trackIds: batchRecords.map(record => record.id), estimatedOutputBytes: estimatedBytes, outputs: [],
  });
  const results = await mapConcurrent(selected, options.concurrency, record => prepareTrack(ctx, record));
  for (const result of results) if (result.status !== 'failed' && result.outputSha256 && result.extension) ctx.prepared.set(result.id, { id: result.id, outputSha256: result.outputSha256, extension: result.extension });
  writeJsonAtomic(join(inventoryDirectory, 'prepared-index.v1.json'), {
    version: 1, tracks: [...ctx.prepared.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')),
  });
  const completed: SourceRecord[] = [];
  for (const record of unique) if (await preparedValid(ctx, record)) completed.push(record);
  const output = await buildMusicOutputs(ctx, records, unique, completed);
  if (!options.pilot) {
    const outputs = batchRecords.flatMap(record => {
      const binding = ctx.prepared.get(record.id ?? '');
      return binding ? [{ id: binding.id, sha256: binding.outputSha256, extension: binding.extension }] : [];
    });
    const outputBytes = outputs.reduce((sum, binding) => {
      const file = join(options.outputRoot, 'tracks', `${binding.sha256}${binding.extension}`);
      return sum + (existsSync(file) ? statSync(file).size : 0);
    }, 0);
    const receipt = {
      version: 1, mode: 'batch', verifiedBy: options.replayLastBatch ? 'replay' : 'initial-run', createdAtUtc,
      verifiedAtUtc: new Date().toISOString(), trackIds: batchRecords.map(record => record.id),
      estimatedOutputBytes: lastBatch?.estimatedOutputBytes ?? estimatedBytes,
      inputBytes: batchRecords.reduce((sum, record) => sum + record.bytes, 0), outputBytes,
      freeBeforeBytes: freeBefore, freeAfterBytes: freeBytes(options.outputRoot), reserveBytes,
      concurrency: options.concurrency, ffmpegThreadsPerProcess: 2, actions: summarizeActions(batchRecords), outputs,
    };
    writeJsonAtomic(lastBatchPath, receipt);
    writeJsonAtomic(join(inventoryDirectory, 'batches', `${textSha256(receipt.trackIds.join('\n'))}.v1.json`), receipt);
  }
  const preparedCount = results.filter(result => result.status === 'prepared').length;
  const skippedCount = results.filter(result => result.status === 'skipped').length;
  const failures = results.filter(result => result.status === 'failed');
  console.log(`Result: prepared=${preparedCount}; skipped=${skippedCount}; failed=${failures.length}; manifest tracks=${output.tracks}; manual review=${output.manualReview}; exact duplicate sources=${media.length - unique.length}.`);
  if (failures.length) throw new Error(`Batch completed with failures: ${failures.map(failure => failure.reason).join('; ')}`);
}
export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.includes('--help')) {
    console.log('Usage: tsx scripts/music/prepare-music.ts --source-root <read-only-dir> --staging-root <dir> [--pilot|--plan|--refresh-inventory|--replay-last-batch] [--batch-bytes N] [--concurrency 1..4]');
    return;
  }
  await prepareMusic(parseOptions(args));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
