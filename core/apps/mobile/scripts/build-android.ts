import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadPushEnv, reportPushConfig } from './android-push-config.ts';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  'push-env-file': { type: 'string' }, 'unsigned-ci': { type: 'boolean' }, bundle: { type: 'boolean' },
} });
if (positionals.length !== 1) throw new Error('Expected one build target');
const channel = positionals[0];
if (channel !== 'direct' && channel !== 'play' && channel !== 'debug') throw new Error('Expected direct, play or debug');
const debug = channel === 'debug';
const unsignedCi = values['unsigned-ci'];
const bundle = values.bundle;
if (bundle && channel !== 'play') throw new Error('Only Play supports AAB bundles');
if (unsignedCi && process.env.GITHUB_ACTIONS !== 'true') throw new Error('Unsigned staging is restricted to CI');
if (debug && unsignedCi) throw new Error('Debug does not use unsigned release staging');
const pushEnv = loadPushEnv(values['push-env-file'], process.env);
if (!reportPushConfig(pushEnv, debug ? 'debug' : 'release')) process.exit(1);
const result = spawnSync(process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew', [
  debug ? 'assembleDebug' : bundle ? 'bundleRelease' : 'assembleRelease', `-PmobileDistribution=${debug ? 'play' : channel}`, '--no-daemon', '--max-workers=2',
], {
  cwd: fileURLToPath(new URL('../android', import.meta.url)),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...pushEnv, MOBILE_REQUIRE_RELEASE_SIGNING: unsignedCi || debug ? 'false' : 'true' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
