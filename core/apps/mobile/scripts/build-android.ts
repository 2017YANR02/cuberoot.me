import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const channel = process.argv[2];
if (channel !== 'direct' && channel !== 'play') throw new Error('Expected direct or play distribution');
const unsignedCi = process.argv.includes('--unsigned-ci');
const bundle = process.argv.includes('--bundle');
if (bundle && channel !== 'play') throw new Error('Only Play supports AAB bundles');
if (unsignedCi && process.env.GITHUB_ACTIONS !== 'true') throw new Error('Unsigned staging is restricted to CI');
const result = spawnSync(process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew', [
  ...(bundle ? ['bundleRelease'] : ['assembleRelease']), `-PmobileDistribution=${channel}`, '--no-daemon', '--max-workers=2',
], {
  cwd: fileURLToPath(new URL('../android', import.meta.url)),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, MOBILE_REQUIRE_RELEASE_SIGNING: unsignedCi ? 'false' : 'true' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
