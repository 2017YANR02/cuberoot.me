/** Mac-only, existing-table WCA100 reviews. No solver, generation or baseline reset. */
import assert from 'node:assert/strict';
import { constants, openSync, closeSync, fstatSync, readSync, readFileSync, lstatSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cpus, hostname, release } from 'node:os';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVariant } from './variants.mjs';
import { parseWasmBenchmarkArguments, readWca100, sharedBuildSources, wasmBuildContract } from './wasm-benchmark.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const OUTPUT = resolve(ROOT, '.tmp/cubeopt-reverse');
const GiB = 2 ** 30, MiB = 2 ** 20;
export const multithreadScope = 'mac18-wca100-single';
export const multithreadBaselineSha256 = '47fe14e7b69dbd34dba8dfdf8695809027bb5cc3de5793854495e0f90cbd2ad4';
export const multithreadStoppedSha256 = 'ebba140a416524e37e336b9187d6474131c8980e140bdd47b2a3df04255775f1';
export const multithreadPriorHashes = {
  resources: '3bbb68ff6fed27eaf8ac1fa6a06b2bc0cb98f0fc4ce288dc4cf3035e99bc433d',
  exit: 'fc083f051660eafafcbedce326be5959d33618131fa10207d40b61753acb5de4',
  report: 'bc78ea714ce6208a953679a11c70e03325ffc1a02c4274c16a1c4d610e182ff7',
};
export const multithreadPaths = {
  native: resolve(HERE, 'target/multithread/release/cube48opt-research'),
  input: resolve(OUTPUT, 'wca100-single.tsv'),
  baseline: resolve(OUTPUT, 'resource-baseline.json'),
  stopped: resolve(OUTPUT, 'opt10-generate-v1-resources.json'),
  priorResources: resolve(OUTPUT, 'wca100-rust-opt10-single-resources.json'),
  priorExit: resolve(OUTPUT, 'wca100-rust-opt10-single-exit.json'),
  priorReport: resolve(OUTPUT, 'wca100-rust-opt10-single-report.json'),
  stop: resolve(OUTPUT, 'multithread-resource-review-stop.json'),
  receipts: resolve(OUTPUT, 'multithread-review-receipts'),
};
export const multithreadSources = [
  'Cargo.toml', 'Cargo.lock', 'src/main.rs', 'src/lib.rs', 'src/native_parallel.rs', 'src/batch.rs',
  'src/search.rs', 'src/cube.rs', 'src/coord.rs', 'src/table.rs', 'src/opt10.rs',
  'src/opt10_table.rs', 'src/eo_table.rs', 'src/opt11.rs', 'src/opt11_generate.rs', 'src/opt10_generate.rs', 'src/h10_coord.rs', 'src/h10_table.rs',
  'src/opt11_search.rs', 'src/opt11_lookup.rs', 'src/opt11_generate_candidate.rs',
  'src/h48_coord.rs', 'src/h48_table.rs', 'src/h48_variant.rs',
  'guard.mts', 'multithread-policy.mts', 'wasm-benchmark.mjs', 'variants.mjs',
  'wasm-adapter/shared/Cargo.toml', 'wasm-adapter/shared/Cargo.lock',
  'wasm-adapter/shared/src/lib.rs', 'wasm-adapter/shared/build.mjs',
  'wasm-adapter/shared/cube48opt-rust8.mjs', 'wasm-adapter/shared/cube48opt-rust8-worker.mjs',
];
const machine = () => ({ platform: process.platform, arch: process.arch, cpuModel: cpus()[0].model,
  logicalCpus: cpus().length, hostname: hostname(), osRelease: release() });
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export type MultithreadRequest = { label: string; executable: string; args: string[]; env: NodeJS.ProcessEnv };
type Observation = { boot: string; swapouts: number; pressure: number; available: number };

export const opt9ExperimentScope = 'mac16-wca1000-opt9-native-experiment';
export const opt9ExperimentCandidates = ['bpmx', 'dynamic', 'prefetch', 'quarter', 'cached', 'fixed', 'niss', 'ternary', 'axis', 'ranked'] as const;
// Future candidates must be explicitly authorized with exact feature sets.
const opt9FixedReferenceCandidates: readonly string[] = ['niss','ternary','axis','ranked'];
export type Opt9ExperimentCandidate = typeof opt9ExperimentCandidates[number];
export const opt10ExperimentScope = 'mac16-wca1000-opt10-native-experiment';
export const opt10ExperimentPaths = {
  archive: resolve(OUTPUT, 'opt10-native-baseline-20261014'),
  hotpathArchive: resolve(OUTPUT, 'opt10-native-hotpath-preserved-20261014'),
  cosetArchive: resolve(OUTPUT, 'opt10-native-coset-preserved-20261014'),
  stop: resolve(OUTPUT, 'opt10-native-experiment-stop.json'),
};
export const opt10HotpathReferenceHashes = {
  manifest:'4e73ebf9862085ef03f2fddd7b95826415d6e5ace55ded7fdb688366628f6b11',
  report:'329eae8166e5e301d4eaf84931b2867267d7d48e16dba23434c2dce58e6a43f8',
};
export const opt10CosetReferenceHashes = {
  manifest:'c0fb78c5e8565ed34304448ce1346008a6ee46b144b4f5332f9f3d9db448a529',
  report:'045b03b1d0fec4d36da9c780ba68fa3d941a4f2e671e5a2661ebac7eed8e70a2',
};
export function opt10ExperimentConfig(candidate: string) {
  assert(['baseline','search','hotpath','batch','dual','prefix','coset','coset-chain','coset-gated','profile','lookahead','projection'].includes(candidate), 'Only the explicitly authorized native Opt10 candidates are allowed');
  const target=resolve(HERE,`target/opt10-${candidate}`);
  return {candidate,target,executable:resolve(target,'release/cube48opt-research'),
    buildPath:resolve(target,'opt10-experiment-build.json'),label:`wca1000-mt16-rust-native-opt10-exp-${candidate}`,
    requiresHotpathReference:['batch','dual','prefix','coset','coset-chain','coset-gated','profile','lookahead','projection'].includes(candidate),
    requiresCosetReference:['coset-chain','coset-gated','profile','lookahead','projection'].includes(candidate),
    features:['default','h10-fast-coord','h10-prefetch','neon-moves','opt10-runtime',
      ...(candidate!=='baseline'?['opt10-native-search','opt9-native-bpmx','opt9-native-dynamic','opt9-native-quarter','opt9-native-root-bound','opt9-native-fixed-contexts']:[]),
      ...(['hotpath','batch','dual','prefix','coset','coset-chain','coset-gated','profile','lookahead','projection'].includes(candidate)?['opt10-native-hotpath']:[]),
      ...(candidate==='batch'?['opt10-native-batch']:[]),
      ...(candidate==='dual'?['opt10-native-dual']:[]),
      ...(candidate==='prefix'?['opt10-native-prefix']:[]),
      ...(['coset','coset-chain','coset-gated','profile','lookahead','projection'].includes(candidate)?['opt10-native-coset']:[]),
      ...(['coset-chain','coset-gated'].includes(candidate)?['opt10-native-coset-chain']:[]),
      ...(candidate==='coset-gated'?['opt10-native-coset-gated']:[]),
      ...(candidate==='profile'?['opt10-native-profile']:[]),
      ...(candidate==='lookahead'?['opt10-native-lookahead']:[]),
      ...(candidate==='projection'?['opt10-native-projection']:[])].sort()};
}
export const opt9ExperimentPaths = {
  baseline: resolve(OUTPUT, 'opt9-native-baseline-20261014'),
  dynamicReference: resolve(OUTPUT, 'opt9-native-55s-preserved-20261014'),
  fixedReference: resolve(OUTPUT, 'opt9-native-fixed-preserved-20261014'),
  stop: resolve(OUTPUT, 'opt9-native-experiment-stop.json'),
  failedResources: resolve(OUTPUT, 'wca1000-mt16-rust-wasm-opt9-resources.json'),
  failedStderr: resolve(OUTPUT, 'wca1000-mt16-rust-wasm-opt9/rust/stderr.log'),
};
export const opt9ExperimentHashes = {
  stop: '0a9965c595f9c1b889a31cf179fdb6a1347d0cd2b13c97a50774a312cc787e2c',
  failedResources: '19d31063113bb51227ee4f9321c59cf90795e98bb5da66a4b144814e86c7e060',
  failedStderr: '547821538366a3287f3d3c513aacaf1567edfc5611652a918c9150f2783f0bdf',
  baselineManifest: '0e0e3554a1b58f64815b55e394d89bdb0e8592c13cf9e11d22156cea6fd4c76b',
  baselineResources: '5629a7d42fe58f9f3b2f5a7095a10c8de58825680d4c8113e7669f48c100620d',
  baselineExit: '4c2a8ef4b459e1cb050a5b51e1fb536e5b39031067000884d7f38e680a9fbf5a',
  dynamicManifest: 'a8f9210d646afdfecd1474ae850e3d79386f0ade4250e4e0538645099817577c',
  fixedManifest: 'f2f633ebc79f5948b86991f259c85e53cedc6b2776167573d574bafc8eda1244',
};
export function opt9ExperimentConfig(candidate: string) {
  assert(opt9ExperimentCandidates.includes(candidate as Opt9ExperimentCandidate), 'Candidate is not in the native Opt9 experiment allowlist');
  const target = resolve(HERE, `target/opt9-${candidate}`);
  return { candidate, target, executable: resolve(target, 'release/cube48opt-research'),
    buildPath: resolve(target, 'opt9-experiment-build.json'),
    label: `wca1000-mt16-rust-native-opt9-exp-${candidate}`,
    requiresDynamicReference: ['prefetch','quarter','cached','fixed','niss','ternary','axis','ranked'].includes(candidate),
    requiresFixedReference: opt9FixedReferenceCandidates.includes(candidate),
    features: ['default','h10-fast-coord','h10-prefetch','neon-moves','opt9-native-bpmx',
      ...(candidate !== 'bpmx' ? ['opt9-native-dynamic'] : []),
      ...(['prefetch','quarter','cached','fixed','niss','ternary','axis','ranked'].includes(candidate) ? ['opt9-native-prefetch'] : []),
      ...(['quarter','cached','fixed','niss','ternary','axis','ranked'].includes(candidate) ? ['opt9-native-quarter'] : []),
      ...(candidate === 'cached' ? ['opt9-native-quarter-cache'] : []),
      ...(['cached','fixed','niss','ternary','axis','ranked'].includes(candidate) ? ['opt9-native-root-bound'] : []),
      ...(['fixed','niss','ternary','axis','ranked'].includes(candidate) ? ['opt9-native-fixed-contexts'] : []),
      ...(candidate === 'niss' ? ['opt9-native-niss'] : []),
      ...(candidate === 'ternary' ? ['opt9-native-ternary'] : []),
      ...(candidate === 'axis' ? ['opt9-native-axis'] : []),
      ...(candidate === 'ranked' ? ['opt9-native-ranked'] : [])].sort() };
}

/** Command-only allowlist. No filesystem access and no inferred permissions. */
export function multithreadPolicy(request: MultithreadRequest, availableCpus: number) {
  const { label, executable, args, env } = request;
  const experiment = /^wca1000-mt16-rust-native-opt9-exp-(bpmx|dynamic|prefetch|quarter|cached|fixed|niss|ternary|axis|ranked)$/.exec(label)?.[1] ?? null;
  const opt10Experiment = /^wca1000-mt16-rust-native-opt10-exp-(baseline|search|hotpath|batch|dual|prefix|coset|coset-chain|coset-gated|profile|lookahead|projection)$/.exec(label)?.[1] ?? null;
  const expanded = !!experiment || !!opt10Experiment || /^wca1000-mt16-(original-wasm|rust-native|rust-wasm)-opt9$/.test(label);
  const threads = expanded ? 16 : 18, count = expanded ? 1000 : 100;
  const scope = opt10Experiment ? opt10ExperimentScope : experiment ? opt9ExperimentScope : expanded ? 'mac16-wca1000-single' : multithreadScope;
  assert(/^[a-z0-9][a-z0-9-]*$/.test(label) && (expanded || label.startsWith('wca100-mt18-')), 'Expected a unique wca100-mt18- label');
  assert(availableCpus >= threads, 'Enough actual CPUs are required');
  assert(env.CUBEOPT_MULTITHREAD_REVIEW && isAbsolute(env.CUBEOPT_MULTITHREAD_REVIEW), 'Explicit absolute multithread review is required');
  for (const key of ['CUBEOPT_OPT10_REVIEW', 'CUBEOPT_RESOURCE_REVIEW', 'CUBEOPT_ZBLL_REVIEW', 'CUBEOPT_BENCHMARK'])
    assert(env[key] === undefined, `Conflicting ${key}`);
  assert(env.CUBEOPT_SOLVE_THREADS === '1', 'The fixed protocol has one batch worker');
  let backend: string, variant: number | null = null, h: number | null = null;
  let tablePath: string, snapshotPath: string | null = null, tableBytes: number;
  let entry: string, mode: string, wasmConfig: ReturnType<typeof parseWasmBenchmarkArguments> | null = null;
  if (executable === (opt10Experiment ? opt10ExperimentConfig(opt10Experiment).executable : experiment ? opt9ExperimentConfig(experiment).executable : multithreadPaths.native)) {
    assert(env.CUBEOPT_SEARCH_THREADS === String(threads) && env.CUBEOPT_MEASURE_RSS === '1', 'Native needs 18 search threads and kernel RSS');
    entry = 'native'; mode = args[0]; backend = env.CUBEOPT_BACKEND!;
    if (backend === 'opt') {
      assert(/^[1-9]$/.test(env.CUBEOPT_VARIANT ?? '') && env.CUBEOPT_H === undefined, 'Expected Opt1..9');
      variant = Number(env.CUBEOPT_VARIANT); const v = getVariant(variant);
      tablePath = resolve(OUTPUT, `opt${variant}-generated`, v.tableName);
      snapshotPath = resolve(OUTPUT, `opt${variant}-generated/small-memory.bin`); tableBytes = v.tableBytes;
      assert.deepEqual(args, ['solve', snapshotPath, tablePath, '8', '20', '0']);
    } else if (backend === 'opt10') {
      assert(env.CUBEOPT_VARIANT === undefined && env.CUBEOPT_H === undefined, 'Opt10 has its own backend');
      tablePath = resolve(OUTPUT, 'opt10-generated-v2/cuberoot-opt10.dat'); tableBytes = 31_130_911_744;
      snapshotPath = resolve(OUTPUT, 'opt9-generated/small-memory.bin');
      assert.deepEqual(args, ['solve-opt10', snapshotPath, tablePath, '8', '20', '0']);
    } else {
      assert(backend === 'h48' && ['7', '10'].includes(env.CUBEOPT_H ?? '') && env.CUBEOPT_VARIANT === undefined, 'Only existing H7/H10 are allowed');
      h = Number(env.CUBEOPT_H); tablePath = resolve(ROOT, `solver/tables/h48-nissy-core/h48h${h}.dat`);
      tableBytes = h === 7 ? 3_793_842_344 : 30_336_314_216;
      assert.deepEqual(args, ['solve-h48', String(h), tablePath, '8', '20', '0']);
    }
  } else {
    assert(!experiment && !opt10Experiment, 'Experimental labels require their exact dedicated native binary');
    assert(executable === process.execPath && args[0] === resolve(HERE, 'wasm-benchmark.mjs'), 'Only the dedicated native binary or WASM harness is allowed');
    assert(env.CUBEOPT_SEARCH_THREADS === undefined && env.CUBEOPT_MEASURE_RSS === undefined, 'WASM threads are explicit harness arguments');
    wasmConfig = parseWasmBenchmarkArguments(args.slice(1));
    assert(wasmConfig.threads === threads);
    if (expanded) {
      assert.equal(wasmConfig.count, 1000);
      assert.equal(wasmConfig.engine, label.startsWith('wca1000-mt16-original-') ? 'original' : 'rust');
    } else assert(wasmConfig.engine === 'both' && !wasmConfig.count);
    variant = wasmConfig.variant; const v = getVariant(variant);
    backend = 'opt'; entry = 'wasm-benchmark.mjs'; mode = 'single-pass';
    assert(env.CUBEOPT_BACKEND === backend && env.CUBEOPT_VARIANT === String(variant) && env.CUBEOPT_H === undefined, 'WASM variant/environment mismatch');
    tablePath = resolve(OUTPUT, `opt${variant}-generated`, v.tableName);
    snapshotPath = resolve(OUTPUT, `opt${variant}-generated/small-memory.bin`); tableBytes = v.tableBytes;
    assert(wasmConfig.table === tablePath && wasmConfig.small === snapshotPath, 'Only existing canonical Opt tables are allowed');
    assert(args.every((value, index) => index === 0 || !['--table', '--small', '--wasm', '--out'].includes(args[index - 1]) || isAbsolute(value)), 'File arguments must be absolute');
    assert(wasmConfig.out.startsWith(OUTPUT + '/') && !wasmConfig.out.includes('/../'), 'Output must be a fresh local research directory');
  }
  // PDB is shared. Budget all 18 WASM 66.0625 MiB arenas plus JS/V8 workers,
  // and the preserved original's table/16 frontier; only one engine is resident.
  if (expanded) {
    assert(opt10Experiment ? backend === 'opt10' && variant === null && h === null : backend === 'opt' && variant === 9 && h === null);
    assert.equal(entry === 'native', label.includes('rust-native'));
  }
  const rssLimit = tableBytes + GiB + (wasmConfig ? Math.ceil(tableBytes / 16) + 19_208_560 + threads * 128 * MiB : threads * 16 * MiB);
  return { multithread: true as const, experiment, opt10Experiment, threads, count, scope, entry, mode, backend, variant, h, tablePath, snapshotPath, tableBytes,
    measureNativeRss: entry === 'native', rssLimit, deadlineMs: 6 * 60 * 60_000,
    searchThreads: entry === 'native' ? threads : 1, ...(wasmConfig ? { wasmThreads: threads } : {}), wasmConfig };
}

function bounded(path: string, max = 4 * MiB) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const info = fstatSync(fd); assert(info.isFile() && info.size <= max, `Expected bounded regular file: ${path}`); return readFileSync(fd); }
  finally { closeSync(fd); }
}
function binaryHash(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW), digest = createHash('sha256');
  try { const info = fstatSync(fd); assert(info.isFile() && info.size < 256 * MiB, 'Unexpected executable size');
    const chunk = Buffer.alloc(MiB); let size; while ((size = readSync(fd, chunk, 0, chunk.length, null))) digest.update(chunk.subarray(0, size));
    return digest.digest('hex');
  } finally { closeSync(fd); }
}
const record = (path: string) => { const bytes = bounded(path); return { path, sha256: hash(bytes), value: JSON.parse(bytes.toString()) }; };

export const opt9ExperimentBuildSources = ['Cargo.toml','Cargo.lock', ...multithreadSources.filter(name => name.startsWith('src/'))];
function nativeBuildObservation(config: ReturnType<typeof opt9ExperimentConfig> | ReturnType<typeof opt10ExperimentConfig>) {
  const candidate=config.candidate, fingerprints: any[] = [];
  const directory = resolve(config.target, 'release/.fingerprint');
  for (const name of readdirSync(directory).filter(name => name.startsWith('cube48opt-research-'))) {
    for (const role of ['bin-cube48opt-research.json','lib-cube48opt_research.json']) {
      const path = resolve(directory, name, role);
      if (!existsSync(path)) continue;
      const r = record(path), features = JSON.parse(r.value.features).sort();
      if (JSON.stringify(features) === JSON.stringify(config.features)) {
        assert.deepEqual(r.value.rustflags,['-C','target-cpu=native'],'Keep the preserved baseline native CPU compilation flags');
        assert.equal(r.value.compile_kind,0,'Expected a host-native build');
        fingerprints.push({path,sha256:r.sha256,role,features,rustflags:r.value.rustflags,rustc:r.value.rustc,profile:r.value.profile});
      }
    }
  }
  assert.deepEqual(fingerprints.map(v => v.role).sort(), ['bin-cube48opt-research.json','lib-cube48opt_research.json'], 'Exactly one matching native bin/lib feature fingerprint is required');
  const binary = {path:config.executable,sha256:binaryHash(config.executable)};
  const sourceSha256 = Object.fromEntries(opt9ExperimentBuildSources.map(name => [name,hash(bounded(resolve(HERE,name)))]));
  const binaryTime = lstatSync(config.executable).mtimeMs;
  assert(opt9ExperimentBuildSources.every(name => lstatSync(resolve(HERE,name)).mtimeMs <= binaryTime), 'Build is older than source; compile the dedicated candidate first');
  return {candidate,features:config.features,binary,sourceSha256,fingerprints};
}
const experimentBuildObservation=(candidate:string)=>nativeBuildObservation(opt9ExperimentConfig(candidate));
export function recordOpt10ExperimentBuild(candidate: string) {
  const config=opt10ExperimentConfig(candidate),value=nativeBuildObservation(config);
  writeFileSync(config.buildPath,JSON.stringify({schema:'cuberoot.opt10-native-experiment-build.v1',recordedAt:new Date().toISOString(),...value},null,2)+'\n',{flag:'wx'});
  return {path:config.buildPath,...value};
}

/** Bounded artifact recording after a successful dedicated cargo build. Never executes it. */
export function recordOpt9ExperimentBuild(candidate: string) {
  const config = opt9ExperimentConfig(candidate), value = experimentBuildObservation(candidate);
  writeFileSync(config.buildPath, JSON.stringify({schema:'cuberoot.opt9-native-experiment-build.v1',recordedAt:new Date().toISOString(),...value},null,2)+'\n', {flag:'wx'});
  return {path:config.buildPath,...value};
}

function collectOpt9PreservedReference(candidate: 'dynamic' | 'fixed') {
  const fixed=candidate==='fixed', directory=fixed?opt9ExperimentPaths.fixedReference:opt9ExperimentPaths.dynamicReference;
  const manifest=record(resolve(directory,'manifest.json'));
  assert.equal(manifest.sha256,fixed?opt9ExperimentHashes.fixedManifest:opt9ExperimentHashes.dynamicManifest,`Preserved ${candidate} manifest changed`);
  if(fixed) { assert.equal(manifest.value.schema,'cuberoot.opt9-preserved.v1');assert.equal(manifest.value.candidate,'fixed');assert.equal(Object.keys(manifest.value.files).length,32); }
  const items=fixed?Object.entries(manifest.value.files).map(([path,value]:[string,any])=>({path,...value})):manifest.value.records;
  const records=Object.fromEntries(items.map((item:any)=>{
    assert(typeof item.path==='string'&&!item.path.includes('..')&&!isAbsolute(item.path));
    const path=resolve(directory,item.path), info=lstatSync(path);
    assert.equal(info.size,item.bytes);assert.equal(binaryHash(path),item.sha256,`Preserved ${candidate} evidence changed: ${item.path}`);
    return [item.path,{path,sha256:item.sha256}];
  })) as Record<string,{path:string;sha256:string}>;
  const label=`wca1000-mt16-rust-native-opt9-exp-${candidate}`;
  const report=record(records[label+'-report.json'].path).value;
  const resources=record(records[label+'-resources.json'].path).value;
  const exit=record(records[label+'-exit.json'].path).value;
  const launch=record(records[label+'-review/launch.json'].path).value;
  assert.equal(report.schema,'cuberoot.opt9-native-experiment-report.v1');
  assert.equal(report.build.candidate,candidate);assert.equal(report.totalSeconds,fixed?43.23124978399998:55.80179769600003);
  assert.deepEqual([report.cases,report.threads,report.batchThreads,report.measuredPasses,report.warmupCases],[1000,16,1,1,0]);
  assert.deepEqual([report.verifiedSolutions,report.baselineVerifiedSolutions,report.optimalLengthsMatched],[1000,1000,1000]);
  if(fixed) assert.deepEqual([report.dynamicVerifiedSolutions,report.dynamicOptimalLengthsMatched],[1000,1000]);
  assert.equal(exit.exitCode,0);assert.equal(exit.signal,null);
  assert.equal(resources.stopped,'');assert.equal(resources.trigger,null);assert.equal(resources.pressure,1);assert.equal(resources.swapouts,0);
  assert(resources.minimumHeadroom>=2*GiB && resources.peakRss<=resources.rssLimit);
  assert.equal(report.rawSha256,records[label+'.jsonl'].sha256);assert.equal(report.resourceSha256,records[label+'-resources.json'].sha256);
  assert.equal(report.reviewSha256,records[label+'-review/launch.json'].sha256);
  assert.equal(resources.multithreadReviewReceipt.reviewSha256,report.reviewSha256);
  assert.deepEqual(report.build,launch.nativeExperiment.build);
  const prefix=fixed?'':'source/';
  assert.equal(report.build.binary.sha256,records[`${prefix}${candidate}-native`].sha256);
  assert.equal(report.build.sha256,records[`${prefix}${candidate}-build.json`].sha256);
  for(const [name,sha256] of Object.entries(report.build.sourceSha256))assert.equal(records[`${prefix}${name}`]?.sha256,sha256);
  assert.equal(binaryHash(opt9ExperimentConfig(candidate).executable),records[`${prefix}${candidate}-native`].sha256,`Keep the successful ${candidate} executable unchanged`);
  return {manifest:{path:manifest.path,sha256:manifest.sha256},records,
    report:records[label+'-report.json'],resources:records[label+'-resources.json'],exit:records[label+'-exit.json'],
    launch:records[label+'-review/launch.json'],results:records[label+'.jsonl'],
    totalSeconds:report.totalSeconds,boot:resources.boot,swapouts:resources.swapouts};
}

/** Bounded archive audit only. No PDB read or solver execution. */
export function collectOpt9FixedReference() { return collectOpt9PreservedReference('fixed'); }

export function validateOpt9FixedReference(reference: any, now: Observation) {
  assert.equal(reference?.manifest.sha256,opt9ExperimentHashes.fixedManifest);
  assert.equal(reference.totalSeconds,43.23124978399998);
  assert.equal(reference.boot,now.boot);assert.equal(reference.swapouts,now.swapouts);assert.equal(reference.swapouts,0);
}

function collectOriginalOpt9Reference() {
  const manifest = record(resolve(opt9ExperimentPaths.baseline,'manifest.json'));
  assert.equal(manifest.sha256,opt9ExperimentHashes.baselineManifest,'Preserved native baseline manifest changed');
  const records = Object.fromEntries(manifest.value.records.map((item: any) => {
    assert(typeof item.path === 'string' && !item.path.includes('..') && !isAbsolute(item.path));
    const path = resolve(opt9ExperimentPaths.baseline,item.path);
    assert.equal(binaryHash(path),item.sha256,`Preserved baseline changed: ${item.path}`);
    return [item.path,{path,sha256:item.sha256}];
  })) as Record<string,{path:string;sha256:string}>;
  assert.equal(binaryHash(multithreadPaths.native),records['cube48opt-research'].sha256,'Original native executable must remain unchanged');
  const resources = record(resolve(OUTPUT,'wca1000-mt16-rust-native-opt9-resources.json'));
  const exit = record(resolve(OUTPUT,'wca1000-mt16-rust-native-opt9-exit.json'));
  assert.equal(resources.sha256,opt9ExperimentHashes.baselineResources); assert.equal(exit.sha256,opt9ExperimentHashes.baselineExit);
  assert.equal(exit.value.exitCode,0); assert.equal(exit.value.signal,null);
  assert.equal(resources.value.stopped,''); assert.equal(resources.value.trigger,null);
  const report = record(records['report.json'].path).value;
  assert.equal(report.verifiedSolutions,1000); assert.equal(report.threads,16); assert.equal(report.warmupCases,0); assert.equal(report.measuredPasses,1);
  return {manifest:{path:manifest.path,sha256:manifest.sha256},records,resources:{path:resources.path,sha256:resources.sha256},exit:{path:exit.path,sha256:exit.sha256}};
}
function collectOpt9ExperimentEvidence(candidate: string) {
  assert(!existsSync(opt9ExperimentPaths.stop), 'A native experiment failed; no automatic continuation');
  const config = opt9ExperimentConfig(candidate), build = record(config.buildPath);
  assert.equal(build.value.schema, 'cuberoot.opt9-native-experiment-build.v1');
  const actual = experimentBuildObservation(candidate);
  for (const field of Object.keys(actual)) assert.deepEqual(build.value[field], actual[field as keyof typeof actual], `Changed candidate build ${field}`);
  const baseline=collectOriginalOpt9Reference();
  const failedStderr = {path:opt9ExperimentPaths.failedStderr,sha256:hash(bounded(opt9ExperimentPaths.failedStderr))};
  assert.equal(failedStderr.sha256,opt9ExperimentHashes.failedStderr);
  const dynamicReference=config.requiresDynamicReference ? collectOpt9PreservedReference('dynamic') : undefined;
  const fixedReference=config.requiresFixedReference ? collectOpt9FixedReference() : undefined;
  return {candidate,build:{path:build.path,sha256:build.sha256,...actual},
    baseline,
    ...(dynamicReference?{dynamicReference}:{}),
    ...(fixedReference?{fixedReference}:{}),
    failedStderr,protocolSha256:Object.fromEntries(['run-opt9-experiment.mts','run-multithread.mts','benchmark.mjs','report-opt10-wca100.mjs'].map(name=>[name,hash(bounded(resolve(HERE,name)))]))};
}

function collectOpt10BaselineReference(candidate:'baseline'|'hotpath'|'coset'='baseline') {
  const preserved=candidate!=='baseline',coset=candidate==='coset';
  const archive=coset?opt10ExperimentPaths.cosetArchive:preserved?opt10ExperimentPaths.hotpathArchive:opt10ExperimentPaths.archive;
  const pinned=coset?opt10CosetReferenceHashes:opt10HotpathReferenceHashes;
  let manifest;
  if(preserved) {
    const m=record(resolve(archive,'manifest.json'));
    assert.equal(m.sha256,pinned.manifest,`Preserved ${candidate} manifest changed`);
    assert.equal(m.value.schema,'cuberoot.opt10-native-snapshot.v1');assert.equal(m.value.candidate,candidate);
    assert.equal(Object.keys(m.value.files).length,coset?40:35);
    for(const [name,sha256] of Object.entries(m.value.files)) {
      assert(!isAbsolute(name)&&!name.includes('..'));
      assert.equal(binaryHash(resolve(archive,name)),sha256,`Preserved ${candidate} file changed: ${name}`);
    }
    manifest={path:m.path,sha256:m.sha256};
  }
  const config=opt10ExperimentConfig(candidate),prefix=resolve(OUTPUT,config.label);
  const report=record(prefix+'-report.json'),resources=record(prefix+'-resources.json'),exit=record(prefix+'-exit.json');
  const launch=record(prefix+'-review/launch.json'),results={path:prefix+'.jsonl',sha256:hash(bounded(prefix+'.jsonl',8*MiB))};
  const r=report.value,s=resources.value;
  assert.equal(r.schema,'cuberoot.opt10-native-experiment-report.v1');assert.equal(r.experiment,candidate);
  assert.deepEqual([r.cases,r.threads,r.batchThreads,r.measuredPasses,r.warmupCases,r.verifiedSolutions,r.baselineVerifiedSolutions,r.optimalLengthsMatched],[1000,16,1,1,0,1000,1000,1000]);
  assert.equal(exit.value.exitCode,0);assert.equal(exit.value.signal,null);
  if(preserved) {
    assert.equal(report.sha256,pinned.report);assert.equal(r.totalSeconds,coset?24.591098480000003:25.145347332000014);
    assert.deepEqual([r.opt10BaselineVerifiedSolutions,r.opt10BaselineOptimalLengthsMatched],[1000,1000]);
    if(coset)assert.deepEqual([r.hotpathVerifiedSolutions,r.hotpathOptimalLengthsMatched],[1000,1000]);
    for(const item of [report,resources,exit,launch,results])assert.equal(hash(bounded(resolve(archive,item.path.slice(OUTPUT.length+1)),8*MiB)),item.sha256);
  }
  assert.equal(s.stopped,'');assert.equal(s.trigger,null);assert.equal(s.pressure,1);assert.equal(s.swapouts,0);
  assert(s.minimumHeadroom>=2*GiB&&s.peakRss<=s.rssLimit);
  assert.equal(r.rawSha256,results.sha256);assert.equal(r.resourceSha256,resources.sha256);assert.equal(r.reviewSha256,launch.sha256);
  assert.equal(s.multithreadReviewReceipt.reviewSha256,launch.sha256);
  assert.deepEqual(r.build,launch.value.opt10Experiment.build);
  const build=record(config.buildPath);assert.equal(build.sha256,r.build.sha256);
  assert.equal(binaryHash(config.executable),r.build.binary.sha256);
  assert.equal(binaryHash(resolve(archive,`${candidate}-native`)),r.build.binary.sha256);
  assert.equal(hash(bounded(resolve(archive,`${candidate}-build.json`))),r.build.sha256);
  // A frozen reference is bound to its own recorded build, not today's source
  // inventory. New Opt11 modules must not make a preserved Opt10 snapshot look
  // incomplete. Current candidates are still checked against the current list.
  const frozenSources = Object.entries(r.build.sourceSha256);
  assert(frozenSources.length > 0, 'Preserved Opt10 build has no source inventory');
  for(const [name, sha256] of frozenSources) {
    assert(!isAbsolute(name) && !name.includes('..'));
    assert(typeof sha256 === 'string' && /^[a-f0-9]{64}$/.test(sha256));
    assert.equal(hash(bounded(resolve(archive,name))),sha256,`Preserved Opt10 ${candidate} source changed: ${name}`);
  }
  return {report:{path:report.path,sha256:report.sha256},resources:{path:resources.path,sha256:resources.sha256},exit:{path:exit.path,sha256:exit.sha256},
    launch:{path:launch.path,sha256:launch.sha256},results,build:r.build,totalSeconds:r.totalSeconds,boot:s.boot,swapouts:s.swapouts,
    ...(manifest?{manifest}: {})};
}
function collectOpt10ExperimentEvidence(candidate: string) {
  assert(!existsSync(opt10ExperimentPaths.stop)&&!existsSync(opt9ExperimentPaths.stop),'A native experiment failed; no automatic continuation');
  const config=opt10ExperimentConfig(candidate),build=record(config.buildPath),actual=nativeBuildObservation(config);
  assert.equal(build.value.schema,'cuberoot.opt10-native-experiment-build.v1');
  for(const field of Object.keys(actual))assert.deepEqual(build.value[field],actual[field as keyof typeof actual],`Changed Opt10 build ${field}`);
  const original=collectOriginalOpt9Reference(),failedStderr={path:opt9ExperimentPaths.failedStderr,sha256:hash(bounded(opt9ExperimentPaths.failedStderr))};
  assert.equal(failedStderr.sha256,opt9ExperimentHashes.failedStderr);
  return {candidate,build:{path:build.path,sha256:build.sha256,...actual},original,failedStderr,
    ...(candidate!=='baseline'?{baselineReference:collectOpt10BaselineReference()}:{}),
    ...(config.requiresHotpathReference?{hotpathReference:collectOpt10BaselineReference('hotpath')}:{}),
    ...(config.requiresCosetReference?{cosetReference:collectOpt10BaselineReference('coset')}:{}),
    protocolSha256:Object.fromEntries(['run-opt10-experiment.mts','run-opt9-experiment.mts','run-multithread.mts','benchmark.mjs','report-opt10-wca100.mjs'].map(name=>[name,hash(bounded(resolve(HERE,name)))]))};
}

/** Small files + stat only, except fixed 512/1024-byte headers. Never hash/read PDB payloads. */
export function collectMultithreadEvidence(request: MultithreadRequest) {
  const policy = multithreadPolicy(request, cpus().length);
  const baseline = record(multithreadPaths.baseline), stopped = record(multithreadPaths.stopped);
  const priorResources = record(multithreadPaths.priorResources), priorExit = record(multithreadPaths.priorExit), priorReport = record(multithreadPaths.priorReport);
  const inputPath = policy.count === 100 ? multithreadPaths.input : resolve(OUTPUT, 'wca1000-single.tsv');
  const corpus = readWca100(resolve(ROOT, "solver/testdata/benchmarks/wca-first" + policy.count + ".json"), policy.count), inputBytes = bounded(inputPath);
  assert.equal(corpus.cases.length, policy.count);

  assert(inputBytes.equals(Buffer.from(corpus.cases.map(item => `${item.id}\t${item.scramble}\n`).join(''))), 'Input must be exactly WCA first100 in source order');
  const input = { path: inputPath, sha256: hash(inputBytes), corpusSha256: corpus.corpusSha256 };
  const info = lstatSync(policy.tablePath);
  assert(info.isFile() && !info.isSymbolicLink() && info.size === policy.tableBytes, 'Complete canonical table with exact size is required');
  const table: any = { path: policy.tablePath, bytes: info.size };
  let snapshot;
  if (policy.snapshotPath) {
    const bytes = bounded(policy.snapshotPath, 818_008), expected = getVariant(policy.variant ?? 9).smallMemoryBytes;
    assert.equal(bytes.length, expected); snapshot = { path: policy.snapshotPath, bytes: bytes.length, sha256: hash(bytes) };
  }
  if (policy.h !== null || policy.backend === 'opt10') {
    const fd = openSync(policy.tablePath, constants.O_RDONLY | constants.O_NOFOLLOW), header = Buffer.alloc(policy.h !== null ? 512 : 1024);
    try { assert.equal(readSync(fd, header, 0, header.length, policy.h !== null ? 1_120_256 : 0), header.length); }
    finally { closeSync(fd); }
    table.headerSha256 = hash(header);
    if (policy.backend === 'opt10') {
      const metadata = record(resolve(OUTPUT, 'opt10-generated-v2/generation-metadata.json'));
      assert.equal(metadata.value.schema, 'cuberoot.opt10.generation-metadata.v1');
      assert.equal(metadata.value.generation.exitCode, 0); assert.equal(metadata.value.generation.completedDepth, 12);
      assert.equal(metadata.value.generation.resources.stopped, '');
      assert.equal(metadata.value.table.path, table.path); assert.equal(metadata.value.table.bytes, table.bytes);
      assert.equal(metadata.value.table.headerSha256, table.headerSha256);
      assert.equal(header.subarray(72, 104).toString('hex'), snapshot!.sha256);
      assert.equal(header.subarray(104, 136).toString('hex'), metadata.value.table.payloadSha256);
      table.payloadSha256 = metadata.value.table.payloadSha256;
      table.generationMetadata = { path: metadata.path, sha256: metadata.sha256 };
    }
  }
  const sourceSha256 = Object.fromEntries(multithreadSources.map(name => [name, hash(bounded(resolve(HERE, name)))]));
  let wasmBuild;
  if (policy.wasmConfig) {
    const config = policy.wasmConfig, build = record(resolve(dirname(config.wasm), 'build-metadata.json'));
    const contract = wasmBuildContract(config, build.value); assert(contract.shared);
    const sources = sharedBuildSources(build.value);
    for (const [name, sha256] of Object.entries(sources)) assert.equal(hash(bounded(resolve(ROOT, name))), sha256, `Build source changed: ${name}`);
    const artifacts = Object.fromEntries([['wasm', config.wasm], ['wrapper', resolve(dirname(config.wasm), contract.wrapper)], ['worker', resolve(dirname(config.wasm), contract.worker!)]].map(([role, path]) => [role, { path, sha256: hash(bounded(path)) }]));
    assert.equal(artifacts.wasm.sha256, build.value.wasmSha256); assert.equal(artifacts.wrapper.sha256, build.value.wrapperSha256); assert.equal(artifacts.worker.sha256, build.value.workerSha256);
    wasmBuild = { path: build.path, sha256: build.sha256, artifacts };
  }
  const failedStop = existsSync(multithreadPaths.stop) ? record(multithreadPaths.stop) : undefined;
  let failedResources;
  if (failedStop) {
    assert(/^wca(?:100-mt18|1000-mt16)-[a-z0-9-]+$/.test(failedStop.value.label), 'Invalid stopped label');
    failedResources = record(resolve(OUTPUT, `${failedStop.value.label}-resources.json`));
  }
  const nativeExperiment = policy.experiment ? collectOpt9ExperimentEvidence(policy.experiment) : undefined;
  const opt10Experiment = policy.opt10Experiment ? collectOpt10ExperimentEvidence(policy.opt10Experiment) : undefined;
  if(opt10Experiment) {
    const original=record(opt10Experiment.original.records['launch.json'].path).value;
    assert.deepEqual(input,original.input,'Opt10 uses the exact same WCA1000 order');
    if(opt10Experiment.baselineReference) {
      const previous=record(opt10Experiment.baselineReference.launch.path).value;
      for(const [field,value] of Object.entries({input,snapshot,table}))assert.deepEqual(previous[field],value,`Opt10 baseline ${field} changed`);
    }
    if(opt10Experiment.hotpathReference) {
      const previous=record(opt10Experiment.hotpathReference.launch.path).value;
      for(const [field,value] of Object.entries({input,snapshot,table}))assert.deepEqual(previous[field],value,`Opt10 hotpath reference ${field} changed`);
    }
    if(opt10Experiment.cosetReference) {
      const previous=record(opt10Experiment.cosetReference.launch.path).value;
      for(const [field,value] of Object.entries({input,snapshot,table}))assert.deepEqual(previous[field],value,`Opt10 coset reference ${field} changed`);
    }
  }
  if (nativeExperiment) {
    const oldLaunch = record(nativeExperiment.baseline.records['launch.json'].path).value;
    assert.deepEqual(input,oldLaunch.input,'Experiments must reuse the exact preserved native input');
    assert.deepEqual(snapshot,oldLaunch.snapshot,'Experiments must reuse the preserved coordinate snapshot');
    assert.deepEqual(table,oldLaunch.table,'Experiments must use the same existing Opt9 table');
    assert.equal(hash(bounded(resolve(ROOT,'solver/testdata/benchmarks/wca-first1000.json'))),
      nativeExperiment.baseline.records['corpus.json'].sha256,'The fixed baseline corpus cannot be replaced');
    if(nativeExperiment.dynamicReference) {
      const dynamicLaunch=record(nativeExperiment.dynamicReference.launch.path).value;
      for(const [field,value] of Object.entries({input,snapshot,table}))assert.deepEqual(dynamicLaunch[field],value,`55.8s reference differs: ${field}`);
    }
    if(nativeExperiment.fixedReference) {
      const fixedLaunch=record(nativeExperiment.fixedReference.launch.path).value;
      for(const [field,value] of Object.entries({input,snapshot,table}))assert.deepEqual(fixedLaunch[field],value,`43.2s reference differs: ${field}`);
    }
  }
  return { policy, baseline, stopped, priorResources, priorExit, priorReport, failedStop, failedResources, input, inputBytes, snapshot, table,
    executableSha256: binaryHash(request.executable), sourceSha256, wasmBuild, nativeExperiment, opt10Experiment, machine: machine() };
}

export function makeMultithreadReview(request: MultithreadRequest, baseline: { boot: string; swapouts: number }) {
  const e = collectMultithreadEvidence(request), p = e.policy;
  return { schema: 'cuberoot.multithread-wca100-review.v1', scope: p.scope,
    reason: `User requested existing-table Mac benchmarks, ${p.threads} real solve threads, fixed WCA first${p.count} once without warmup. Preserve resource stop evidence and original swap history.`,
    reviewedAt: new Date().toISOString(), label: request.label, executable: request.executable, args: request.args,
    backend: p.backend, variant: p.variant, h: p.h, threads: p.threads, batchThreads: 1, cases: p.count, measuredPasses: 1, warmupCases: 0,
    baselineSha256: e.baseline.sha256, stoppedResourcesSha256: e.stopped.sha256,
    predecessor: { resourcesPath: e.priorResources.path, resourcesSha256: e.priorResources.sha256,
      exitPath: e.priorExit.path, exitSha256: e.priorExit.sha256, reportPath: e.priorReport.path, reportSha256: e.priorReport.sha256 },
    ...baseline, input: e.input, table: e.table, ...(e.snapshot ? { snapshot: e.snapshot } : {}),
    executableSha256: e.executableSha256, sourceSha256: e.sourceSha256, ...(e.wasmBuild ? { wasmBuild: e.wasmBuild } : {}),
    machine: e.machine,
    ...(e.nativeExperiment ? {nativeExperiment:e.nativeExperiment,continuation:{
      stopSha256:opt9ExperimentHashes.stop,resourcesSha256:opt9ExperimentHashes.failedResources,
      reason:'User authorized isolated native Opt9 experiments, fixed WCA1000 at sixteen threads once, preserving the original and successful dynamic versions. The exact preceding WASM bounds panic remains a non-resource program failure; baseline and swap history are never reset.'}} : {}),
    ...(e.opt10Experiment ? {opt10Experiment:e.opt10Experiment,continuation:{
      stopSha256:opt9ExperimentHashes.stop,resourcesSha256:opt9ExperimentHashes.failedResources,
      reason:'User authorized an isolated native Opt10 baseline and search candidate, fixed WCA1000 at sixteen threads once with no warmup. Preserve all prior binaries and the exact non-resource WASM bounds panic; never reset the resource baseline or swap history.'}} : {}),
  };
}

/** Pure evidence validation: consumes only already observed bounded records. */
export function validateMultithreadReview(review: any, e: any, request: MultithreadRequest, now: Observation,
  consumed = false, newerStop = false) {
  const p = e.policy, prior = e.baseline.value, resources = e.priorResources.value, exit = e.priorExit.value, report = e.priorReport.value;
  assert(!consumed, 'Run already consumed');
  if (p.experiment) validateOpt9ExperimentContinuation(review,e,request,now);
  if (p.opt10Experiment) validateOpt10ExperimentContinuation(review,e,request,now);
  if (newerStop) {
    if (p.experiment || p.opt10Experiment) { /* Already checked the exact, immutable program-failure continuation above. */ }
    else if (p.count === 1000) validateBenchmarkContinuation(review, e, request, now);
    else validateWasmRepairReview(review, e, request, now);
  }
  assert.equal(e.baseline.sha256, multithreadBaselineSha256); assert.equal(e.stopped.sha256, multithreadStoppedSha256);
  assert.equal(e.priorResources.sha256, multithreadPriorHashes.resources); assert.equal(e.priorExit.sha256, multithreadPriorHashes.exit); assert.equal(e.priorReport.sha256, multithreadPriorHashes.report);
  assert(prior.stopped && e.stopped.value.stopped === prior.stopped, 'Original stopped history must be retained');
  assert.equal(now.boot, prior.boot); assert.equal(now.swapouts, prior.swapouts); assert.equal(now.swapouts, 0); assert.equal(now.pressure, 1);
  assert(now.available >= p.rssLimit + 3 * GiB, 'Fresh 3 GiB startup headroom is required');
  assert.equal(resources.boot, now.boot); assert.equal(resources.swapouts, now.swapouts); assert.equal(resources.stopped, '');
  assert.equal(resources.pressure, 1); assert.equal(resources.trigger, null); assert(resources.minimumHeadroom >= 2 * GiB && resources.peakRss <= resources.rssLimit);
  assert.equal(resources.opt10ReviewReceipt.baselineSha256, multithreadBaselineSha256);
  assert.equal(exit.exitCode, 0); assert.equal(exit.signal, null);
  assert.equal(report.schema, 'cuberoot.rust-opt10.wca100-report.v1'); assert.equal(report.cases, 100);
  assert.equal(report.independentlyVerifiedSolutions, 100); assert.equal(report.optimalLengthsMatched, 100);
  assert.equal(report.protection.triggered, false);
  assert.equal(review.schema, 'cuberoot.multithread-wca100-review.v1'); assert.equal(review.scope, p.scope);
  assert(typeof review.reason === 'string' && review.reason.length > 30 && Number.isFinite(Date.parse(review.reviewedAt)), 'Explicit reviewed reason/date required');
  assert.deepEqual([review.label, review.executable, review.args], [request.label, request.executable, request.args]);
  assert.deepEqual([review.backend, review.variant, review.h], [p.backend, p.variant, p.h]);
  assert.deepEqual([review.threads, review.batchThreads, review.cases, review.measuredPasses, review.warmupCases], [p.threads, 1, p.count, 1, 0]);
  assert.equal(review.boot, now.boot); assert.equal(review.swapouts, now.swapouts);
  assert.equal(review.baselineSha256, e.baseline.sha256); assert.equal(review.stoppedResourcesSha256, e.stopped.sha256);
  assert.deepEqual(review.predecessor, { resourcesPath: e.priorResources.path, resourcesSha256: e.priorResources.sha256,
    exitPath: e.priorExit.path, exitSha256: e.priorExit.sha256, reportPath: e.priorReport.path, reportSha256: e.priorReport.sha256 });
  for (const field of ['input', 'table', 'snapshot', 'executableSha256', 'sourceSha256', 'wasmBuild', 'nativeExperiment', 'opt10Experiment']) assert.deepEqual(review[field], e[field], `Changed ${field}`);
  assert.deepEqual(Object.keys(e.sourceSha256).sort(), [...multithreadSources].sort());
  assert(review.machine?.platform === 'darwin' && review.machine.logicalCpus >= p.threads, 'Mac 18-worker machine record required');
  assert.deepEqual(review.machine, e.machine, 'Reviewed machine changed');
  return { ...review, commandSha256: hash(Buffer.from(JSON.stringify([request.executable, ...request.args]))) };
}

/** Explicit repair review only: a program failure cannot erase swap/pressure history. */
export function validateWasmRepairReview(review: any, e: any, request: MultithreadRequest, now: Observation) {
  const r = review.repair, stop = e.failedStop, resources = e.failedResources;
  assert(r && stop && resources, 'A later stop requires an explicit repair review');
  assert.equal(r.stopSha256, stop.sha256); assert.equal(r.resourcesSha256, resources.sha256);
  assert(typeof r.reason === 'string' && r.reason.length > 60, 'Record the user request and concrete diagnostic change');
  assert.equal(e.policy.entry, 'wasm-benchmark.mjs'); assert.equal(e.policy.variant, 9);
  assert(request.label !== stop.value.label && request.label.startsWith('wca100-mt18-wasm-opt9-repair-'));
  const old = stop.value.multithreadReviewReceipt;
  assert(old && old.variant === 9 && old.threads === 18);
  assert.equal(stop.value.stopped, 'Multithread child exited with status 1');
  assert.equal(resources.value.stopped, stop.value.stopped);
  assert.equal(resources.value.trigger.reason, stop.value.stopped);
  assert.equal(resources.value.trigger.details, undefined);
  for (const value of [stop.value, resources.value]) {
    assert.equal(value.boot, now.boot); assert.equal(value.swapouts, now.swapouts);
    assert.equal(value.swapouts, 0); assert.equal(value.pressure, 1);
  }
  assert(resources.value.minimumHeadroom >= 2 * GiB && resources.value.peakRss <= resources.value.rssLimit);
  assert.notEqual(e.wasmBuild.sha256, old.wasmBuild.sha256, 'Repair must use a newly reviewed build');
}

// This optional entry prepares only bounded evidence, never starts a solver.
// CUBEOPT_MULTITHREAD_REVIEW specifies the exclusive output path used by guard.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, label, executable, ...args] = process.argv.slice(2);
  assert.equal(mode, 'prepare', 'Usage: multithread-policy.mts prepare LABEL EXECUTABLE [ARGS]');
  assert.equal(process.platform, 'darwin');
  const path = process.env.CUBEOPT_MULTITHREAD_REVIEW;
  assert(path && isAbsolute(path), 'Set CUBEOPT_MULTITHREAD_REVIEW to a new absolute review path');
  const prior = JSON.parse(bounded(multithreadPaths.baseline).toString());
  const request = {label, executable, args, env: process.env};
  const value = makeMultithreadReview(request, {boot:prior.boot,swapouts:prior.swapouts});
  const requestPath = resolve(dirname(path), 'request.json');
  assert(!existsSync(path) && !existsSync(requestPath), 'Review/request outputs must both be new');
  mkdirSync(dirname(path), {recursive:true});
  writeFileSync(path, JSON.stringify(value,null,2)+'\n', {flag:'wx',mode:0o600});
  const reviewSha256 = hash(bounded(path));
  const env = Object.fromEntries(['CUBEOPT_MULTITHREAD_REVIEW','CUBEOPT_BACKEND','CUBEOPT_VARIANT','CUBEOPT_H',
    'CUBEOPT_SEARCH_THREADS','CUBEOPT_SOLVE_THREADS','CUBEOPT_MEASURE_RSS'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
  writeFileSync(requestPath,JSON.stringify({schema:'cuberoot.multithread-wca100-request.v1',reviewPath:path,reviewSha256,label,executable,args,env},null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({reviewPath:path,reviewSha256,requestPath,label,
    threads:18,cases:100,preparedOnly:true,rssLimit:multithreadPolicy(request,cpus().length).rssLimit}));
}

/** New user-authorized 1000/16 protocol; only the known non-resource program failure can be reviewed. */
export function validateBenchmarkContinuation(review: any, e: any, request: MultithreadRequest, now: Observation) {
  const r = review.continuation, stop = e.failedStop, resources = e.failedResources;
  assert(r && stop && resources);
  assert.equal(e.policy.scope, 'mac16-wca1000-single');
  const predecessor = stop.value.label;
  assert(predecessor === 'wca100-mt18-wasm-opt9-repair-trace'
    || (predecessor === 'wca1000-mt16-original-wasm-opt9' && ['wca1000-mt16-rust-native-opt9','wca1000-mt16-rust-wasm-opt9'].includes(request.label))
    || (predecessor === 'wca1000-mt16-rust-native-opt9' && request.label === 'wca1000-mt16-rust-wasm-opt9'), 'Only a different remaining engine may follow a program failure');
  assert.equal(r.stopSha256, stop.sha256); assert.equal(r.resourcesSha256, resources.sha256);
  assert(typeof r.reason === 'string' && r.reason.length > 60);
  assert.equal(stop.value.stopped, 'Multithread child exited with status 1');
  assert.equal(resources.value.stopped, stop.value.stopped);
  assert.equal(resources.value.trigger.reason, stop.value.stopped);
  assert.equal(resources.value.trigger.details, undefined);
  for (const v of [stop.value, resources.value]) {
    assert.equal(v.boot, now.boot); assert.equal(v.swapouts, now.swapouts);
    assert.equal(v.swapouts, 0); assert.equal(v.pressure, 1);
  }
  assert(resources.value.minimumHeadroom >= 2 * GiB && resources.value.peakRss <= resources.value.rssLimit);
}

function validatePinnedWasmProgramFailure(review:any,e:any,now:Observation) {
  const stop=e.failedStop,resources=e.failedResources;
  assert.equal(stop?.sha256,opt9ExperimentHashes.stop); assert.equal(resources?.sha256,opt9ExperimentHashes.failedResources);
  assert.equal(stop.value.label,'wca1000-mt16-rust-wasm-opt9');
  assert.equal(stop.value.multithreadReviewReceipt.scope,'mac16-wca1000-single');
  assert.equal(stop.value.multithreadReviewReceipt.variant,9); assert.equal(stop.value.multithreadReviewReceipt.threads,16);
  assert.equal(stop.value.stopped,'Multithread child exited with status 1');
  assert.equal(resources.value.stopped,stop.value.stopped); assert.equal(resources.value.trigger.reason,stop.value.stopped);
  assert.equal(resources.value.trigger.details,undefined);
  for (const v of [stop.value,resources.value]) {
    assert.equal(v.boot,now.boot); assert.equal(v.swapouts,now.swapouts); assert.equal(v.swapouts,0); assert.equal(v.pressure,1);
  }
  assert(resources.value.minimumHeadroom>=2*GiB && resources.value.peakRss<=resources.value.rssLimit);
  assert.equal(review.continuation?.stopSha256,stop.sha256); assert.equal(review.continuation?.resourcesSha256,resources.sha256);
  assert(typeof review.continuation.reason==='string' && review.continuation.reason.length>60);
}
/** Only the pinned WASM1000 bounds panic permits isolated native candidates. */
export function validateOpt9ExperimentContinuation(review: any, e: any, request: MultithreadRequest, now: Observation) {
  const p=e.policy, experiment=e.nativeExperiment;
  assert.equal(p.scope,opt9ExperimentScope); assert.equal(p.entry,'native'); assert.equal(p.backend,'opt'); assert.equal(p.variant,9);
  assert.equal(p.count,1000); assert.equal(p.threads,16);
  const config=opt9ExperimentConfig(p.experiment);
  assert.equal(request.label,config.label); assert.equal(request.executable,config.executable);
  validatePinnedWasmProgramFailure(review,e,now);
  assert.equal(experiment?.candidate,p.experiment);
  assert.deepEqual(experiment.build.features,config.features);
  assert.equal(experiment.build.binary.path,request.executable); assert.equal(experiment.build.binary.sha256,e.executableSha256);
  assert.equal(experiment.failedStderr.sha256,opt9ExperimentHashes.failedStderr);
  for (const name of opt9ExperimentBuildSources) assert.equal(experiment.build.sourceSha256[name],e.sourceSha256[name],`Candidate source mismatch: ${name}`);
  assert.equal(experiment.baseline.manifest.sha256,opt9ExperimentHashes.baselineManifest);
  assert.equal(experiment.baseline.resources.sha256,opt9ExperimentHashes.baselineResources);
  assert.equal(experiment.baseline.exit.sha256,opt9ExperimentHashes.baselineExit);
  if(config.requiresDynamicReference) {
    assert.equal(experiment.dynamicReference?.manifest.sha256,opt9ExperimentHashes.dynamicManifest);
    assert.equal(experiment.dynamicReference.totalSeconds,55.80179769600003);
    assert.equal(experiment.dynamicReference.boot,now.boot);assert.equal(experiment.dynamicReference.swapouts,now.swapouts);
  } else assert.equal(experiment.dynamicReference,undefined,'The original experiment protocol remains unchanged');
  if(config.requiresFixedReference) validateOpt9FixedReference(experiment.fixedReference,now);
  else assert.equal(experiment.fixedReference,undefined,'The existing experiment protocol remains unchanged');
}

export function validateOpt10ExperimentContinuation(review:any,e:any,request:MultithreadRequest,now:Observation) {
  const p=e.policy,experiment=e.opt10Experiment,config=opt10ExperimentConfig(p.opt10Experiment);
  assert.equal(p.scope,opt10ExperimentScope);assert.equal(p.entry,'native');assert.equal(p.backend,'opt10');
  assert.equal(p.variant,null);assert.equal(p.h,null);assert.equal(p.count,1000);assert.equal(p.threads,16);
  assert.equal(request.label,config.label);assert.equal(request.executable,config.executable);
  validatePinnedWasmProgramFailure(review,e,now);
  assert.equal(experiment?.candidate,config.candidate);assert.deepEqual(experiment.build.features,config.features);
  assert.equal(experiment.build.binary.path,request.executable);assert.equal(experiment.build.binary.sha256,e.executableSha256);
  for(const name of opt9ExperimentBuildSources)assert.equal(experiment.build.sourceSha256[name],e.sourceSha256[name],`Opt10 build source mismatch: ${name}`);
  assert.equal(experiment.failedStderr.sha256,opt9ExperimentHashes.failedStderr);
  assert.equal(experiment.original.manifest.sha256,opt9ExperimentHashes.baselineManifest);
  assert.equal(experiment.original.resources.sha256,opt9ExperimentHashes.baselineResources);
  assert.equal(experiment.original.exit.sha256,opt9ExperimentHashes.baselineExit);
  if(config.candidate!=='baseline') {
    assert(experiment.baselineReference,'A verified Opt10 baseline must precede search');
    assert.equal(experiment.baselineReference.boot,now.boot);assert.equal(experiment.baselineReference.swapouts,now.swapouts);
    assert.equal(experiment.baselineReference.swapouts,0);
    assert(Number.isFinite(experiment.baselineReference.totalSeconds)&&experiment.baselineReference.totalSeconds>0);
  } else assert.equal(experiment.baselineReference,undefined);
  if(config.requiresHotpathReference) {
    const reference=experiment.hotpathReference;
    assert.equal(reference?.manifest.sha256,opt10HotpathReferenceHashes.manifest);
    assert.equal(reference.report.sha256,opt10HotpathReferenceHashes.report);assert.equal(reference.totalSeconds,25.145347332000014);
    assert.equal(reference.boot,now.boot);assert.equal(reference.swapouts,now.swapouts);assert.equal(reference.swapouts,0);
  } else assert.equal(experiment.hotpathReference,undefined,'Earlier Opt10 protocols remain unchanged');
  if(config.requiresCosetReference) {
    const reference=experiment.cosetReference;
    assert.equal(reference?.manifest.sha256,opt10CosetReferenceHashes.manifest);
    assert.equal(reference.report.sha256,opt10CosetReferenceHashes.report);assert.equal(reference.totalSeconds,24.591098480000003);
    assert.equal(reference.boot,now.boot);assert.equal(reference.swapouts,now.swapouts);assert.equal(reference.swapouts,0);
  } else assert.equal(experiment.cosetReference,undefined,'Earlier Opt10 protocols remain unchanged');
}
