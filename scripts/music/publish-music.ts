/** Validate and optionally publish a content-addressed static music library. */
import { existsSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GIB, SHA256, fileSha256, readJson, runAsync, validateArgs, within } from './music-shared.js';

const PREFIX = '/music/library/';
const EXTENSIONS: Record<AssetKind, ReadonlySet<string>> = {
  tracks: new Set(['.mp3', '.m4a', '.flac', '.wav']),
  covers: new Set(['.jpg', '.jpeg', '.png', '.webp']),
  lyrics: new Set(['.lrc']),
};
type AssetKind = 'tracks' | 'covers' | 'lyrics';
interface Track { id: string; title: string; duration: number; src: string; cover?: string; lyrics?: string; [key: string]: unknown }
interface Manifest { version: number; tracks: Track[] }
interface Asset { kind: AssetKind; publicPath: string; relativePath: string; fullPath: string; sha256: string; bytes: number }
export interface Library { root: string; manifestPath: string; manifestBytes: number; manifestSha256: string; manifest: Manifest; tracks: Track[]; assets: Asset[] }
interface RemoteOptions { host: string; documentRoot: string; stagingRoot: string; publicBaseUri: URL; reserveGiB: number; connectTimeoutSeconds: number }
interface Missing { sha256: string; bytes: number; relativePath: string }
interface Audit { missing: Missing[]; summary: { neededBytes: number; availableBytes: number; device: string; currentManifestBytes: number } }

function remotePath(path: string, label: string): string {
  if (!/^\/[A-Za-z0-9._/-]+$/.test(path) || path.includes('//') || path.split('/').some(part => part === '.' || part === '..')) {
    throw new Error(`${label} must be an absolute remote path containing only safe ASCII segments.`);
  }
  return path.replace(/\/$/, '');
}
function remoteJoin(base: string, child: string): string { return `${base.replace(/\/$/, '')}/${child.replace(/^\//, '')}`; }
function shellPath(value: string): string { return `'${value}'`; } // Paths above reject quotes and shell metacharacters.
function shaFileName(path: string): string { return basename(path, extname(path)).toLowerCase(); }

async function assetFor(publicPath: string, kind: AssetKind, root: string): Promise<Asset> {
  const expected = `${PREFIX}${kind}/`;
  if (!publicPath.startsWith(expected)) throw new Error(`${kind} reference must start with ${expected}`);
  const fileName = publicPath.slice(expected.length);
  if (!fileName || /[\\/?#]/.test(fileName)) throw new Error(`Invalid ${kind} asset reference: ${publicPath}`);
  const extension = extname(fileName).toLowerCase();
  const sha256 = shaFileName(fileName);
  if (!SHA256.test(sha256) || !EXTENSIONS[kind].has(extension)) throw new Error(`${kind} asset must use a SHA-256 filename and supported extension: ${publicPath}`);
  const relativePath = `${kind}/${fileName}`;
  const fullPath = resolve(root, kind, fileName);
  if (!within(root, fullPath) || fullPath === root) throw new Error(`Asset escapes LibraryRoot: ${publicPath}`);
  if (!existsSync(fullPath) || !statSync(fullPath).isFile()) throw new Error(`Manifest references a missing local asset: ${publicPath}`);
  const bytes = statSync(fullPath).size;
  if (bytes <= 0) throw new Error(`Manifest references an empty asset: ${publicPath}`);
  if (await fileSha256(fullPath) !== sha256) throw new Error(`Local asset SHA-256 does not match its filename: ${publicPath}`);
  return { kind, publicPath, relativePath, fullPath, sha256, bytes };
}

export async function validateMusicLibrary(rootInput: string): Promise<Library> {
  const root = resolve(rootInput);
  const manifestPath = join(root, 'manifest.v1.json');
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) throw new Error(`Missing manifest: ${manifestPath}`);
  let manifest: Manifest;
  try { manifest = readJson<Manifest>(manifestPath); } catch (error) { throw new Error(`manifest.v1.json is not valid JSON: ${String(error)}`); }
  if (manifest.version !== 1 || !Array.isArray(manifest.tracks) || manifest.tracks.length === 0) throw new Error('manifest.v1.json must have version 1 and at least one track.');
  const ids = new Set<string>();
  const assets = new Map<string, Asset>();
  for (const track of manifest.tracks) {
    if (!SHA256.test(track.id)) throw new Error('Every track id must be a lowercase SHA-256 value.');
    if (ids.has(track.id)) throw new Error(`Duplicate track id: ${track.id}`);
    ids.add(track.id);
    if (!track.title?.trim()) throw new Error(`Track ${track.id} has no title.`);
    if (typeof track.duration !== 'number' || !Number.isFinite(track.duration) || track.duration <= 0) throw new Error(`Track ${track.id} has an invalid duration.`);
    for (const [kind, publicPath, required] of [['tracks', track.src, true], ['covers', track.cover, false], ['lyrics', track.lyrics, false]] as const) {
      if (!publicPath) { if (required) throw new Error(`Track ${track.id} has no audio source.`); continue; }
      if (!assets.has(publicPath)) assets.set(publicPath, await assetFor(publicPath, kind, root));
      else if (assets.get(publicPath)?.kind !== kind) throw new Error(`Asset is referenced with conflicting kinds: ${publicPath}`);
    }
  }
  return {
    root, manifestPath, manifestBytes: statSync(manifestPath).size,
    manifestSha256: await fileSha256(manifestPath), manifest, tracks: manifest.tracks,
    assets: [...assets.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en')),
  };
}

function sshOptions(timeout: number): string[] {
  return ['-o', 'BatchMode=yes', '-o', `ConnectTimeout=${timeout}`, '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4'];
}
async function ssh(config: RemoteOptions, command: string, input?: string): Promise<string> {
  return runAsync('ssh', [...sshOptions(config.connectTimeoutSeconds), config.host, command], { input });
}
async function scp(config: RemoteOptions, local: string, remote: string): Promise<void> {
  await runAsync('scp', [...sshOptions(config.connectTimeoutSeconds), local, `${config.host}:${remote}`]);
}

const AUDIT = String.raw`set -eu
live='__LIVE__'
stage='__STAGE__'
inventory="$stage/inventory.v1.tsv"
missing="$stage/missing.v1.tsv"
mkdir -p "$live/tracks" "$live/covers" "$live/lyrics" "$stage/files/tracks" "$stage/files/covers" "$stage/files/lyrics"
live_device="$(stat -c '%d' "$live")"
stage_device="$(stat -c '%d' "$stage")"
if [ "$live_device" != "$stage_device" ]; then echo 'staging and live library are on different filesystems' >&2; exit 31; fi
: > "$missing"
needed=0
while IFS="$(printf '\t')" read -r expected_hash expected_bytes relative_path; do
  [ -n "$expected_hash" ] || continue
  case "$relative_path" in tracks/*|covers/*|lyrics/*) ;; *) echo 'unsafe inventory path' >&2; exit 32 ;; esac
  case "$relative_path" in *'..'*|*//*|*\\*) echo 'unsafe inventory path' >&2; exit 32 ;; esac
  target="$live/$relative_path"
  if [ -e "$target" ]; then
    [ -f "$target" ] || { echo 'asset target is not a regular file' >&2; exit 33; }
    [ "$(stat -c '%s' "$target")" = "$expected_bytes" ] || { echo 'existing asset size conflict' >&2; exit 34; }
    [ "$(sha256sum "$target" | awk '{print $1}')" = "$expected_hash" ] || { echo 'existing asset hash conflict' >&2; exit 35; }
  else
    printf 'MISSING\t%s\t%s\t%s\n' "$expected_hash" "$expected_bytes" "$relative_path"
    printf '%s\t%s\t%s\n' "$expected_hash" "$expected_bytes" "$relative_path" >> "$missing"
    needed=$((needed + expected_bytes))
  fi
done < "$inventory"
available="$(df -B1 --output=avail "$live" | tail -n 1 | tr -d ' ')"
current_manifest_bytes=0
if [ -e "$live/manifest.v1.json" ]; then
  [ -f "$live/manifest.v1.json" ] || { echo 'live manifest is not a regular file' >&2; exit 36; }
  current_manifest_bytes="$(stat -c '%s' "$live/manifest.v1.json")"
fi
printf 'SUMMARY\t%s\t%s\t%s\t%s\n' "$needed" "$available" "$live_device" "$current_manifest_bytes"`;

async function auditRemote(config: RemoteOptions, assets: Asset[], stage: string, live: string): Promise<Audit> {
  const inventory = `${assets.map(a => `${a.sha256}\t${a.bytes}\t${a.relativePath}`).join('\n')}\n`;
  await ssh(config, `umask 022; mkdir -p ${shellPath(stage)}; tr -d '\r' > ${shellPath(remoteJoin(stage, 'inventory.v1.tsv'))}`, inventory);
  const output = await ssh(config, AUDIT.replaceAll('__LIVE__', live).replaceAll('__STAGE__', stage));
  const missing: Missing[] = [];
  let summary: Audit['summary'] | undefined;
  for (const line of output.split(/\r?\n/)) {
    const cols = line.split('\t');
    if (cols[0] === 'MISSING' && cols.length === 4) missing.push({ sha256: cols[1], bytes: Number(cols[2]), relativePath: cols[3] });
    if (cols[0] === 'SUMMARY' && cols.length === 5) summary = { neededBytes: Number(cols[1]), availableBytes: Number(cols[2]), device: cols[3], currentManifestBytes: Number(cols[4]) };
  }
  if (!summary || ![summary.neededBytes, summary.availableBytes, summary.currentManifestBytes].every(Number.isSafeInteger)) throw new Error('Remote audit returned no valid capacity summary.');
  return { missing, summary };
}

const PROMOTE = String.raw`set -eu
part='__PART__'
final='__FINAL__'
expected_hash='__HASH__'
expected_bytes='__BYTES__'
[ -f "$part" ] || { echo 'staged asset is missing' >&2; exit 41; }
[ "$(stat -c '%s' "$part")" = "$expected_bytes" ] || { echo 'staged asset size mismatch' >&2; exit 42; }
[ "$(sha256sum "$part" | awk '{print $1}')" = "$expected_hash" ] || { echo 'staged asset hash mismatch' >&2; exit 43; }
chmod 0644 "$part"
if [ -e "$final" ]; then
  [ -f "$final" ] || { echo 'asset target is not a regular file' >&2; exit 44; }
  [ "$(stat -c '%s' "$final")" = "$expected_bytes" ] || { echo 'concurrent asset size conflict' >&2; exit 45; }
  [ "$(sha256sum "$final" | awk '{print $1}')" = "$expected_hash" ] || { echo 'concurrent asset hash conflict' >&2; exit 46; }
else
  mv "$part" "$final"
fi`;

const CUTOVER = String.raw`set -eu
live='__LIVE__'
stage='__STAGE__'
candidate="$stage/manifest.v1.json.part"
current="$live/manifest.v1.json"
previous="$stage/manifest.v1.previous.json"
previous_part="$stage/manifest.v1.previous.json.part"
[ -f "$candidate" ] || { echo 'manifest candidate is missing' >&2; exit 51; }
[ "$(stat -c '%s' "$candidate")" = '__BYTES__' ] || { echo 'manifest candidate size mismatch' >&2; exit 52; }
[ "$(sha256sum "$candidate" | awk '{print $1}')" = '__HASH__' ] || { echo 'manifest candidate hash mismatch' >&2; exit 53; }
chmod 0644 "$candidate"
if [ -f "$current" ]; then
  cp -p "$current" "$previous_part"
  chmod 0644 "$previous_part"
  mv -f "$previous_part" "$previous"
fi
mv -f "$candidate" "$current"`;

const ROLLBACK = String.raw`set -eu
live='__LIVE__'
stage='__STAGE__'
current="$live/manifest.v1.json"
previous="$stage/manifest.v1.previous.json"
failed="$stage/manifest.v1.failed.json"
rollback="$stage/manifest.v1.rollback.json.part"
if [ -f "$current" ]; then cp -p "$current" "$failed"; fi
if [ -f "$previous" ]; then
  cp -p "$previous" "$rollback"
  chmod 0644 "$rollback"
  mv -f "$rollback" "$current"
elif [ -f "$current" ]; then
  mv "$current" "$stage/manifest.v1.first-release-failed.json"
fi`;

export const REMOTE_SCRIPTS = { audit: AUDIT, promote: PROMOTE, cutover: CUTOVER, rollback: ROLLBACK } as const;

function replace(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`__${name}__`, value), template);
}
async function publishAsset(config: RemoteOptions, asset: Asset, stage: string, live: string): Promise<void> {
  const part = remoteJoin(stage, `files/${asset.relativePath}.part`);
  const final = remoteJoin(live, asset.relativePath);
  console.log(`Uploading ${asset.relativePath} (${(asset.bytes / 1024 ** 2).toFixed(1)} MiB)...`);
  await scp(config, asset.fullPath, part);
  await ssh(config, replace(PROMOTE, { PART: part, FINAL: final, HASH: asset.sha256, BYTES: String(asset.bytes) }));
}
async function publishManifest(config: RemoteOptions, library: Library, stage: string, live: string): Promise<void> {
  await scp(config, library.manifestPath, remoteJoin(stage, 'manifest.v1.json.part'));
  await ssh(config, replace(CUTOVER, { LIVE: live, STAGE: stage, BYTES: String(library.manifestBytes), HASH: library.manifestSha256 }));
}
async function restoreManifest(config: RemoteOptions, stage: string, live: string): Promise<void> {
  await ssh(config, replace(ROLLBACK, { LIVE: live, STAGE: stage }));
}

function header(response: Response, name: string): string { return response.headers.get(name) ?? ''; }
export async function verifyPublicContract(library: Library, publicBaseUri: URL): Promise<void> {
  const manifestUri = new URL(`${PREFIX}manifest.v1.json`, publicBaseUri.origin);
  const manifestResponse = await fetch(manifestUri, { headers: { Origin: 'https://cuberoot.me' }, cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  if (manifestResponse.status !== 200) throw new Error(`Manifest HTTP status was ${manifestResponse.status}, expected 200.`);
  const publicBytes = Buffer.from(await manifestResponse.arrayBuffer());
  const { createHash } = await import('node:crypto');
  if (createHash('sha256').update(publicBytes).digest('hex') !== library.manifestSha256) throw new Error('Public manifest bytes do not match the release candidate.');
  if (header(manifestResponse, 'Access-Control-Allow-Origin') !== '*') throw new Error('Manifest CORS header is missing or incorrect.');
  if (!/(^|,\s*)no-cache(,|$)/.test(header(manifestResponse, 'Cache-Control'))) throw new Error('Manifest must be served with Cache-Control: no-cache.');
  const audio = library.assets.find(asset => asset.kind === 'tracks');
  if (!audio) throw new Error('Manifest has no audio asset.');
  const audioUri = new URL(audio.publicPath, publicBaseUri.origin);
  const head = await fetch(audioUri, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
  if (head.status !== 200 || !/(^|,\s*)bytes(,|$)/.test(header(head, 'Accept-Ranges'))) throw new Error('Asset HEAD response must be 200 and advertise byte ranges.');
  const range = await fetch(audioUri, { headers: { Origin: 'https://cuberoot.me', Range: 'bytes=0-1' }, signal: AbortSignal.timeout(30_000) });
  if (range.status !== 206) throw new Error(`Range HTTP status was ${range.status}, expected 206.`);
  if ((await range.arrayBuffer()).byteLength !== 2 || !/^bytes 0-1\/\d+$/.test(header(range, 'Content-Range'))) throw new Error('Range response must contain exactly two bytes with a valid Content-Range.');
  if (header(range, 'Access-Control-Allow-Origin') !== '*') throw new Error('Asset CORS header is missing or incorrect.');
  const cache = header(range, 'Cache-Control');
  if (!cache.includes('max-age=31536000') || !cache.includes('immutable')) throw new Error('Content-addressed assets must have immutable one-year caching.');
  const exposed = header(range, 'Access-Control-Expose-Headers').split(',').map(x => x.trim().toLowerCase());
  for (const name of ['Accept-Ranges', 'Content-Range', 'ETag', 'Last-Modified']) {
    if (!exposed.includes(name.toLowerCase())) throw new Error(`CORS does not expose ${name}.`);
  }
}

export async function publishMusic(library: Library, config: RemoteOptions): Promise<{ uploaded: number }> {
  if (!/^(?:[A-Za-z0-9._-]+@)?[A-Za-z0-9._-]+$/.test(config.host)) throw new Error('RemoteHost must be an SSH alias, optionally prefixed by a user.');
  const documentRoot = remotePath(config.documentRoot, 'RemoteDocumentRoot');
  const stagingRoot = remotePath(config.stagingRoot, 'RemoteStagingRoot');
  if (within(documentRoot, stagingRoot) || stagingRoot === documentRoot || stagingRoot.startsWith(`${documentRoot}/`)) throw new Error('RemoteStagingRoot must be outside the public document root.');
  if (config.publicBaseUri.protocol !== 'https:') throw new Error('PublicBaseUri must be an absolute HTTPS URI.');
  const live = remoteJoin(documentRoot, 'music/library');
  const stage = remoteJoin(stagingRoot, `releases/${library.manifestSha256}`);
  const byPath = new Map(library.assets.map(asset => [asset.relativePath, asset]));
  console.log('Auditing existing remote content and available capacity...');
  const audit = await auditRemote(config, library.assets, stage, live);
  const required = audit.summary.neededBytes + library.manifestBytes + audit.summary.currentManifestBytes + config.reserveGiB * GIB;
  if (audit.summary.availableBytes < required) throw new Error(`Insufficient remote space: missing assets need ${(audit.summary.neededBytes / GIB).toFixed(2)} GiB, ${config.reserveGiB} GiB reserve required.`);
  for (const missing of audit.missing) {
    const asset = byPath.get(missing.relativePath);
    if (!asset || asset.sha256 !== missing.sha256 || asset.bytes !== missing.bytes) throw new Error(`Remote audit returned inconsistent metadata for ${missing.relativePath}`);
    await publishAsset(config, asset, stage, live);
  }
  console.log('Revalidating every remote asset before manifest cutover...');
  const finalAudit = await auditRemote(config, library.assets, stage, live);
  if (finalAudit.missing.length || finalAudit.summary.neededBytes !== 0) throw new Error('Remote library is still incomplete; manifest was not changed.');
  if (finalAudit.summary.availableBytes < config.reserveGiB * GIB + library.manifestBytes + finalAudit.summary.currentManifestBytes) throw new Error('Remote reserve was consumed during upload; manifest was not changed.');
  console.log('All assets verified. Atomically switching the manifest...');
  await publishManifest(config, library, stage, live);
  try { await verifyPublicContract(library, config.publicBaseUri); }
  catch (error) {
    console.warn('HTTP verification failed; restoring the previous manifest.');
    try { await restoreManifest(config, stage, live); }
    catch (rollbackError) { throw new Error(`HTTP verification failed and automatic rollback also failed. Verification: ${String(error)} Rollback: ${String(rollbackError)}`); }
    throw error;
  }
  return { uploaded: audit.missing.length };
}

function option(args: string[], name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} requires a value.`);
  return args[index + 1];
}
export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.includes('--help')) {
    console.log('Usage: tsx scripts/music/publish-music.ts --library <path> [--publish --remote-host <host> --remote-document-root <path> --remote-staging-root <path> --public-base-uri <https-url>]');
    return;
  }
  validateArgs(args, ['--publish'], ['--library', '--remote-host', '--remote-document-root', '--remote-staging-root', '--public-base-uri', '--reserve-gib', '--connect-timeout-seconds']);
  const libraryRoot = option(args, '--library', process.env.MUSIC_LIBRARY_ROOT);
  if (!libraryRoot) throw new Error('--library or MUSIC_LIBRARY_ROOT is required.');
  const library = await validateMusicLibrary(libraryRoot);
  const bytes = library.assets.reduce((sum, asset) => sum + asset.bytes, 0);
  console.log(`Validated ${library.tracks.length} tracks and ${library.assets.length} unique assets (${(bytes / GIB).toFixed(2)} GiB); manifest SHA-256 ${library.manifestSha256}.`);
  if (!args.includes('--publish')) { console.log('Validation-only mode: no remote connection or upload was attempted.'); return; }
  const host = option(args, '--remote-host', process.env.MUSIC_REMOTE_HOST);
  const documentRoot = option(args, '--remote-document-root', process.env.MUSIC_REMOTE_DOCUMENT_ROOT);
  const stagingRoot = option(args, '--remote-staging-root', process.env.MUSIC_REMOTE_STAGING_ROOT);
  const publicUri = option(args, '--public-base-uri', process.env.MUSIC_PUBLIC_BASE_URI);
  if (!host || !documentRoot || !stagingRoot || !publicUri) throw new Error('Publishing requires explicit remote host, document root, staging root and public HTTPS URI.');
  const reserveGiB = Number(option(args, '--reserve-gib', '10'));
  const connectTimeoutSeconds = Number(option(args, '--connect-timeout-seconds', '15'));
  if (!Number.isInteger(reserveGiB) || reserveGiB < 1 || reserveGiB > 1024) throw new Error('reserve-gib must be 1..1024.');
  if (!Number.isInteger(connectTimeoutSeconds) || connectTimeoutSeconds < 5 || connectTimeoutSeconds > 300) throw new Error('connect-timeout-seconds must be 5..300.');
  const result = await publishMusic(library, { host, documentRoot, stagingRoot, publicBaseUri: new URL(publicUri), reserveGiB, connectTimeoutSeconds });
  console.log(`Published ${library.tracks.length} tracks; uploaded ${result.uploaded} new assets; previous manifest retained.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
