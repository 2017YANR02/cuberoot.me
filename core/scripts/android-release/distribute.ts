/** CI packaging only. Production publication is a separate protected job. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ANDROID_RELEASE_CERTIFICATE, parseAndroidRelease, parseWindowsRelease, releaseIdentity } from '../../packages/shared/src/android-release.ts';

const root = resolve(import.meta.dirname, '../../..');
const identity = releaseIdentity(Number(process.env.GITHUB_RUN_NUMBER));
const commit = process.env.RELEASE_COMMIT ?? '';
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Exact release commit required');
const mode = process.argv[2];
const output = join(root, 'release-staging');
const notes = process.env.RELEASE_NOTES ?? '';
if (!notes.trim() || notes.length > 4000) throw new Error('Release notes required');
function run(command: string, args: string[], env = process.env) {
  const result = spawnSync(command, args, { encoding: 'utf8', env });
  if (result.error || result.status !== 0) throw new Error(`Artifact verification failed: ${command}`);
  return result.stdout.trim();
}
function artifact(source: string, name: string, platform: string) {
  mkdirSync(output, { recursive: true });
  copyFileSync(source, join(output, name));
  return { url: `https://static.cuberoot.me/downloads/${platform}/${name}`, size: statSync(source).size,
    sha256: createHash('sha256').update(readFileSync(source)).digest('hex') };
}
if (mode === 'prepare') {
  // Change only the ephemeral checkout; never commit CI-generated version bumps.
  for (const relative of ['core/apps/mobile/package.json', 'core/apps/desktop/package.json', 'core/apps/desktop/src-tauri/tauri.conf.json']) {
    const path = join(root, relative);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    json.version = identity.versionName;
    writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  }
  if (!process.env.GITHUB_ENV) throw new Error('CI environment file required');
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_ENV, `MOBILE_VERSION_CODE=${identity.versionCode}\nRELEASE_VERSION=${identity.versionName}\n`);
} else if (mode === 'android') {
  const sdk = process.env.ANDROID_HOME!;
  const version = readdirSync(join(sdk, 'build-tools')).filter(v => /^\d+\.\d+\.\d+$/.test(v)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1)!;
  const tools = join(sdk, 'build-tools', version);
  const apk = join(root, 'core/apps/mobile/android/app/build/direct/outputs/apk/release/app-release.apk');
  const cert = run(join(tools, 'apksigner'), ['verify', '--verbose', '--print-certs', apk]);
  if (!cert.includes(`certificate SHA-256 digest: ${ANDROID_RELEASE_CERTIFICATE}`)) throw new Error('Wrong Android signing key');
  run(join(tools, 'zipalign'), ['-c', '-P', '16', '4', apk]);
  const analyzer = join(sdk, 'cmdline-tools/latest/bin/apkanalyzer');
  const manifest = (field: string) => run(analyzer, ['manifest', field, apk]);
  if (manifest('application-id') !== 'me.cuberoot.app' || manifest('debuggable') !== 'false'
    || manifest('version-name') !== identity.versionName || Number(manifest('version-code')) !== identity.versionCode) throw new Error('APK identity mismatch');
  const file = artifact(apk, `CubeRoot-${identity.versionName}-${identity.versionCode}.apk`, 'android');
  const metadata = parseAndroidRelease({ schemaVersion: 1, applicationId: 'me.cuberoot.app', channel: 'direct', ...identity, ...file,
    certificateSha256: ANDROID_RELEASE_CERTIFICATE, minSdk: Number(manifest('min-sdk')), commit, publishedAt: new Date().toISOString() });
  writeFileSync(join(output, 'latest.json'), JSON.stringify({ ...metadata, notes }, null, 2));
} else if (mode === 'windows') {
  if (process.platform !== 'win32') throw new Error('Windows packaging requires Windows');
  const release = join(root, 'core/apps/desktop/src-tauri/target/release');
  const installers = readdirSync(join(release, 'bundle/nsis')).filter(n => n.endsWith('.exe'));
  if (installers.length !== 1) throw new Error('Expected one Windows installer');
  for (const path of [join(release, 'cuberoot-desktop.exe'), join(release, 'bundle/nsis', installers[0]!)]) {
    const version = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '(Get-Item -LiteralPath $env:CUBEROOT_VERIFY_EXE).VersionInfo.ProductVersion'], { ...process.env, CUBEROOT_VERIFY_EXE: path });
    if (version.split('.').slice(0, 3).join('.') !== identity.versionName) throw new Error('Windows binary version mismatch');
  }
  const prefix = `CubeRoot-${identity.versionName}-${identity.versionCode}-x64`;
  const metadata = parseWindowsRelease({ schemaVersion: 1, platform: 'windows', arch: 'x64', ...identity, commit,
    publishedAt: new Date().toISOString(), notes, files: {
      installer: artifact(join(release, 'bundle/nsis', installers[0]!), `${prefix}-installer.exe`, 'windows'),
      portable: artifact(join(release, 'cuberoot-desktop.exe'), `${prefix}-portable.exe`, 'windows'),
    } });
  writeFileSync(join(output, 'latest.json'), JSON.stringify(metadata, null, 2));
} else throw new Error('Expected prepare, android or windows');
