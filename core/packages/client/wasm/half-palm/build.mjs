import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workspaceScratch = fileURLToPath(new URL('../../../../../.tmp/scratch/', import.meta.url));
mkdirSync(workspaceScratch, { recursive: true });
const build = mkdtempSync(join(workspaceScratch, 'half-palm-wasm-'));
try {
  const source = readFileSync(join(here, 'math.ts'), 'utf8')
    .replace('type Index = number;', 'type Index = i32;')
    .replace('type Scalar = number;', 'type Scalar = f64;')
    .replace('type Float = number;', 'type Float = f32;');
  const entry = join(build, 'assembly.ts');
  writeFileSync(entry, source + `
export function allocate(kind: i32, length: i32): usize {
  switch (kind) {
    case 1: return changetype<usize>(new Uint8Array(length));
    case 2: return changetype<usize>(new Uint16Array(length));
    case 3: return changetype<usize>(new Uint32Array(length));
    case 4: return changetype<usize>(new Float32Array(length));
    default: return changetype<usize>(new Float64Array(length));
  }
}

export function dataAddress(array: usize): usize {
  return changetype<Uint8Array>(array).dataStart;
}
`);
  const args = [entry, '-O3', '--runtime', 'stub', '--noAssert', '--uncheckedBehavior', 'always', '-o', join(here, 'math.wasm')];
  const compiler = process.argv[2];
  const result = compiler ? spawnSync(compiler, args, { stdio: 'inherit' })
    : spawnSync('npx', ['--yes', '--package', 'assemblyscript@0.28.9', 'asc', ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(build, { recursive: true, force: true });
}
