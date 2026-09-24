#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, statSync, statfsSync } from 'node:fs';
import { availableParallelism, freemem } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const solverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exe = join(solverRoot, 'target/release', `first_layer_gods_number${process.platform === 'win32' ? '.exe' : ''}`);
const checkpointBytes = 12_933_051_392;
const GiB = 1024 ** 3;

function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const value = process.argv[i + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}
function positiveInteger(value: string, name: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
  return n;
}
if (process.argv.includes('--help')) {
  console.log('Usage: tsx solver/scripts/run_first_layer_gods_number.mts [--threads N] [--checkpoint-every N] [--checkpoint-dir PATH] [--skip-build] [--dry-run-only]');
  process.exit(0);
}
const threads = positiveInteger(option('--threads', String(availableParallelism())), '--threads');
const checkpointEvery = positiveInteger(option('--checkpoint-every', '1'), '--checkpoint-every');
const dirOption = option('--checkpoint-dir', join(solverRoot, 'checkpoints/first-layer-god'));
const checkpointDir = isAbsolute(dirOption) ? dirOption : resolve(process.cwd(), dirOption);

async function run(command: string, args: string[], env?: NodeJS.ProcessEnv, log?: string): Promise<void> {
  await new Promise<void>((done, reject) => {
    const child = spawn(command, args, { cwd: solverRoot, env: env ?? process.env, stdio: log ? ['inherit', 'pipe', 'pipe'] : 'inherit' });
    let stream: ReturnType<typeof createWriteStream> | undefined;
    if (log) {
      stream = createWriteStream(log, { flags: 'w' });
      for (const output of [child.stdout, child.stderr]) output?.on('data', (chunk: Buffer) => {
        stream!.write(chunk);
        process.stdout.write(chunk);
      });
    }
    child.once('error', reject);
    child.once('close', (code) => {
      stream?.end();
      code === 0 ? done() : reject(new Error(`${command} exited with code ${code}${log ? `; inspect ${log}` : ''}`));
    });
  });
}

if (!process.argv.includes('--skip-build')) {
  console.log('[1/4] Building optimized proof binary...');
  await run('cargo', ['build', '--release', '--bin', 'first_layer_gods_number']);
} else if (!existsSync(exe)) throw new Error(`Binary not found: ${exe}`);

console.log('[2/4] Verifying the 25 GB memory plan...');
const args = ['--threads', String(threads), '--checkpoint-dir', checkpointDir, '--checkpoint-every', String(checkpointEvery)];
await run(exe, ['--dry-run', ...args]);
mkdirSync(checkpointDir, { recursive: true });
const freeMemory = freemem();
if (freeMemory < 8 * GiB) throw new Error(`可用内存只有 ${(freeMemory / GiB).toFixed(2)} GiB；至少释放到 8 GiB 后再运行。`);
let existing = 0;
for (const name of ['checkpoint-a.bin', 'checkpoint-b.bin']) {
  const slot = join(checkpointDir, name);
  if (existsSync(slot)) existing += statSync(slot).size;
}
const fs = statfsSync(checkpointDir);
const diskFree = Number(fs.bavail) * Number(fs.bsize);
const required = Math.max(2 * GiB, checkpointBytes - existing + 2 * GiB);
if (diskFree < required) throw new Error(`检查点磁盘空间不足：可用 ${(diskFree / GiB).toFixed(2)} GiB，至少还需 ${(required / GiB).toFixed(2)} GiB。`);
console.log(`[3/4] RAM available: ${(freeMemory / GiB).toFixed(2)} GiB; disk available: ${(diskFree / GiB).toFixed(2)} GiB`);
console.log(`Checkpoint directory: ${checkpointDir}`);
if (process.argv.includes('--dry-run-only')) {
  console.log('All resource gates passed; the full BFS was not started.');
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const log = join(checkpointDir, `first-layer-god-${stamp}.log`);
console.log(`Live log: ${log}`);
console.log('Existing valid checkpoint will be selected automatically.');
console.log('[4/4] Running. Re-run this same script after interruption to resume.');
await run(exe, args, { ...process.env, CUBE_ALLOW_HUGE_TABLES: '1', RAYON_NUM_THREADS: String(threads) }, log);
console.log(`Completed successfully. Final proof is in ${log}`);
