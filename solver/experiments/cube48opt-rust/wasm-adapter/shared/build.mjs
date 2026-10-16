#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import createModule from './cube48opt-rust8.mjs';
import { verifySmall } from './verify-small.mjs';
import { verifyRootBound } from './verify-root-bound.mjs';
import { MAX_THREADS } from './cube48opt-rust8-worker.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESEARCH = resolve(HERE, '../..');
const ROOT = resolve(RESEARCH, '../../..');
const TOOLCHAIN = 'nightly-2026-10-12';
const TARGET = 'wasm64-unknown-unknown';
const RUSTFLAGS = '-C panic=abort -C target-feature=+simd128,+atomics,+bulk-memory -C link-arg=--shared-memory -C link-arg=--import-memory -C link-arg=--export=__stack_pointer -C link-arg=--export=__data_end -C link-arg=--export=__wasm_init_tls -C link-arg=--export=__tls_size -C link-arg=--export=__tls_align -C link-arg=--initial-memory=16777216 -C link-arg=--max-memory=17179869184 -C link-arg=-zstack-size=2097152';
const hash = x => createHash('sha256').update(x).digest('hex');
const fileHash = p => hash(readFileSync(p));
const rel = p => relative(ROOT, p).replaceAll('\\', '/');
function rustFiles(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? rustFiles(resolve(dir,e.name)) : e.name.endsWith('.rs') ? [resolve(dir,e.name)] : []); }
function sources() {
  return Object.fromEntries([...rustFiles(resolve(RESEARCH, 'src')), ...rustFiles(resolve(HERE,'src')),
    resolve(RESEARCH,'Cargo.toml'), resolve(RESEARCH,'Cargo.lock'), ...['Cargo.toml','Cargo.lock',
    'cube48opt-rust8.mjs','cube48opt-rust8-worker.mjs','verify-small.mjs','verify-root-bound.mjs','build.mjs'].map(p => resolve(HERE,p))]
    .sort().map(p => [rel(p),fileHash(p)]));
}
function mainCommand(feature, directory, targetDir) {
  const args = [`+${TOOLCHAIN}`, 'build', '--locked', '--offline', '-Zbuild-std=std,panic_abort',
    '--target',TARGET,'--release','--lib','--manifest-path',resolve(HERE,'Cargo.toml'),'--target-dir',targetDir,'-j','1'];
  if (feature) args.push('--features',feature);
  const env = { ...process.env, RUSTFLAGS }; delete env.CARGO_ENCODED_RUSTFLAGS;
  const result = spawnSync('cargo',args,{cwd:ROOT,env,encoding:'utf8',timeout:600000,maxBuffer:8*1024**2});
  writeFileSync(resolve(directory,`${feature || 'production'}.log`),`${result.stdout ?? ''}${result.stderr ?? ''}`,{flag:'wx'});
  assert(!result.error && result.status === 0, `Build failed: ${result.error ?? result.stderr}`);
  return {program:'cargo',args,cwd:ROOT,env:{RUSTFLAGS}};
}

async function main() {
  const candidate = process.argv[2] ?? null;
  const compileOnly = process.argv[3] === '--compile-only';
  assert(process.argv.length <= 4 && (process.argv[3] === undefined || compileOnly));
  assert(candidate === null || ["quarter-fixed","quarter-fixed-four","opt9-quarter-fixed","coset-batch","coset-batch-four","root-bound","root-bound-four","lazy-normal","lazy-normal-four","padded-state","opt9-batch","opt9-batch-padded","opt9-select"].includes(candidate));
  const features = candidate === 'quarter-fixed-four' ? 'quarter-fixed,production-four'
    : candidate === 'coset-batch-four' ? 'wasm-coset-batch,production-four'
    : candidate === 'coset-batch' ? 'wasm-coset-batch'
    : candidate === 'root-bound-four' ? 'wasm-root-bound,production-four'
    : candidate === 'root-bound' ? 'wasm-root-bound'
    : candidate === 'lazy-normal-four' ? 'wasm-lazy-normal,production-four'
    : candidate === 'lazy-normal' ? 'wasm-lazy-normal'
    : candidate === 'padded-state' ? 'wasm-padded-state'
    : candidate === 'opt9-batch-padded' ? 'wasm-opt9-batch-padded'
    : candidate === 'opt9-select' ? 'wasm-opt9-select'
    : candidate === 'opt9-batch' ? 'wasm-opt9-batch' : candidate;
  const archive = resolve(ROOT,'.tmp/cubeopt-reverse/rust-wasm-shared-builds'); mkdirSync(archive,{recursive:true});
  const directory = mkdtempSync(resolve(archive,compileOnly ? 'draft-' : 'build-'));
  const targetDir = resolve(directory, 'target');
  const output = resolve(targetDir, TARGET, 'release/cube48opt_rust_shared_wasm.wasm');
  const before = sources();
  if (compileOnly) {
    const buildCommand = mainCommand(features,directory,targetDir);
    assert.deepEqual(sources(),before,'Sources changed during compilation; do not reuse this draft');
    const artifact = resolve(directory,'cube48opt-rust8.wasm');
    copyFileSync(output,artifact,constants.COPYFILE_EXCL);
    for (const name of ['cube48opt-rust8.mjs','cube48opt-rust8-worker.mjs'])
      copyFileSync(resolve(HERE,name),resolve(directory,name),constants.COPYFILE_EXCL);
    for (const path of Object.keys(before)) {
      const target=resolve(directory,'source',path); mkdirSync(dirname(target),{recursive:true});
      copyFileSync(resolve(ROOT,path),target,constants.COPYFILE_EXCL);
    }
    // Intentionally no build-metadata.json: production guard/harness must not
    // mistake a compile-only artifact for a validated runnable candidate.
    const metadata = {schema:'cuberoot.rust-opt-shared-wasm64.draft.v1',createdAt:new Date().toISOString(),
      status:'compiled-unverified',candidate,toolchain:TOOLCHAIN,target:TARGET,rustflags:RUSTFLAGS,
      command:buildCommand,artifact,wasmSha256:fileHash(artifact),wasmBytes:readFileSync(artifact).length,
      wrapperSha256:fileHash(resolve(directory,'cube48opt-rust8.mjs')),
      workerSha256:fileHash(resolve(directory,'cube48opt-rust8-worker.mjs')),
      sourceHashes:before,sourceDigest:hash(JSON.stringify(before)),
      smallCheck:null,verified:false,benchmarkEligible:false,deploymentValidated:false,
      note:'Compiled only at the maintainer request. No WASM instantiation, fixtures, PDB load or benchmark. Validate and freeze a new build before any protected run.'};
    writeFileSync(resolve(directory,'draft-metadata.json'),JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({directory,candidate,status:metadata.status,wasmSha256:metadata.wasmSha256,wasmBytes:metadata.wasmBytes}));
    return;
  }
  const checkCommand = mainCommand(['small-check',features].filter(Boolean).join(','),directory,targetDir);
  const checker = resolve(directory,'small-check.wasm'); copyFileSync(output,checker,constants.COPYFILE_EXCL);
  const isolatedOpt9 = ['opt9-batch','padded-state','opt9-batch-padded','opt9-select'].includes(candidate);
  const small = await verifySmall(checker,ROOT,{additionalThreadCounts:isolatedOpt9 ? [16] : []});
  if (isolatedOpt9) {
    assert.equal(small.opt9BatchEnabled,candidate !== 'padded-state');
    assert.equal(small.paddedStateLayout,['padded-state','opt9-batch-padded'].includes(candidate) ? 0x401814 : 0);
    assert.equal(small.opt9SelectEnabled,candidate === 'opt9-select');
    assert.equal(small.cosetBatchEnabled,false);
    assert.equal(small.rootBoundEnabled,false);
    assert.equal(small.lazyNormalEnabled,false);
  }
  small.rootBoundDiagnostic = await verifyRootBound(checker,ROOT);
  const MAX_THREADS = small.maxThreads;
  writeFileSync(resolve(directory,'small-check.json'),JSON.stringify(small,null,2)+'\n',{flag:'wx'});
  const buildCommand = mainCommand(features,directory,targetDir);
  assert.deepEqual(sources(),before,'Sources changed during build; retry only after source edits finish');
  const artifact = resolve(directory,'cube48opt-rust8.wasm'); copyFileSync(output,artifact,constants.COPYFILE_EXCL);
  for (const name of ['cube48opt-rust8.mjs','cube48opt-rust8-worker.mjs']) copyFileSync(resolve(HERE,name),resolve(directory,name),constants.COPYFILE_EXCL);
  for (const path of Object.keys(before)) { const target=resolve(directory,'source',path);mkdirSync(dirname(target),{recursive:true});copyFileSync(resolve(ROOT,path),target,constants.COPYFILE_EXCL); }
  const compiled = await WebAssembly.compile(readFileSync(artifact));
  assert(!WebAssembly.Module.exports(compiled).some(e => e.name.startsWith('cubeopt_fixture_')));
  const probe = await createModule({wasmModule:compiled,variant:8,threads:4,instantiateOnly:true});
  assert.equal(probe.HEAPU8.length,16777216); assert(probe.wasmMemory.buffer instanceof SharedArrayBuffer);
  assert.equal(probe.wasmInstance.exports.cubeopt_supports_variant(10),0);
  assert.equal(probe.wasmInstance.exports.cubeopt_validate_table(8),-1,'No table validation without a complete memory range');
  const maxThreadProbe = await createModule({wasmModule:compiled,variant:9,threads:MAX_THREADS,instantiateOnly:true});
  assert.equal(maxThreadProbe.HEAPU8.length,16777216);
  assert.equal(maxThreadProbe.metadata.maxThreads,MAX_THREADS);
  const metadata = { schema:'cuberoot.rust-opt-shared-wasm64.build.v1',createdAt:new Date().toISOString(),
    toolchain:TOOLCHAIN,target:TARGET,rustflags:RUSTFLAGS,candidate,command:buildCommand,checkCommand,
    artifact,wasmSha256:fileHash(artifact),wasmBytes:readFileSync(artifact).length,
    wrapper:resolve(directory,'cube48opt-rust8.mjs'),wrapperSha256:fileHash(resolve(directory,'cube48opt-rust8.mjs')),
    worker:resolve(directory,'cube48opt-rust8-worker.mjs'),workerSha256:fileHash(resolve(directory,'cube48opt-rust8-worker.mjs')),
    sourceHashes:before,sourceDigest:hash(JSON.stringify(before)),abiVersion:2,maxThreads:MAX_THREADS,threads:4,
    verifiedThreadCounts:small.threadCounts,
    sharedTable:true,memory64:true,supportedVariants:[1,2,3,4,5,6,7,8,9],
    smallCheckSha256:fileHash(checker),smallCheck:small,productionProbe:{memoryBytes:16777216,pdbAllocatedBytes:0,workersStarted:0,
      dataEnd:Number(probe.wasmInstance.exports.__data_end.value),tlsSize:Number(probe.wasmInstance.exports.__tls_size.value),tlsAlign:Number(probe.wasmInstance.exports.__tls_align.value),
      maxThreadVariant:9,maxThreadReservationBytes:maxThreadProbe.metadata.reservedMemoryBytes},
    deploymentValidated:false,limitations:['Opt10 WASM is unsupported: this pinned linker caps memory at 16 GiB.',
      'No large table was loaded; this build does not establish performance or deployment acceptance.'] };
  writeFileSync(resolve(directory,'build-metadata.json'),JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({directory,wasmSha256:metadata.wasmSha256,wasmBytes:metadata.wasmBytes,verifiedSolutions:small.independentlyVerifiedSolutions}));
}
main().catch(error => { console.error(error);process.exitCode=1; });
