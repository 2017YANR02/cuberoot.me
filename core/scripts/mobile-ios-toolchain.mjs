import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'mobile');
const XCODE_PROJECT = join(MOBILE_ROOT, 'ios', 'App', 'App.xcodeproj');

function checkVersion() {
  const packageVersion = JSON.parse(readFileSync(join(MOBILE_ROOT, 'package.json'), 'utf8')).version;
  const project = readFileSync(join(XCODE_PROJECT, 'project.pbxproj'), 'utf8');
  const marketingVersions = [...project.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]);
  if (marketingVersions.length === 0 || marketingVersions.some((version) => version !== packageVersion)) {
    console.error(`iOS MARKETING_VERSION must match package.json (${packageVersion}); found ${marketingVersions.join(', ') || 'none'}.`);
    process.exit(1);
  }
  console.log(`app version: ${packageVersion}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function findDeveloperTool(name) {
  const result = spawnSync('xcrun', ['--find', name], { encoding: 'utf8' });
  if (result.status === 0) return result.stdout.trim();
  console.error([
    `Full Xcode is not active: xcrun could not find ${name}.`,
    'In Xcode, open Settings > Locations > Command Line Tools and select the installed Xcode.',
    'Alternatively set DEVELOPER_DIR for this shell or use sudo xcode-select --switch with your Xcode.app/Contents/Developer path.',
  ].join('\n'));
  process.exit(1);
}

function doctor() {
  checkVersion();
  const xcodebuild = findDeveloperTool('xcodebuild');
  const simctl = findDeveloperTool('simctl');
  console.log(`xcodebuild: ${xcodebuild}`);
  console.log(`simctl: ${simctl}`);
}

function buildSimulator() {
  doctor();
  run('xcrun', [
    'xcodebuild',
    '-project', XCODE_PROJECT,
    '-scheme', 'App',
    '-configuration', 'Debug',
    '-sdk', 'iphonesimulator',
    '-destination', 'generic/platform=iOS Simulator',
    '-derivedDataPath', join(tmpdir(), 'cuberoot-mobile-ios-derived-data'),
    'CODE_SIGNING_ALLOWED=NO',
    'build',
  ], { cwd: join(MOBILE_ROOT, 'ios', 'App') });
}

const command = process.argv[2] ?? 'doctor';
if (command === 'doctor') doctor();
else if (command === 'build') buildSimulator();
else {
  console.error(`Unknown iOS toolchain command: ${command}`);
  process.exit(2);
}
