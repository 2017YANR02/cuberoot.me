import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const apiDir = resolve(repoRoot, 'core/apps/api');
const env = {
  ...process.env,
  DB_HOST: '127.0.0.1',
  DB_PORT: '5433',
  DB_USER: 'postgres',
  DB_PASS: 'dev',
  DB_NAME: 'cuberoot_db',
  PORT: '3001',
  JWT_SECRET: 'dev-secret-local-only',
};

console.log('Hono API -> pg13 (127.0.0.1:5433/cuberoot_db) on http://127.0.0.1:3001');
console.log('Set LOCAL_DOMAINS=alg,wiki when starting the client to route only those /v1 domains here.');
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(command, ['exec', 'tsx', 'watch', 'src/index.ts'], {
  cwd: apiDir,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('error', error => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal));
}
