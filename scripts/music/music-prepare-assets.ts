import { copyFileSync, existsSync, mkdirSync, realpathSync, renameSync, statSync } from 'node:fs';
import { basename, extname, join, parse, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileSha256, runAsync, SHA256, within } from './music-shared.js';
import { SourceRecord, validateAudio } from './music-prepare-inventory.js';

export interface PreparedBinding { id: string; outputSha256: string; extension: string }
export interface AssetBinding { id: string; cover?: string; lyrics?: string }
export interface AssetContext {
  sourceRoot: string; outputRoot: string; inventoryPath: string; quarantineDirectory: string;
  ffmpeg: string; ffprobe: string; prepared: Map<string, PreparedBinding>; assets: Map<string, AssetBinding>;
}
export interface TrackResult { id: string; status: 'prepared' | 'skipped' | 'failed'; reason: string; outputSha256?: string; extension?: string }
function recordId(record: SourceRecord): string { if (!record.id || !SHA256.test(record.id)) throw new Error('Inventory has an invalid media id.'); return record.id; }
export function sourcePath(ctx: AssetContext, record: SourceRecord): string {
  const relative = record.relativePath.replaceAll('\\', '/');
  if (relative.startsWith('/') || /^[A-Za-z]:/.test(relative) || relative.split('/').includes('..')) throw new Error('Inventory contains an unsafe relativePath.');
  const file = resolve(ctx.sourceRoot, ...relative.split('/'));
  if (!within(ctx.sourceRoot, file) || resolve(ctx.sourceRoot) === file) throw new Error('Inventory path escapes the source root.');
  if (!within(realpathSync(ctx.sourceRoot), realpathSync(file))) throw new Error('Inventory path resolves outside the source root.');
  return file;
}
export function trackOutputPath(ctx: AssetContext, record: SourceRecord): string | undefined {
  const binding = ctx.prepared.get(recordId(record));
  return binding ? join(ctx.outputRoot, 'tracks', `${binding.outputSha256}${binding.extension}`) : undefined;
}
export function quarantine(ctx: AssetContext, file: string, label: string): void {
  if (!existsSync(file)) return;
  mkdirSync(ctx.quarantineDirectory, { recursive: true });
  const name = `${label}-${new Date().toISOString().replace(/[-:.Z]/g, '')}-${randomUUID()}${extname(file)}`;
  renameSync(file, join(ctx.quarantineDirectory, name));
}
export async function preparedValid(ctx: AssetContext, record: SourceRecord, expectedHash?: string): Promise<boolean> {
  const path = trackOutputPath(ctx, record);
  if (!path) return false;
  const result = validateAudio(path, record.duration ?? 0, record.action === 'transcode-aac', ctx.ffprobe);
  if (!result.valid) return false;
  const hash = ctx.prepared.get(recordId(record))?.outputSha256;
  return !!hash && await fileSha256(path) === hash && (!expectedHash || hash === expectedHash);
}
async function validFinal(ctx: AssetContext, path: string, record: SourceRecord, hash: string): Promise<boolean> {
  return existsSync(path) && (await fileSha256(path)) === hash && validateAudio(path, record.duration ?? 0, record.action === 'transcode-aac', ctx.ffprobe).valid;
}
export async function prepareTrack(ctx: AssetContext, record: SourceRecord): Promise<TrackResult> {
  const id = recordId(record);
  const extension = record.outputExtension ?? '';
  const bound = trackOutputPath(ctx, record);
  if (bound && await preparedValid(ctx, record)) return { id, status: 'skipped', reason: '', outputSha256: ctx.prepared.get(id)?.outputSha256, extension };
  if (bound && existsSync(bound)) quarantine(ctx, bound, `${id}-invalid-final`);
  const part = join(ctx.outputRoot, 'tracks', `${id}.part.${randomUUID()}${extension}`);
  try {
    const source = sourcePath(ctx, record);
    if (await fileSha256(source) !== record.contentSha256) throw new Error('source content no longer matches inventory; refresh inventory before preparing');
    if (record.action === 'copy' && record.attachedCoverStreamIndex == null) copyFileSync(source, part);
    else {
      const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', source, '-map', '0:a:0', '-vn', '-map_metadata', '0'];
      if (record.action === 'copy' || record.action === 'remux-audio') args.push('-c:a', 'copy');
      else args.push('-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '192k', '-ac', '2');
      args.push('-threads', '2');
      if (extension === '.m4a') args.push('-movflags', '+faststart', '-f', 'ipod');
      else {
        const container = ({ '.mp3': 'mp3', '.flac': 'flac', '.wav': 'wav' } as Record<string, string>)[extension];
        if (!container) throw new Error(`No safe stream-copy container for ${extension}`);
        args.push('-f', container);
      }
      args.push(part);
      await runAsync(ctx.ffmpeg, args);
    }
    if (!validateAudio(part, record.duration ?? 0, record.action === 'transcode-aac', ctx.ffprobe).valid) throw new Error('output validation failed');
    const outputSha256 = await fileSha256(part);
    const final = join(ctx.outputRoot, 'tracks', `${outputSha256}${extension}`);
    if (existsSync(final)) {
      if (await validFinal(ctx, final, record, outputSha256)) quarantine(ctx, part, `${id}-duplicate-output-part`);
      else { quarantine(ctx, final, `${id}-invalid-content-addressed-final`); renameSync(part, final); }
    } else renameSync(part, final);
    return { id, status: 'prepared', reason: '', outputSha256, extension };
  } catch (error) {
    if (existsSync(part)) quarantine(ctx, part, `${id}-failed-part`);
    return { id, status: 'failed', reason: String(error) };
  }
}
export async function mapConcurrent<T, U>(items: T[], concurrency: number, fn: (item: T) => Promise<U>): Promise<U[]> {
  const results = new Array<U>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await fn(items[index]); }
  }));
  return results;
}
export function setAssetBinding(ctx: AssetContext, id: string, kind: 'cover' | 'lyrics', fileName: string): void {
  ctx.assets.set(id, { ...(ctx.assets.get(id) ?? { id }), [kind]: fileName });
}
export async function copyAuxiliaryAtomic(ctx: AssetContext, source: string, destination: string, expectedSha256: string): Promise<boolean> {
  if (existsSync(destination) && statSync(destination).size === statSync(source).size && await fileSha256(destination) === expectedSha256) return true;
  if (existsSync(destination)) quarantine(ctx, destination, 'invalid-auxiliary');
  const info = parse(destination);
  const part = join(info.dir, `${info.name}.part.${randomUUID()}${info.ext}`);
  copyFileSync(source, part);
  if (statSync(part).size !== statSync(source).size || await fileSha256(part) !== expectedSha256) { quarantine(ctx, part, 'auxiliary-copy-failed'); return false; }
  renameSync(part, destination);
  return true;
}
export async function embeddedCover(ctx: AssetContext, record: SourceRecord): Promise<string | undefined> {
  if (record.attachedCoverStreamIndex == null) return undefined;
  const id = recordId(record);
  const existingName = ctx.assets.get(id)?.cover;
  if (existingName && SHA256.test(parse(existingName).name)) {
    const existing = join(ctx.outputRoot, 'covers', existingName);
    if (existsSync(existing) && await fileSha256(existing) === parse(existingName).name) return existing;
  }
  const codec = record.attachedCoverCodec?.toLowerCase();
  const extension = codec === 'png' ? '.png' : codec === 'webp' ? '.webp' : '.jpg';
  const part = join(ctx.outputRoot, 'covers', `${id}.part.${randomUUID()}${extension}`);
  const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', sourcePath(ctx, record), '-map', `0:${record.attachedCoverStreamIndex}`, '-frames:v', '1', '-threads', '2'];
  if (['mjpeg', 'png', 'webp'].includes(codec ?? '')) args.push('-c:v', 'copy');
  else args.push('-c:v', 'mjpeg', '-q:v', '2');
  args.push('-f', 'image2', part);
  try { await runAsync(ctx.ffmpeg, args); } catch { if (existsSync(part)) quarantine(ctx, part, `${id}-cover-failed`); return undefined; }
  if (!existsSync(part) || statSync(part).size <= 0) { if (existsSync(part)) quarantine(ctx, part, `${id}-cover-failed`); return undefined; }
  const hash = await fileSha256(part);
  const final = join(ctx.outputRoot, 'covers', `${hash}${extension}`);
  if (existsSync(final)) {
    if (await fileSha256(final) === hash) quarantine(ctx, part, `${id}-duplicate-cover-part`);
    else { quarantine(ctx, final, `${id}-invalid-cover-hash`); renameSync(part, final); }
  } else renameSync(part, final);
  return final;
}
