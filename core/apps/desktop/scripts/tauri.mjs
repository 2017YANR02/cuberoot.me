import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const targetIndex = args.findIndex(arg => arg === '--target' || arg === '-t');
const target = targetIndex >= 0 ? args[targetIndex + 1] : args.find(arg => arg.startsWith('--target='))?.slice(9);
const macDebug = process.platform === 'darwin' && (!target || target.endsWith('apple-darwin'))
  && args[0] === 'build' && args.includes('--debug');
const env = { ...process.env };
if (macDebug && !args.includes('--no-sign')) {
  env.APPLE_SIGNING_IDENTITY = 'Apple Development';
}
const cli = createRequire(import.meta.url).resolve('@tauri-apps/cli/tauri.js');
const result = spawnSync(process.execPath, [cli, ...args], { env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
