// Build only: this entry never loads or generates a pruning table.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.argv[2] || resolve(root, 'target/native-service-release'));
const target = 'x86_64-unknown-linux-musl';
const toolchain = '1.98.1';
const expectedSha256 = process.env.CUBEOPT_EXPECTED_BINARY_SHA256 || '';
if (expectedSha256 && !/^[a-f0-9]{64}$/.test(expectedSha256)) {
  throw new Error('CUBEOPT_EXPECTED_BINARY_SHA256 must be a lowercase SHA-256 digest');
}
const features = 'opt8-native-search,opt8-native-quarter,opt9-native-fixed-contexts,opt8-native-prefetch';
const args = [`+${toolchain}`, 'build', '--locked', '--release', '--target', target,
  '--target-dir', resolve(root, 'target/native-service'), '--features', features,
  '--bin', 'cube48opt-research'];

function run(command, argv, options = {}) {
  const result = spawnSync(command, argv, { cwd: root, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}: ${result.stderr || ''}`);
  return result.stdout?.trim() || '';
}

const revision = run('git', ['rev-parse', 'HEAD']);
const env = { ...process.env, RUSTFLAGS: '-C target-cpu=x86-64' };
delete env.CARGO_ENCODED_RUSTFLAGS;
run('cargo', args, { env, stdio: 'inherit' });
mkdirSync(output, { recursive: true });
const binaryPath = resolve(output, 'cube48opt-native');
copyFileSync(resolve(root, `target/native-service/${target}/release/cube48opt-research`), binaryPath);
chmodSync(binaryPath, 0o755);
const binary = readFileSync(binaryPath);
const binarySha256 = createHash('sha256').update(binary).digest('hex');
if (expectedSha256 && binarySha256 !== expectedSha256) {
  throw new Error(`native build differs from the performance-accepted binary: expected ${expectedSha256}, got ${binarySha256}`);
}
if (binary.subarray(0, 4).toString('hex') !== '7f454c46'
  || binary[4] !== 2 || binary[5] !== 1 || binary.readUInt16LE(18) !== 62) {
  throw new Error('native service binary must be an x86-64 little-endian ELF64 executable');
}
// On the Linux release runner, reject a dynamically linked executable and
// confirm the no-table protocol capability before publishing its digest.
if (process.platform === 'linux') {
  if (/\bINTERP\b/.test(run('readelf', ['-l', binaryPath]))) throw new Error('native service binary has a dynamic interpreter');
  run(binaryPath, ['--server-info']);
}
const metadata = {
  schema: 'cuberoot.cubeopt-native-build/v1', revision, target, toolchain, features,
  rustflags: env.RUSTFLAGS,
  buildCommand: 'node solver/experiments/cube48opt-rust/native-service/build.mjs',
  binary: { path: 'cube48opt-native', bytes: binary.length, sha256: binarySha256 },
};
writeFileSync(resolve(output, 'build.json'), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(JSON.stringify(metadata, null, 2));
