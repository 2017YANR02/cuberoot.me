/** Import reviewed LRCGET sidecars into a local music library. Defaults to read-only. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

interface Track { id: string; title: string; artist?: string; duration: number; src: string; lyrics?: string; [key: string]: unknown }
interface Manifest { version: number; tracks: Track[] }
interface ReportRow { id: string; title: string; artist: string; status: string; reason?: string; sha256?: string }
const REJECTED = new Map([['93978dcdf9e4b8fbfff43dbc05a94749095fffc71f7321dbd614248c7a74ea8d', 'The Joy Of Life / Kenny G: unexpected vocal lyrics; review recording match']]);
const stamp = /\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g;
function sha256(data: Buffer): string { return createHash('sha256').update(data).digest('hex'); }
function exists(file: string): boolean { return existsSync(file); }

export function inspectLrc(data: Buffer, duration: number): [status: string, reason: string] {
  const rejected = REJECTED.get(sha256(data));
  if (rejected) return ['review', rejected];
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  let body: string;
  try { body = text.decode(data); } catch { return ['review', 'not UTF-8']; }
  if (/\[au:\s*instrumental\s*\]/i.test(body)) return ['instrumental', 'LRCGET instrumental marker'];
  const offset = Number(/\[offset:([+-]?\d+)\]/i.exec(body)?.[1] || 0) / 1000;
  const times: number[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.replace(/\[[^\]]*\]/g, '').trim()) continue;
    for (const m of line.matchAll(stamp)) times.push(Number(m[1]) * 60 + Number(m[2]) + Number((m[3] || '0').padEnd(3, '0')) / 1000 + offset);
  }
  if (!times.length) return ['review', 'no timed text'];
  if (Math.min(...times) < 0 || Math.max(...times) > duration + 2) return ['review', 'timestamps outside recording duration'];
  return ['synced', `${times.length} timed lines`];
}
function writeJson(file: string, value: unknown): void {
  const data = `${JSON.stringify(value, null, 2)}\n`;
  if (exists(file) && readFileSync(file, 'utf8') === data) return;
  const part = `${file}.part`;
  writeFileSync(part, data, 'utf8');
  renameSync(part, file);
}
export function run(rootInput: string, apply = false): { source: string; counts: Record<string, number>; tracks: ReportRow[] } {
  const root = path.resolve(rootInput);
  if (!exists(root)) throw new Error(`Library does not exist: ${root}`);
  const manifestPath = path.join(root, 'manifest.v1.json');
  const original = readFileSync(manifestPath);
  const manifest = JSON.parse(original.toString('utf8')) as Manifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.tracks) || !manifest.tracks.length) throw new Error('Expected a nonempty version 1 music manifest');
  const rows: ReportRow[] = [], assets = new Map<string, Buffer>(), ids = new Set<string>();
  for (const track of manifest.tracks) {
    if (!/^\/music\/library\/tracks\/[a-f0-9]{64}\.(mp3|m4a|flac|wav)$/.test(track.src)) throw new Error('Unexpected audio path');
    if (ids.has(track.id) || !Number.isFinite(track.duration) || track.duration <= 0) throw new Error('Duplicate track id or invalid duration');
    ids.add(track.id);
    const sidecar = path.join(root, 'tracks', `${path.parse(track.src).name}.lrc`);
    const row: ReportRow = { id: track.id, title: track.title, artist: track.artist || '', status: 'missing' };
    delete track.lyrics;
    if (exists(sidecar)) {
      const data = readFileSync(sidecar);
      [row.status, row.reason] = inspectLrc(data, track.duration);
      row.sha256 = sha256(data);
      if (row.status === 'synced') {
        const name = `${row.sha256}.lrc`;
        assets.set(name, data);
        track.lyrics = `/music/library/lyrics/${name}`;
      }
    }
    rows.push(row);
  }
  const counts = Object.fromEntries([...new Set(rows.map(row => row.status))].map(status => [status, rows.filter(row => row.status === status).length]));
  const report = { source: 'LRCGET exported sidecars', counts, tracks: rows };
  if (apply) {
    if (!assets.size) throw new Error('No valid synced lyrics; refusing to replace manifest');
    const inventory = path.join(root, '..', 'inventory');
    mkdirSync(inventory, { recursive: true });
    const backup = path.join(inventory, `manifest-before-lrcget-${sha256(original)}.json`);
    if (JSON.stringify(manifest) !== JSON.stringify(JSON.parse(original.toString('utf8'))) && !exists(backup)) writeFileSync(backup, original);
    const lyrics = path.join(root, 'lyrics');
    mkdirSync(lyrics, { recursive: true });
    for (const [name, data] of assets) {
      const dest = path.join(lyrics, name);
      if (exists(dest)) {
        if (!readFileSync(dest).equals(data)) throw new Error('Content-addressed asset mismatch');
      } else writeFileSync(dest, data);
    }
    writeJson(path.join(inventory, 'lrcget-import.v1.json'), report);
    writeJson(manifestPath, manifest);
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const index = args.indexOf('--library');
  const library = index >= 0 ? args[index + 1] : process.env.CUBEROOT_MUSIC_LIBRARY;
  if (!library) throw new Error('Pass --library <directory> or set CUBEROOT_MUSIC_LIBRARY');
  console.log(JSON.stringify(run(library, args.includes('--apply')).counts));
}
