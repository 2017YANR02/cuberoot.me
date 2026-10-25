/** Executed on the static host under flock. No credentials or shell interpolation. */
import { createHash } from 'node:crypto';
import { copyFile, link, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function publish(directory, platform, base = '/www/wwwroot/toolkit/downloads') {
  if (!['android', 'windows'].includes(platform)) throw new Error('Invalid platform');
  const source = resolve(directory);
  const metadata = JSON.parse(await readFile(join(source, 'latest.json'), 'utf8'));
  if (!Number.isSafeInteger(metadata.versionCode) || metadata.versionCode < 1
    || !/^\d+\.\d+\.\d+$/.test(metadata.versionName) || !/^[a-f0-9]{40}$/.test(metadata.commit)) throw new Error('Invalid identity');
  const files = platform === 'android' ? [metadata] : [metadata.files?.installer, metadata.files?.portable];
  const target = join(base, platform);
  await mkdir(target, { recursive: true });
  const manifestPath = join(target, 'latest.json');
  let previous;
  try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (previous && previous.versionCode > metadata.versionCode) throw new Error('Refusing downgrade');
  if (previous?.versionCode === metadata.versionCode && JSON.stringify(previous) !== JSON.stringify(metadata)) throw new Error('Published version is immutable');
  for (const file of files) {
    if (!file || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 1) throw new Error('Invalid artifact');
    const name = basename(file.url);
    const expected = platform === 'android' ? `CubeRoot-${metadata.versionName}-${metadata.versionCode}.apk` : `CubeRoot-${metadata.versionName}-${metadata.versionCode}-x64-${file === files[0] ? 'installer' : 'portable'}.exe`;
    if (name !== expected || file.url !== `https://static.cuberoot.me/downloads/${platform}/${expected}`) throw new Error('Invalid artifact URL');
    const data = await readFile(join(source, name));
    if (data.length !== file.size || createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error('Artifact checksum mismatch');
    const temporary = join(target, `${name}.next`);
    await writeFile(temporary, data, { mode: 0o644 });
    try { await link(temporary, join(target, name)); }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    finally { await unlink(temporary); }
    const stored = await readFile(join(target, name));
    if (createHash('sha256').update(stored).digest('hex') !== file.sha256) throw new Error('Immutable artifact conflict');
    const response = await fetch(file.url, { signal: AbortSignal.timeout(120_000), cache: 'no-store' });
    if (!response.ok || createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex') !== file.sha256) throw new Error('Public artifact verification failed');
  }
  const archive = join(target, 'releases', String(metadata.versionCode));
  await mkdir(archive, { recursive: true });
  await writeFile(join(archive, 'latest.json'), JSON.stringify(metadata) + '\n', { mode: 0o644 });
  if (platform === 'android') {
    await copyFile(join(target, basename(metadata.url)), join(target, 'latest.apk.next'));
    await rename(join(target, 'latest.apk.next'), join(target, 'latest.apk'));
  }
  await writeFile(join(target, 'latest.json.next'), JSON.stringify(metadata) + '\n', { mode: 0o644 });
  await rename(join(target, 'latest.json.next'), manifestPath);
  console.log(`Published ${platform} ${metadata.versionName} (${metadata.versionCode})`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await publish(process.argv[2], process.argv[3]);
