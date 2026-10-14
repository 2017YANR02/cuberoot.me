#!/usr/bin/env node
// Bounded native/actual-WASM BPMX verification. No PDB, generator or solve
// entry point is used. Build outputs and evidence get a fresh private directory.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, constants, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const TOOLCHAIN = 'nightly-2026-10-12';
const TARGET = 'wasm64-unknown-unknown';
// This smaller cap applies only to the checker artifact, never production.
const RUSTFLAGS = '-C panic=abort -C target-feature=+simd128 -C link-arg=--max-memory=8388608';
const EXPECTED = {
  rejectLoopDifferentialCases: 33792,
  allEqual: true, thresholdCases: 6, disabledCapabilityCases: 3, rootCases: 5,
  emptyMaskDepthCase: true, splitOwnership: true, prefixOwnership: true,
  rankWeightPreserved: true, realCubeCases: 9, bfsRadiusEachSide: 3,
  solvedBallStates: 3502, independentlyRejectedAncestors: 12,
  independentlyRejectedSiblings: 9, pdbAllocatedBytes: 0, fullSearchesRun: 0,
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = path => hash(readFileSync(path));
const repoPath = path => relative(ROOT, path).replaceAll('\\', '/');
let output;
const commands = [];

function save(name, value) {
  writeFileSync(resolve(output, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}

function rustFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? rustFiles(path) : entry.isFile() && entry.name.endsWith('.rs') ? [path] : [];
  });
}

function sourceHashes() {
  const files = [...rustFiles(resolve(HERE, 'src')), ...rustFiles(resolve(HERE, 'wasm-adapter/src')),
    ...['Cargo.toml', 'Cargo.lock', 'wasm-adapter/Cargo.toml', 'wasm-adapter/Cargo.lock',
      'examples/bpmx-check.rs', 'verify-bpmx.mjs'].map(path => resolve(HERE, path))];
  return Object.fromEntries(files.sort().map(path => [repoPath(path), hashFile(path)]));
}

function command(name, program, args, rustflags = '') {
  const env = { ...process.env, RUSTFLAGS: rustflags, CARGO_INCREMENTAL: '0' };
  // Cargo prefers the encoded variable over RUSTFLAGS; keep the pinned flags
  // effective even when this script is invoked from a customized shell.
  delete env.CARGO_ENCODED_RUSTFLAGS;
  const invocation = { name, program, args, cwd: ROOT, rustflags };
  commands.push(invocation);
  const result = spawnSync(program, args, { cwd: ROOT, env, encoding: 'utf8',
    timeout: name.endsWith('-build') ? 600_000 : 60_000, maxBuffer: 8 * 2 ** 20 });
  save(`${name}.stdout.log`, result.stdout ?? '');
  save(`${name}.stderr.log`, result.stderr ?? '');
  assert(!result.error && result.status === 0,
    `${name} failed (${result.error ?? result.signal ?? result.status}); logs: ${output}`);
  return result.stdout.trim();
}

async function main() {
  assert.equal(process.argv.length, 2, 'This pinned checker accepts no overrides');
  assert(existsSync(resolve(ROOT, 'AGENTS.md')), 'Run from the canonical repository source tree');
  assert.equal(HERE, resolve(ROOT, 'solver/experiments/cube48opt-rust'), 'Noncanonical checker source');
  const parent = resolve(ROOT, '.tmp/cubeopt-reverse');
  mkdirSync(parent, { recursive: true });
  output = mkdtempSync(resolve(parent, 'bpmx-small-check-'));
  const before = sourceHashes();
  save('source-hashes.json', before);
  const rustc = command('rustc-version', 'rustc', [`+${TOOLCHAIN}`, '--version', '--verbose']);
  const cargo = command('cargo-version', 'cargo', [`+${TOOLCHAIN}`, '--version']);
  const sysroot = command('rustc-sysroot', 'rustc', [`+${TOOLCHAIN}`, '--print', 'sysroot']);
  const stdLock = resolve(sysroot, 'lib/rustlib/src/rust/library/Cargo.lock');
  assert(existsSync(stdLock), `Missing rust-src for ${TOOLCHAIN}; no toolchain will be installed automatically`);
  const nativeTarget = resolve(output, 'native-target');
  command('native-build', 'cargo', [`+${TOOLCHAIN}`, 'build', '--locked', '--offline',
    '--no-default-features', '--features', 'bpmx-check', '--example', 'bpmx-check', '--jobs', '1',
    '--manifest-path', resolve(HERE, 'Cargo.toml'), '--target-dir', nativeTarget]);
  const nativeBinary = resolve(nativeTarget, `debug/examples/bpmx-check${process.platform === 'win32' ? '.exe' : ''}`);
  const native = JSON.parse(command('native-check', nativeBinary, []));
  assert.deepEqual(native, EXPECTED, 'Native BPMX boundary or independent-distance result changed');
  save('native-bpmx.json', native);

  const wasmTarget = resolve(output, 'wasm-target');
  command('wasm-build', 'cargo', [`+${TOOLCHAIN}`, 'build', '--locked', '--offline',
    '-Zbuild-std=std,panic_abort', '--target', TARGET, '--release', '--lib',
    '--features', 'bpmx-check', '--jobs', '1', '--manifest-path', resolve(HERE, 'wasm-adapter/Cargo.toml'),
    '--target-dir', wasmTarget], RUSTFLAGS);
  assert.deepEqual(sourceHashes(), before, 'Sources changed during compilation');
  const wasmFile = resolve(wasmTarget, TARGET, 'release/cube48opt_rust_wasm.wasm');
  const bytes = readFileSync(wasmFile);
  assert(bytes.length < 2 ** 20, 'Checker artifact exceeded the bounded size');
  copyFileSync(wasmFile, resolve(output, 'bpmx-check.wasm'), constants.COPYFILE_EXCL);
  const compiled = await WebAssembly.compile(bytes);
  assert.deepEqual(WebAssembly.Module.imports(compiled), [], 'Unexpected host imports');
  const api = (await WebAssembly.instantiate(compiled)).exports;
  assert.equal(api.cubeopt_pointer_bytes(), 8);
  assert.equal(api.cubeopt_pdb_len(), 0n);
  assert.equal(api.cubeopt_ready(), 0);
  assert(api.memory.buffer.byteLength < 8 * 2 ** 20, 'Initial checker memory exceeded scope');
  const code = api.cubeopt_check_bpmx();
  const pointer = Number(api.cubeopt_check_bpmx_ptr());
  const length = Number(api.cubeopt_check_bpmx_len());
  assert(Number.isSafeInteger(pointer) && pointer >= 0);
  assert(Number.isSafeInteger(length) && length > 0 && length < 16_384);
  assert(pointer + length <= api.memory.buffer.byteLength);
  const text = Buffer.from(api.memory.buffer, pointer, length).toString();
  save('wasm-output.txt', text + '\n');
  assert.equal(code, 0, text);
  const result = JSON.parse(text);
  assert.deepEqual(result, native, 'Native and WASM BPMX checks differ');
  assert.equal(api.cubeopt_pdb_len(), 0n);
  assert.equal(api.cubeopt_ready(), 0);
  assert(api.memory.buffer.byteLength < 8 * 2 ** 20, 'Small check exceeded scope');
  assert.deepEqual(sourceHashes(), before, 'Sources changed during verification');
  const report = { schema: 'cuberoot.rust-opt-wasm-bpmx.small-diff.v1', createdAt: new Date().toISOString(),
    toolchain: TOOLCHAIN, rustc, cargo, target: TARGET, rustflags: RUSTFLAGS,
    stdCargoLockSha256: hashFile(stdLock), nativeBinarySha256: hashFile(nativeBinary),
    wasmSha256: hash(bytes), wasmBytes: bytes.length, node: process.versions.node, v8: process.versions.v8,
    linearMemoryBytes: api.memory.buffer.byteLength, result, sources: before, commands,
    limits: ['No PDB was read or allocated; no generator or full solve was run.',
      'The checker artifact has an 8 MiB memory cap; it is not a production artifact.',
      'BFS ground truth is not substituted for the half-turn-invariant pruning oracle.',
      'Only private Opt9Oracle on WASM SIMD opts into parent propagation.',
      'Small control checks do not establish full-search correctness or performance.'] };
  save('report.json', report);
  console.log(JSON.stringify({ report: resolve(output, 'report.json'), ...result,
    linearMemoryBytes: report.linearMemoryBytes }, null, 2));
}

main().catch(error => {
  if (output) save('failure.json', { error: String(error.stack ?? error), commands });
  process.stderr.write(`${error.stack ?? error}\n${output ? `Evidence: ${output}\n` : ''}`);
  process.exitCode = 1;
});
