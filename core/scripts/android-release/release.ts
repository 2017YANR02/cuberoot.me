/** Manual release coordinator. Cloud builds committed sources; private signing stays local. */
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANDROID_RELEASE_CERTIFICATE, ANDROID_RELEASE_URL, parseAndroidRelease } from '../../packages/shared/src/android-release.ts';
import { playClient } from './play.ts';
import { parseOptions } from './options.ts';
import { affectsAndroidBuild } from './inputs.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { values, flags } = parseOptions(process.argv.slice(2));
const option = (name: string) => values.get(name);
if (flags.has('--help')) {
  console.log('pnpm android:release [--play internal|production] [--build-only] [--resume DIRECTORY]\nManual only: build main in GitHub, sign on this Mac, publish official APK; optional separate Play AAB submission.\n--build-only signs and retains artifacts without publishing. --resume reuses that exact build.\nHost configuration: ~/.config/cuberoot/android-release/release.json (no passwords).');
  process.exit(0);
}
const configDir = join(homedir(), '.config/cuberoot/android-release');
const configPath = join(configDir, 'release.json');
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {};
const track = option('--play');
if (track && track !== 'internal' && track !== 'production') throw new Error('Expected --play internal|production');
const channel = track ? 'both' : 'direct';
const buildOnly = flags.has('--build-only');
const onlyPlay = flags.has('--only-play');
const repo = '2017YANR02/cuberoot.me';
function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string; inherit?: boolean } = {}): string {
  const result = spawnSync(command, args, { cwd: options.cwd ?? root, env: options.env ?? process.env, input: options.input, encoding: 'utf8', stdio: options.inherit ? 'inherit' : 'pipe', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${(result.stderr ?? '').slice(-1500)}`);
  return result.stdout?.trim() ?? '';
}
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function latest() {
  const response = await fetch(ANDROID_RELEASE_URL, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Release metadata HTTP ${response.status}`);
  return parseAndroidRelease(await response.json());
}
mkdirSync(configDir, { recursive: true, mode: 0o700 });
const lock = join(configDir, 'release.lock');
try { mkdirSync(lock); } catch { throw new Error(`Another release is running; inspect ${lock} before retrying`); }
try {
  const javaHome = config.javaHome ?? '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
  const sdk = config.androidSdk ?? join(homedir(), 'Library/Android/sdk');
  const buildTools = join(sdk, 'build-tools', readdirSync(join(sdk, 'build-tools')).filter(v => /^\d+\.\d+\.\d+$/.test(v)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1)!);
  const javaEnv = { ...process.env, JAVA_HOME: javaHome, PATH: `${javaHome}/bin:${process.env.PATH}` };
  const apkSigner = join(buildTools, 'apksigner');
  const analyzer = join(sdk, 'cmdline-tools/latest/bin/apkanalyzer');
  const keyFile = config.keystore ?? join(configDir, 'cuberoot-upload.jks');
  const keyAlias = config.keyAlias ?? 'cuberoot-upload';
  if (!existsSync(keyFile) || !existsSync(apkSigner) || !existsSync(analyzer)) throw new Error('Android signing tools or existing keystore unavailable');
  const password = run('security', ['find-generic-password', '-s', config.keychainService ?? 'me.cuberoot.app.android-upload', '-w']);
  const signingEnv = { ...javaEnv, CUBEROOT_SIGN_STORE_PASSWORD: password, CUBEROOT_SIGN_KEY_PASSWORD: password };
  const play = track ? await playClient(config.playServiceAccount ?? (() => { throw new Error('Set playServiceAccount in the host release.json'); })()) : null;
  const playState = play ? await play.inspect() : null;
  const previous = await latest();
  let directory: string;
  if (option('--resume')) {
    directory = resolve(option('--resume')!);
  } else {
    run('git', ['fetch', 'origin', 'main']);
    const commit = run('git', ['rev-parse', 'origin/main']);
    if (previous && !track && !buildOnly) {
      const changes = run('git', ['diff', '--name-only', previous.commit, commit]).split('\n').filter(Boolean);
      if (!changes.some(affectsAndroidBuild)) {
        console.log(`No Android changes since ${previous.versionName} (${previous.versionCode}); existing APK retained.`);
        rmSync(lock, { recursive: true, force: true });
        process.exit(0);
      }
    }
    const versionCode = Math.max(previous?.versionCode ?? 1004, playState?.maxVersionCode ?? 1004) + 1;
    const requestId = randomUUID();
    directory = join(configDir, 'builds', `${versionCode}-${requestId}`);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(join(directory, 'request.json'), JSON.stringify({ commit, versionCode, channel, requestId, track, onlyPlay }, null, 2));
    console.log(`Building ${commit.slice(0, 10)}, Android ${versionCode}; ${directory}`);
    run('gh', ['workflow', 'run', 'android_release.yml', '--repo', repo, '--ref', 'main', '-f', `source_commit=${commit}`, '-f', `version_code=${versionCode}`, '-f', `request_id=${requestId}`, '-f', `channel=${channel}`]);
    let runId: number | undefined;
    const deadline = Date.now() + 45 * 60_000;
    while (Date.now() < deadline) {
      const runs = JSON.parse(run('gh', ['run', 'list', '--repo', repo, '--workflow', 'android_release.yml', '--limit', '30', '--json', 'databaseId,displayTitle,status,conclusion,url']));
      const found = runs.find(r => r.displayTitle === `Android release ${requestId}`);
      if (found && !runId) { runId = found.databaseId; console.log(found.url); writeFileSync(join(directory, 'run.json'), JSON.stringify(found)); }
      if (found?.status === 'completed') { if (found.conclusion !== 'success') throw new Error(`Cloud build ${found.conclusion}: ${found.url}`); break; }
      await sleep(15_000);
    }
    if (!runId) throw new Error('Cloud build was not found; request retained for diagnosis');
    const final = JSON.parse(run('gh', ['run', 'view', String(runId), '--repo', repo, '--json', 'conclusion']));
    if (final.conclusion !== 'success') throw new Error('Cloud build did not complete successfully');
    run('gh', ['run', 'download', String(runId), '--repo', repo, '--name', `android-release-${requestId}`, '--dir', join(directory, 'unsigned')]);
  }
  const request = JSON.parse(readFileSync(join(directory, 'request.json'), 'utf8'));
  if (request.onlyPlay && !onlyPlay) throw new Error('Resume this Play-only build with --only-play');
  const unsigned = join(directory, 'unsigned');
  if (!['build.json', 'direct-unsigned.apk', ...(track ? ['play-unsigned.aab'] : [])].every(name => existsSync(join(unsigned, name)))) {
    const runs = JSON.parse(run('gh', ['run', 'list', '--repo', repo, '--workflow', 'android_release.yml', '--limit', '100', '--json', 'databaseId,displayTitle,status,conclusion']));
    const saved = existsSync(join(directory, 'run.json')) ? JSON.parse(readFileSync(join(directory, 'run.json'), 'utf8')) : null;
    const found = saved ? JSON.parse(run('gh', ['run', 'view', String(saved.databaseId), '--repo', repo, '--json', 'databaseId,displayTitle,status,conclusion'])) : runs.find(r => r.displayTitle === `Android release ${request.requestId}`);
    if (found?.conclusion !== 'success') throw new Error('Saved build is not successful yet; retry --resume after it completes');
    // The directory is owned by this request; partial downloads may be safely replaced.
    rmSync(unsigned, { recursive: true, force: true });
    run('gh', ['run', 'download', String(found.databaseId), '--repo', repo, '--name', `android-release-${request.requestId}`, '--dir', unsigned]);
  }
  const build = JSON.parse(readFileSync(join(unsigned, 'build.json'), 'utf8'));
  if (build.commit !== request.commit || build.versionCode !== request.versionCode || build.channel !== request.channel || !/^[a-f0-9]{40}$/.test(build.commit) || !/^\d+\.\d+\.\d+$/.test(build.versionName)) throw new Error('Build identity mismatch');
  if (track && build.channel !== 'both') throw new Error('This build has no Play artifact');
  if (!Number.isSafeInteger(build.versionCode) || build.versionCode <= 1004 || build.versionCode > 2_100_000_000) throw new Error('Invalid version code');
  for (const name of ['direct-unsigned.apk', ...(track ? ['play-unsigned.aab'] : [])]) if (digest(join(unsigned, name)) !== build.files[name]) throw new Error(`Build checksum mismatch: ${name}`);
  const basename = `CubeRoot-${build.versionName}-${build.versionCode}`;
  const apk = join(directory, `${basename}.apk`);
  if (!existsSync(apk)) run(apkSigner, ['sign', '--ks', keyFile, '--ks-key-alias', keyAlias, '--ks-pass', 'env:CUBEROOT_SIGN_STORE_PASSWORD', '--key-pass', 'env:CUBEROOT_SIGN_KEY_PASSWORD', '--out', apk, join(unsigned, 'direct-unsigned.apk')], { env: signingEnv });
  const certificate = run(apkSigner, ['verify', '--verbose', '--print-certs', apk], { env: javaEnv });
  if (!certificate.includes(`certificate SHA-256 digest: ${ANDROID_RELEASE_CERTIFICATE}`)) throw new Error('Unexpected APK signing certificate');
  run(join(buildTools, 'zipalign'), ['-c', '-P', '16', '4', apk], { env: javaEnv });
  const manifest = (field: string) => run(analyzer, ['manifest', field, apk], { env: javaEnv });
  if (manifest('application-id') !== 'me.cuberoot.app' || Number(manifest('version-code')) !== build.versionCode || manifest('version-name') !== build.versionName || manifest('debuggable') !== 'false') throw new Error('Signed APK manifest mismatch');
  const metadata = parseAndroidRelease({ schemaVersion: 1, applicationId: 'me.cuberoot.app', channel: 'direct', versionName: build.versionName, versionCode: build.versionCode, minSdk: Number(manifest('min-sdk')), url: `https://static.cuberoot.me/downloads/android/${basename}.apk`, sha256: digest(apk), certificateSha256: ANDROID_RELEASE_CERTIFICATE, size: statSync(apk).size, commit: build.commit, publishedAt: new Date().toISOString() });
  const metadataFile = join(directory, 'latest.json');
  writeFileSync(metadataFile, JSON.stringify(metadata, null, 2) + '\n');
  let aab: string | undefined;
  if (track) {
    aab = join(directory, `${basename}-play.aab`);
    if (!existsSync(aab)) run(join(javaHome, 'bin/jarsigner'), ['-keystore', keyFile, '-storepass:env', 'CUBEROOT_SIGN_STORE_PASSWORD', '-keypass:env', 'CUBEROOT_SIGN_KEY_PASSWORD', '-signedjar', aab, join(unsigned, 'play-unsigned.aab'), keyAlias], { env: signingEnv });
    const verified = run(join(javaHome, 'bin/jarsigner'), ['-verify', aab], { env: { ...javaEnv, JAVA_TOOL_OPTIONS: '-Duser.language=en' } });
    if (!verified.includes('jar verified.')) throw new Error('AAB signature verification failed');
    const cert = run(join(javaHome, 'bin/keytool'), ['-printcert', '-jarfile', aab], { env: { ...javaEnv, JAVA_TOOL_OPTIONS: '-Duser.language=en' } });
    const fingerprint = cert.match(/SHA256:\s*([A-Fa-f0-9:]+)/)?.[1]?.replaceAll(':', '').toLowerCase();
    if (fingerprint !== ANDROID_RELEASE_CERTIFICATE) throw new Error('Unexpected AAB upload certificate');
  }
  console.log(`Signed and verified ${basename}; SHA-256 ${metadata.sha256}`);
  if (buildOnly) { console.log(`Prepared only. Publish this exact build: pnpm android:release --resume ${directory}${track ? ` --play ${track}` : ''}${onlyPlay ? ' --only-play' : ''}`); }
  else {
    if (!onlyPlay) {
    const current = await latest();
    if (current && current.versionCode >= metadata.versionCode && current.sha256 !== metadata.sha256) throw new Error('A newer/different official APK already exists');
    const host = config.sshHost ?? 'cuberoot';
    if (!/^[a-zA-Z0-9_.-]+$/.test(host)) throw new Error('Invalid SSH host alias');
    const staging = `/tmp/cuberoot-android-${randomUUID()}`;
    run('ssh', ['-o', 'BatchMode=yes', host, `mkdir -m 700 ${staging}`]);
    run('scp', [apk, metadataFile, `${host}:${staging}/`]);
    const remote = `set -euo pipefail
base=/www/wwwroot/toolkit/downloads/android
mkdir -p "$base/releases"
exec 9>"$base/.publish.lock"
flock -x 9
echo '${metadata.sha256}  ${staging}/${basename}.apk' | sha256sum -c -
if test -f "$base/latest.json"; then
  old=$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1])).versionCode' "$base/latest.json")
  test "$old" -le '${metadata.versionCode}'
fi
if test -f "$base/${basename}.apk"; then echo '${metadata.sha256}  '"$base/${basename}.apk" | sha256sum -c -; else mv '${staging}/${basename}.apk' "$base/${basename}.apk"; fi
chmod 644 "$base/${basename}.apk"
curl -fsS --max-time 120 '${metadata.url}' | sha256sum | awk '{print $1}' | grep -Fx '${metadata.sha256}'
mkdir -p "$base/releases/${metadata.versionCode}"
if ! test -f "$base/releases/${metadata.versionCode}/latest.json"; then mv '${staging}/latest.json' "$base/releases/${metadata.versionCode}/latest.json"; fi
chmod 644 "$base/releases/${metadata.versionCode}/latest.json"
cp "$base/${basename}.apk" "$base/latest.apk.next"
mv -f "$base/latest.apk.next" "$base/latest.apk"
cp "$base/releases/${metadata.versionCode}/latest.json" "$base/latest.json.next"
mv -f "$base/latest.json.next" "$base/latest.json"
`;
    run('ssh', ['-o', 'BatchMode=yes', host, 'bash', '-s'], { input: remote });
    const published = await latest();
    if (published?.sha256 !== metadata.sha256 || published.versionCode !== metadata.versionCode) throw new Error('Public metadata verification failed');
    const publicApk = await fetch(metadata.url, { signal: AbortSignal.timeout(120_000) });
    if (!publicApk.ok || createHash('sha256').update(Buffer.from(await publicApk.arrayBuffer())).digest('hex') !== metadata.sha256) throw new Error('Public APK checksum mismatch');
    writeFileSync(join(directory, 'website-published.json'), JSON.stringify(published, null, 2));
    console.log(`Official APK published: ${metadata.url}`);
    }
    if (play && aab && track) {
      const freshPlay = await play.inspect();
      if (freshPlay.maxVersionCode >= build.versionCode) throw new Error('Play version code already used; inspect the existing release before retrying');
      const result = await play.publish(aab, build.versionCode, track, build.versionName);
      writeFileSync(join(directory, 'play-submitted.json'), JSON.stringify({ track, versionCode: build.versionCode, result }, null, 2));
      console.log(`Google Play ${track} submitted. Review/public availability must be checked separately.`);
    }
  }
} finally { rmSync(lock, { recursive: true, force: true }); }
