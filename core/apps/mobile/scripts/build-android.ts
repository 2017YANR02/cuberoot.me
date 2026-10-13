import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const channel = process.argv[2];
if (channel !== 'direct' && channel !== 'play') throw new Error('Expected direct or play distribution');
const result = spawnSync(process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew', [
  'assembleRelease', `-PmobileDistribution=${channel}`, '--no-daemon', '--max-workers=2',
], {
  cwd: fileURLToPath(new URL('../android', import.meta.url)),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, MOBILE_REQUIRE_RELEASE_SIGNING: 'true' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
