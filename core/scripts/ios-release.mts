import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const core = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = join(core, 'apps/mobile');
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  'build-number': { type: 'string' }, dir: { type: 'string' },
  profile: { type: 'string' }, help: { type: 'boolean' },
} });
const command = positionals[0] ?? 'plan';
const app = 'me.cuberoot.app';
const version = JSON.parse(readFileSync(join(mobile, 'package.json'), 'utf8')).version;
const profile = values.profile ? ['--profile', values.profile] : [];

function run(bin: string, args: string[], capture = false): string {
  const result = spawnSync(bin, args, { cwd: core, encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${bin} failed (${result.status ?? result.signal}).`);
  return result.stdout?.trim() ?? '';
}
function asc(args: string[], capture = false) {
  return run('asc', [...profile, ...args], capture);
}
function sha256(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

try {
  if (values.help) {
    console.log('ios:release [plan|status|archive|upload] [--build-number N] [--dir PATH] [--profile NAME]\n'
      + 'Default plan is offline. archive builds/signs locally; upload sends the recorded IPA to Apple.');
  } else if (positionals.length > 1 || !['plan', 'status', 'archive', 'upload'].includes(command)) {
    throw new Error('Unknown command. Use --help.');
  } else if (command === 'status') {
    asc(['--read-only', 'status', '--app', app, '--platform', 'IOS', '--output', 'table']);
  } else if (command === 'plan') {
    console.log(JSON.stringify({ app, version, steps: [
      'asc auth login (system Keychain); ios:release status',
      'ios:release archive --build-number <unused number> [--dir <new directory>]',
      'Review archive, privacy report and release.json; complete device acceptance',
      'ios:release upload --dir <same directory> [--profile <name>]',
    ], notes: 'Upload waits for Apple processing; it does not assign testers, answer compliance, or submit App Review.' }, null, 2));
  } else if (command === 'archive') {
    if (process.platform !== 'darwin') throw new Error('Archive requires macOS and Xcode.');
    const build = values['build-number'];
    if (!build || !/^[1-9]\d{0,3}(?:\.\d{1,2}){0,2}$/.test(build)) {
      throw new Error('Supply an unused Apple build number with --build-number (up to 4.2.2 digits).');
    }
    const dir = resolve(values.dir ?? join(homedir(), 'Library/Developer/CubeRootReleases', `ios-${version}-${build}`));
    if (existsSync(dir)) throw new Error('Release directory already exists; choose a new --dir. Existing artifacts are preserved.');
    run('node', [join(core, 'scripts/mobile-ios-toolchain.mjs'), 'doctor']);
    asc(['version']);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const receipt = { app, version, build, sourceCommit: run('git', ['rev-parse', 'HEAD'], true),
      sourceStatus: run('git', ['status', '--porcelain'], true), createdAt: new Date().toISOString() };
    writeFileSync(join(dir, 'source.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
    run('pnpm', ['--filter', '@cuberoot/mobile', 'cap:sync:ios']);
    const archive = join(dir, 'App.xcarchive');
    const ipa = join(dir, 'App.ipa');
    asc(['xcode', 'archive', '--project', join(mobile, 'ios/App/App.xcodeproj'), '--scheme', 'App',
      '--configuration', 'Release', '--archive-path', archive,
      '--xcodebuild-flag=-destination', '--xcodebuild-flag=generic/platform=iOS',
      `--xcodebuild-flag=CURRENT_PROJECT_VERSION=${build}`, '--xcodebuild-flag=-allowProvisioningUpdates']);
    const exportOptions = join(dir, 'ExportOptions.plist');
    writeFileSync(exportOptions, `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>destination</key><string>export</string>
<key>signingStyle</key><string>automatic</string>
<key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>\n`);
    asc(['xcode', 'export', '--archive-path', archive, '--ipa-path', ipa,
      '--export-options', exportOptions, '--xcodebuild-flag=-allowProvisioningUpdates']);
    run('codesign', ['--verify', '--deep', '--strict', join(archive, 'Products/Applications/App.app')]);
    const ipaInfo = asc(['ipa-info', '--path', ipa, '--output', 'json'], true);
    writeFileSync(join(dir, 'ipa-info.json'), ipaInfo + '\n', { mode: 0o600 });
    const identity = JSON.parse(ipaInfo);
    if (identity.bundleId !== app || identity.version !== version || identity.buildNumber !== build) {
      throw new Error('Exported IPA bundle ID, version or build number does not match the release. Nothing uploaded.');
    }
    writeFileSync(join(dir, 'release.json'), JSON.stringify({ ...receipt, ipaSha256: sha256(ipa) }, null, 2), { mode: 0o600 });
    console.log(`Archive and IPA saved to ${dir}. Nothing uploaded.`);
  } else {
    if (!values.dir) throw new Error('upload requires --dir from a completed archive.');
    const dir = resolve(values.dir);
    const ipa = join(dir, 'App.ipa');
    const receipt = JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8'));
    if (receipt.app !== app || receipt.ipaSha256 !== sha256(ipa)) throw new Error('Release identity or IPA checksum mismatch.');
    const upload = asc(['builds', 'upload', '--app', app, '--ipa', ipa, '--wait', '--output', 'json'], true);
    writeFileSync(join(dir, 'upload.json'), upload + '\n', { mode: 0o600 });
    console.log(upload);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
