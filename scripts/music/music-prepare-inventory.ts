import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { fileSha256, nonempty, number, runSync, SHA256 } from './music-shared.js';

export const MEDIA_EXTENSIONS = ['.mp3', '.m4a', '.flac', '.wav', '.ape', '.wma', '.mp4', '.mov', '.mkv'] as const;
const COVERS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const LYRICS = new Set(['.lrc']);
export interface SourceRecord {
  schemaVersion: 1; relativePath: string; extension: string; bytes: number; lastWriteTimeUtc: string; contentSha256: string;
  kind: 'media' | 'cover' | 'lyrics' | 'other';
  id?: string; duration?: number; audioCodec?: string; audioBitRate?: number; action?: 'copy' | 'remux-audio' | 'transcode-aac';
  outputExtension?: string; estimatedOutputBytes?: number; title?: string; artist?: string; album?: string; genre?: string;
  year?: number; language?: string; attachedCoverStreamIndex?: number; attachedCoverCodec?: string;
}
interface ProbeStream { codec_type?: string; codec_name?: string; bit_rate?: string; duration?: string; index?: number; tags?: Record<string, unknown>; disposition?: { attached_pic?: number } }
export interface Probe { streams?: ProbeStream[]; format?: { duration?: string; tags?: Record<string, unknown> } }
function firstTag(tags: Array<Record<string, unknown> | undefined>, keys: string[]): string | undefined {
  for (const item of tags) for (const key of keys) { const value = nonempty(item?.[key]); if (value) return value; }
  return undefined;
}
export function mediaAction(extension: string, codec: string): SourceRecord['action'] {
  if (['.mp3', '.m4a', '.flac', '.wav'].includes(extension)) return 'copy';
  if (['.ape', '.wma'].includes(extension)) return 'transcode-aac';
  if (['.mp4', '.mov', '.mkv'].includes(extension)) return codec === 'aac' ? 'remux-audio' : 'transcode-aac';
  throw new Error(`Unsupported media extension: ${extension}`);
}
export function outputExtension(extension: string, action: SourceRecord['action']): string { return action === 'copy' ? extension : '.m4a'; }
export function estimatedOutputBytes(bytes: number, duration: number, bitRate: number, action: SourceRecord['action']): number {
  if (action === 'copy') return bytes;
  const rate = action === 'transcode-aac' ? 192000 : bitRate > 0 ? bitRate : 256000;
  return Math.ceil(duration * rate / 8 * 1.05 + 1024 ** 2);
}
export function probeFile(file: string, ffprobe = 'ffprobe'): Probe {
  let result: Probe;
  try { result = JSON.parse(runSync(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file])) as Probe; }
  catch (error) { throw new Error(`ffprobe failed or returned invalid JSON for ${file}: ${String(error)}`); }
  return result;
}
export function validateAudio(file: string, duration: number, requireAac: boolean, ffprobe = 'ffprobe'): { valid: boolean; reason: string; duration: number } {
  if (!existsSync(file) || !statSync(file).isFile()) return { valid: false, reason: 'missing', duration: 0 };
  let probe: Probe;
  try { probe = probeFile(file, ffprobe); } catch { return { valid: false, reason: 'ffprobe-failed', duration: 0 }; }
  const audio = (probe.streams ?? []).filter(stream => stream.codec_type === 'audio');
  const video = (probe.streams ?? []).filter(stream => stream.codec_type === 'video');
  if (audio.length !== 1) return { valid: false, reason: 'audio-stream-count', duration: 0 };
  if (video.length) return { valid: false, reason: 'contains-video', duration: 0 };
  if (requireAac && audio[0].codec_name !== 'aac') return { valid: false, reason: 'not-aac', duration: 0 };
  const actual = number(probe.format?.duration) || number(audio[0].duration);
  return actual > 0 && Math.abs(actual - duration) <= Math.max(3, duration * 0.03)
    ? { valid: true, reason: '', duration: actual }
    : { valid: false, reason: 'duration-mismatch', duration: actual };
}
function walk(root: string): string[] {
  const files: string[] = [];
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Source contains a symbolic link; refusing to follow it: ${child}`);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) files.push(child);
    }
  }
  visit(root);
  return files.sort((a, b) => a.localeCompare(b, 'en'));
}
export async function scanInventory(root: string, ffprobe = 'ffprobe'): Promise<SourceRecord[]> {
  const files = walk(root);
  const records: SourceRecord[] = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    if (index === 0 || (index + 1) % 50 === 0 || index + 1 === files.length) console.log(`Inventory progress: ${index + 1}/${files.length}`);
    const meta = lstatSync(file);
    const extension = extname(file).toLowerCase();
    const hash = await fileSha256(file);
    const base: SourceRecord = {
      schemaVersion: 1, relativePath: relative(root, file), extension, bytes: meta.size,
      lastWriteTimeUtc: meta.mtime.toISOString(), contentSha256: hash,
      kind: MEDIA_EXTENSIONS.includes(extension as typeof MEDIA_EXTENSIONS[number]) ? 'media' : COVERS.has(extension) ? 'cover' : LYRICS.has(extension) ? 'lyrics' : 'other',
    };
    if (base.kind !== 'media') { records.push(base); continue; }
    const probe = probeFile(file, ffprobe);
    const audio = (probe.streams ?? []).filter(stream => stream.codec_type === 'audio');
    if (audio.length !== 1) throw new Error(`Inventory requires exactly one audio stream; failed source content ${hash}.`);
    const duration = number(probe.format?.duration) || number(audio[0].duration);
    if (duration <= 0) throw new Error(`Inventory could not determine duration for source content ${hash}.`);
    const codec = String(audio[0].codec_name ?? '').toLowerCase();
    const bitRate = number(audio[0].bit_rate);
    const action = mediaAction(extension, codec);
    const tags = [probe.format?.tags, audio[0].tags];
    const yearTag = firstTag(tags, ['year', 'date']);
    const year = yearTag?.match(/^(\d{4})(?:\D|$)/)?.[1];
    const languageTag = firstTag(tags, ['language']);
    const cover = (probe.streams ?? []).find(stream => stream.codec_type === 'video' && number(stream.disposition?.attached_pic) === 1);
    Object.assign(base, {
      id: hash, duration: Math.round(duration * 1000) / 1000, audioCodec: codec, audioBitRate: Math.trunc(bitRate), action,
      outputExtension: outputExtension(extension, action), estimatedOutputBytes: estimatedOutputBytes(meta.size, duration, bitRate, action),
      title: firstTag(tags, ['title']), artist: firstTag(tags, ['artist', 'album_artist']), album: firstTag(tags, ['album']), genre: firstTag(tags, ['genre']),
    });
    if (year && Number(year) >= 1900 && Number(year) <= new Date().getUTCFullYear() + 1) base.year = Number(year);
    if (languageTag && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(languageTag)) base.language = languageTag.toLowerCase();
    if (cover) { base.attachedCoverStreamIndex = number(cover.index); base.attachedCoverCodec = nonempty(cover.codec_name); }
    records.push(base);
  }
  return records;
}
export function readInventory(file: string): SourceRecord[] {
  return readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as SourceRecord);
}
export function validateInventory(records: SourceRecord[]): boolean {
  return records.every(record => SHA256.test(record.contentSha256) && (record.kind !== 'media' || record.id === record.contentSha256));
}
