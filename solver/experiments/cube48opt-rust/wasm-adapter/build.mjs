#!/usr/bin/env node
// Reproducible local build only. It never installs a toolchain, loads a pruning
// table, starts a solver benchmark, or deploys an artifact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import createModule from './wrapper.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESEARCH = resolve(HERE, '..');
const ROOT = resolve(HERE, '../../../..');
const TOOLCHAIN = 'nightly-2026-10-12';
const TARGET = 'wasm64-unknown-unknown';
const RUSTFLAGS = '-C panic=abort -C target-feature=+simd128 -C link-arg=--max-memory=17179869184';
const TARGET_DIR = resolve(HERE, 'target');
const OUTPUT = resolve(TARGET_DIR, TARGET, 'release/cube48opt_rust_wasm.wasm');
const ARCHIVE = resolve(ROOT, '.tmp/cubeopt-reverse/rust-wasm64-builds');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = file => digest(readFileSync(file));
const relativeToRoot = file => relative(ROOT, file).replaceAll('\\', '/');

function command(program, args) {
  const result = spawnSync(program, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`${program} ${args.join(' ')} failed: ${result.error ?? result.stderr}`);
  }
  return result.stdout.trim();
}

function rustFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? rustFiles(file) : entry.isFile() && entry.name.endsWith('.rs') ? [file] : [];
  });
}

function sourceHashes() {
  const sources = [...rustFiles(resolve(RESEARCH, 'src')), ...rustFiles(resolve(HERE, 'src')),
    resolve(RESEARCH, 'Cargo.toml'), resolve(RESEARCH, 'Cargo.lock'),
    resolve(HERE, 'Cargo.toml'), resolve(HERE, 'Cargo.lock'),
    resolve(HERE, 'wrapper.mjs'), resolve(HERE, 'build.mjs')];
  return Object.fromEntries(sources.sort().map(file => [relativeToRoot(file), hashFile(file)]));
}

function keepCopy(source, target) {
  mkdirSync(dirname(target), { recursive: true });
  if (existsSync(target)) {
    assert.equal(hashFile(source), hashFile(target), `Refusing to replace ${target}`);
  } else copyFileSync(source, target, constants.COPYFILE_EXCL);
}

async function smallProbe(file) {
  const bytes = readFileSync(file), compiled = await WebAssembly.compile(bytes);
  assert.deepEqual(WebAssembly.Module.imports(compiled), [], 'Unexpected host imports');
  const module = await createModule({ wasmModule: compiled, variant: 9, instantiateOnly: true });
  const api = module.wasmInstance.exports;
  assert.equal(api.cubeopt_pointer_bytes(), 8);
  assert.equal(api.cubeopt_ready(), 0);
  for (let variant = 1; variant <= 9; variant++) {
    assert.equal(api.cubeopt_table_bytes(variant), 30_401_280n << BigInt(variant === 1 ? 0 : variant));
    assert.equal(api.cubeopt_snapshot_bytes(variant), BigInt(variant === 1 ? 816856 : variant <= 7 ? 816952 : 818008));
  }
  assert.equal(api.cubeopt_init_alloc(10, 818008n), -1);
  assert.equal(api.cubeopt_init_alloc(9, 0n), -1);
  assert.equal(api.cubeopt_pdb_len(), 0n);
  assert.equal(api.cubeopt_finalize(), -1);
  assert.equal(api.cubeopt_query(0n), -1);
  assert.equal(api.cubeopt_solve(4097n, 8, 20, 0n), -1);
  assert.throws(() => module.init(0, 4), /one solve thread/);
  assert.throws(() => module.init(1, 1), /generation is not supported/);
  assert.throws(() => module._get_mem_ptr(), /instantiateOnly/);
  assert(module.HEAPU8.length < 16 * 2 ** 20, 'ABI probe allocated excessive memory');
  return { node: process.versions.node, v8: process.versions.v8, imports: [],
    initialMemoryBytes: module.HEAPU8.length, allocatedPdbBytes: 0,
    checks: 'ABI and Opt1–9 sizes; invalid variant/snapshot; query/solve before initialization; rejection of table generation and multiple solve threads. No PDB allocation or real solve.' };
}

async function main() {
  assert.equal(process.argv.length, 2, 'This pinned build script accepts no overrides');
  const rustc = command('rustc', [`+${TOOLCHAIN}`, '--version', '--verbose']);
  const cargo = command('cargo', [`+${TOOLCHAIN}`, '--version']);
  const sysroot = command('rustc', [`+${TOOLCHAIN}`, '--print', 'sysroot']);
  const stdLock = resolve(sysroot, 'lib/rustlib/src/rust/library/Cargo.lock');
  assert(existsSync(stdLock), `Missing rust-src for ${TOOLCHAIN}; install that component before building`);
  const before = sourceHashes(), sourceDigest = digest(JSON.stringify(before));
  if (existsSync(OUTPUT)) {
    keepCopy(OUTPUT, resolve(ARCHIVE, 'previous-wasm', `${hashFile(OUTPUT)}.wasm`));
  }
  const args = [`+${TOOLCHAIN}`, 'build', '--locked', '-Zbuild-std=std,panic_abort',
    '--target', TARGET, '--release', '--lib', '--manifest-path', relativeToRoot(resolve(HERE, 'Cargo.toml')),
    '--target-dir', relativeToRoot(TARGET_DIR)];
  const build = spawnSync('cargo', args, { cwd: ROOT, stdio: 'inherit',
    env: { ...process.env, RUSTFLAGS } });
  if (build.error || build.status !== 0) throw new Error(`WASM build failed: ${build.error ?? build.status}`);
  assert.deepEqual(sourceHashes(), before, 'Sources changed during compilation; output was not certified');
  const wasmSha256 = hashFile(OUTPUT), wrapperSha256 = hashFile(resolve(HERE, 'wrapper.mjs'));
  const version = `${wasmSha256.slice(0, 16)}-${sourceDigest.slice(0, 16)}`;
  const directory = resolve(ARCHIVE, version);
  keepCopy(OUTPUT, resolve(directory, 'cube48opt_rust_wasm.wasm'));
  keepCopy(resolve(HERE, 'wrapper.mjs'), resolve(directory, 'wrapper.mjs'));
  for (const file of Object.keys(before)) keepCopy(resolve(ROOT, file), resolve(directory, 'source', file));
  const probe = await smallProbe(resolve(directory, 'cube48opt_rust_wasm.wasm'));
  const metadata = { schema: 'cuberoot.rust-opt-wasm64.build.v1', version,
    createdAt: new Date().toISOString(), toolchain: TOOLCHAIN, rustc, cargo, target: TARGET,
    rustflags: RUSTFLAGS, stdCargoLockSha256: hashFile(stdLock),
    command: { program: 'cargo', args, cwd: ROOT, env: { RUSTFLAGS } },
    artifact: resolve(directory, 'cube48opt_rust_wasm.wasm'), wasmSha256,
    wasmBytes: readFileSync(OUTPUT).length, wrapper: resolve(directory, 'wrapper.mjs'), wrapperSha256,
    sourceDigest, sourceHashes: before, smoke: probe,
    supportedVariants: [1, 2, 3, 4, 5, 6, 7, 8, 9], threads: 1,
    maxLinearMemoryBytes: 17179869184, deploymentValidated: false,
    limitations: ['No large table was loaded or solved by this build script.',
      'Building and instantiating do not establish performance, browser compatibility, or production readiness.',
      'Existing benchmark reports and prior artifacts are never overwritten.'] };
  const metadataFile = resolve(directory, 'build-metadata.json');
  if (existsSync(metadataFile)) {
    const previous = JSON.parse(readFileSync(metadataFile, 'utf8'));
    assert.equal(previous.wasmSha256, wasmSha256); assert.equal(previous.wrapperSha256, wrapperSha256);
    assert.equal(previous.sourceDigest, sourceDigest);
  } else writeFileSync(metadataFile, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
  const pointer = resolve(ARCHIVE, `latest-${process.pid}.json`);
  writeFileSync(pointer, JSON.stringify({ version, metadata: metadataFile,
    artifact: metadata.artifact, wasmSha256, wrapper: metadata.wrapper, wrapperSha256 }, null, 2) + '\n', { flag: 'wx' });
  renameSync(pointer, resolve(ARCHIVE, 'latest.json'));
  process.stdout.write(JSON.stringify({ version, artifact: metadata.artifact, metadata: metadataFile,
    wasmSha256, wasmBytes: metadata.wasmBytes, initialMemoryBytes: probe.initialMemoryBytes }, null, 2) + '\n');
}

main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exit(1); });
