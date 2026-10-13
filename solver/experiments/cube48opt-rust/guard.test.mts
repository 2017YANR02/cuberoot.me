// Pure policy / 512-byte synthetic-header tests. Never open a PDB or spawn a solver.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { h48FileBytes, researchPolicy, validateH48Metadata, validateOpt10GenerationProof, validateOpt10Metadata } from './guard.mts';
import { blockedCompute } from '../../../.codex/hooks/block-unprotected-memory-compute.mts';
import { parsePrintedSolution, parseWasmBenchmarkArguments, readWca100 } from './wasm-benchmark.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const native = resolve(here, 'target/release/cube48opt-research');
test('WASM comparison fixes corpus, variant, one thread and sequential full-memory budget', () => {
  const script = resolve(here, 'wasm-benchmark.mjs');
  const base = ['--variant', '9', '--table', 'table', '--small', 'small', '--wasm', 'wasm', '--out', 'out'];
  const env = { CUBEOPT_BACKEND:'opt', CUBEOPT_VARIANT:'9' };
  const policy = researchPolicy('wasm-wca100', process.execPath, [script, ...base], env);
  assert.equal(policy.entry, 'wasm-benchmark.mjs');
  assert.equal(policy.rssLimit, 15_565_455_360 * 17 / 16 + 19_208_560 + 2 ** 30);
  assert.equal(policy.deadlineMs, 3_600_000);
  for (const engine of ['rust', 'original', 'both']) {
    const parsed = parseWasmBenchmarkArguments([...base, '--engine', engine]);
    assert.equal(parsed.engine, engine);
    assert.equal(researchPolicy('wasm-wca100', process.execPath, [script, ...base, '--engine', engine], env).rssLimit, policy.rssLimit);
  }
  assert.equal(researchPolicy('wasm8', process.execPath, [script, ...base.map(x=>x==='9'?'8':x)], {...env,CUBEOPT_VARIANT:'8'}).tableBytes, 7_782_727_680);
  for (const invalid of [['--variant','10'], ['--threads','2'], ['--cases','other.json'], ['--warmup'], ['--repeat','3'], ['--worker','input.json']])
    assert.throws(()=>parseWasmBenchmarkArguments([...base,...invalid]));
  for (const badEnv of [{...env,CUBEOPT_VARIANT:'8'}, {...env,CUBEOPT_H:'9'}, {...env,CUBEOPT_SOLVE_THREADS:'2'}, {...env,CUBEOPT_MEASURE_RSS:'1'}, {...env,CUBEOPT_BACKEND:'h48'}, {...env,CUBEOPT_BACKEND:'opt10'}])
    assert.throws(()=>researchPolicy('wasm-wca100',process.execPath,[script,...base],badEnv));
  assert.throws(()=>researchPolicy('wasm-wca100',process.execPath,['/tmp/wasm-benchmark.mjs',...base],env));
  const corpus=readWca100(); assert.equal(corpus.cases.length,100); assert.equal(corpus.cases[0].id,'22001'); assert.equal(corpus.cases.at(-1).id,'273001');
});

test('WASM output must contain one complete solution, never a silent failure or duplicate', () => {
  const lines=["Solution found!: R'", 'Cube1 finished in 1, tt=1.250 ms'];
  assert.deepEqual(parsePrintedSolution(lines), {solution:"R'",length:1,engineReportedSeconds:0.00125});
  assert.throws(()=>parsePrintedSolution([...lines,...lines]));
  assert.throws(()=>parsePrintedSolution([...lines,'Error, solution not correct!']));
  assert.throws(()=>parsePrintedSolution(['Cube1 finished in 1']));
});

test('Opt10 verification permits only a bounded Opt1 read-only verification target', () => {
  const root=resolve(here,'../../..'), executable=resolve(here,'target/release/examples/verify_opt10_generation');
  const args=['--verify-opt1',resolve(root,'.tmp/cubeopt-reverse/opt9-generated/small-memory.bin'),resolve(root,'.tmp/cubeopt-reverse/opt1-generated/h48prun01.dat'),'16'];
  const env={CUBEOPT_BACKEND:'opt10-verify',CUBEOPT_VARIANT:'1'};
  const policy=researchPolicy('verify-opt1',executable,args,env);
  assert.equal(policy.tableBytes,30_401_280); assert.equal(policy.rssLimit,512*2**20); assert.equal(policy.deadlineMs,3_600_000);
  for(const replacement of ['--generate','--verify-opt10']) assert.throws(()=>researchPolicy('verify-opt1',executable,[replacement,...args.slice(1)],env));
  for(const index of [1,2,3]) { const bad=[...args]; bad[index]='other'; assert.throws(()=>researchPolicy('verify-opt1',executable,bad,env)); }
  for(const badEnv of [{...env,CUBEOPT_VARIANT:'9'},{...env,CUBEOPT_H:'11'},{...env,CUBEOPT_BACKEND:'opt10'},{...env,CUBEOPT_SOLVE_THREADS:'16'}])
    assert.throws(()=>researchPolicy('verify-opt1',executable,args,badEnv));
});
test('H9 startup exemption is scoped to the real guard and one exact target', () => {
  const command='CUBEOPT_BACKEND=h9gen node --experimental-strip-types solver/experiments/cube48opt-rust/guard.mts h9-generate solver/target/release/table_generator --only h48-h9';
  assert.equal(blockedCompute(command),undefined);
  assert.notEqual(blockedCompute(command.replace('h48-h9','h48-h11')),undefined);
  assert.notEqual(blockedCompute('solver/target/release/table_generator --only h48-h9'),undefined);
  assert.notEqual(blockedCompute(command+'; solver/target/release/table_generator --only h48-h10'),undefined);
});
test('Opt10 commands never receive a smaller existing backend or an unrelated binary', () => {
  const root=resolve(here,'../../..'), binary=resolve(root,'solver/experiments/cube48opt-rust/target/release/cube48opt-research');
  for (const command of ['generate-opt10','solve-opt10']) {
    for (const backend of ['opt','h10','h48','opt10']) {
      assert.throws(() => researchPolicy('opt10',binary,[command,'missing-small','missing-table'],{CUBEOPT_BACKEND:backend}), /dedicated binary/);
    }
  }
});
test('Opt10 generation and solving have fixed canonical paths, options and full budgets', () => {
  const root=resolve(here,'../../..'), binary=resolve(here,'target/opt10/release/cube48opt-research');
  const small=resolve(root,'.tmp/cubeopt-reverse/opt9-generated/small-memory.bin');
  const table=resolve(root,'.tmp/cubeopt-reverse/opt10-generated/cuberoot-opt10.dat');
  const env={CUBEOPT_BACKEND:'opt10'};
  const generate=['generate-opt10',small,table,'16'], solve=['solve-opt10',small,table,'8','20','0'];
  const generation=researchPolicy('opt10-generate',binary,generate,env);
  assert.equal(generation.tableBytes,31_130_911_744); assert.equal(generation.rssLimit,31_130_910_720+2**30);
  assert.equal(generation.deadlineMs,6*60*60_000);
  const solving=researchPolicy('opt10-solve',binary,solve,{...env,CUBEOPT_MEASURE_RSS:'1'});
  assert.equal(solving.rssLimit,generation.rssLimit); assert.equal(solving.deadlineMs,60*60_000); assert.equal(solving.measureNativeRss,true);
  for(const args of [generate,solve]) {
    for(const backend of ['opt','h10','h48',undefined]) assert.throws(()=>researchPolicy('opt10',binary,args,{CUBEOPT_BACKEND:backend}));
    for(const badEnv of [{...env,CUBEOPT_VARIANT:'1'},{...env,CUBEOPT_H:'11'},{...env,CUBEOPT_SOLVE_THREADS:'16'},{...env,CUBEOPT_BENCHMARK:'1'}])
      assert.throws(()=>researchPolicy('opt10',binary,args,badEnv));
    assert.throws(()=>researchPolicy('opt10',binary+'-copy',args,env));
    for(const index of [1,2,3]) {const bad=[...args];bad[index]='other';assert.throws(()=>researchPolicy('opt10',binary,bad,env));}
    assert.throws(()=>researchPolicy('opt10',binary,[...args,'extra'],env));
  }
  assert.throws(()=>researchPolicy('opt10',binary,generate,{...env,CUBEOPT_MEASURE_RSS:'1'}));
  assert.throws(()=>researchPolicy('opt10',binary,['solve-h48','11',table],env));
  for(const index of [4,5]) {const bad=[...solve];bad[index]='1';assert.throws(()=>researchPolicy('opt10',binary,bad,env));}
});

test('Opt10 generation proof rejects stale sources, incomplete coverage and stopped resources', () => {
  const names=['src/opt10_generate.rs','src/opt10.rs','src/opt10_table.rs','src/coord.rs','src/cube.rs'];
  const hashes=Object.fromEntries(names.map(name=>[name,'a'.repeat(64)]));
  const proof={schema:'cuberoot.opt10.generation-proof.v1',exitCode:0,sourceSha256:hashes,
    result:{schema:'cuberoot.opt10.opt1-generation-validation.v1',sharedGenerator:true,projectionEoBits:0,base:7,completedDepth:9,threads:16,
      comparedValidCells:117_567_450,differences:0,allEqual:true,tableWritten:false,distribution:[117_567_450,0,0,0,0,0,0,0,0,0,0]},
    resources:{backend:'opt10-verify',variant:1,mode:'verify-opt1',stopped:'',pressure:1,boot:'same-boot',swapouts:0,peakRss:300_000_000,minimumHeadroom:3*2**30}};
  const current={boot:'same-boot',swapouts:0};
  validateOpt10GenerationProof(proof,hashes,current);
  for(const field of ['sharedGenerator','allEqual','tableWritten']) {
    const invalid=structuredClone(proof);invalid.result[field]=!invalid.result[field];assert.throws(()=>validateOpt10GenerationProof(invalid,hashes,current));
  }
  for(const field of ['comparedValidCells','differences','completedDepth']) {
    const invalid=structuredClone(proof);invalid.result[field]++;assert.throws(()=>validateOpt10GenerationProof(invalid,hashes,current));
  }
  assert.throws(()=>validateOpt10GenerationProof({...proof,exitCode:1},hashes,current));
  assert.throws(()=>validateOpt10GenerationProof({...proof,resources:{...proof.resources,stopped:'memory'}},hashes,current));
  assert.throws(()=>validateOpt10GenerationProof(proof,{...hashes,'src/opt10_generate.rs':'b'.repeat(64)},current));
  assert.throws(()=>validateOpt10GenerationProof(proof,hashes,{...current,swapouts:1}));
  assert.throws(()=>validateOpt10GenerationProof(proof,hashes,{...current,boot:'rebooted'}));
});

test('Opt10 header rejects renamed tables, incomplete data and a different auxiliary snapshot', () => {
  const bytes=31_130_911_744, header=Buffer.alloc(1024), snapshot='a'.repeat(64);
  header.write('CBRT-OPT10-PDB\0\0');
  for(const [offset,value] of [[16,1],[20,1024],[24,10],[28,1]])header.writeUInt32LE(value,offset);
  for(const [offset,value] of [[32,31_130_910_720*4],[40,3393*70*495*1024],[48,31_130_910_720],[64,818008]])header.writeBigUInt64LE(BigInt(value),offset);
  header[56]=10;header[57]=13;header[58]=12;header[59]=1;
  Buffer.from(snapshot,'hex').copy(header,72); header.writeBigUInt64LE(BigInt(3393*70*495*1024),160+13*8);
  const seal=(buffer:Buffer)=>createHash('sha256').update(buffer.subarray(0,992)).digest().copy(buffer,992);
  seal(header); assert.equal(validateOpt10Metadata(bytes,header,snapshot),bytes);
  for(const size of [bytes-1,bytes+1,60_670_567_784])assert.throws(()=>validateOpt10Metadata(size,header,snapshot));
  assert.throws(()=>validateOpt10Metadata(bytes,header.subarray(1),snapshot));
  assert.throws(()=>validateOpt10Metadata(bytes,header,'b'.repeat(64)));
  for(const offset of [0,16,20,24,28,32,40,48,56,57,59,60,64,72,136,264,272,288]) {
    const invalid=Buffer.from(header);invalid[offset]^=1;seal(invalid);assert.throws(()=>validateOpt10Metadata(bytes,invalid,snapshot),`offset ${offset}`);
  }
  const incomplete=Buffer.from(header);incomplete[58]=11;seal(incomplete);assert.throws(()=>validateOpt10Metadata(bytes,incomplete,snapshot));
});
test('only explicit H9 generation is authorized with its full memory budget', () => {
  const root=resolve(here,'../../..'), generator=resolve(root,'solver/target/release/table_generator');
  const env={CUBEOPT_BACKEND:'h9gen',CUBE_TABLE_DIR:resolve(root,'solver/tables'),RAYON_NUM_THREADS:'16'};
  const p=researchPolicy('h9-generate',generator,['--only','h48-h9'],env);
  assert.equal(p.tableBytes,15_169_187_432);
  assert.equal(p.rssLimit,15_169_187_432+2*2**30);
  for(const h of ['h48-h7','h48-h10','h48-h11','all']) assert.throws(()=>researchPolicy('h9-generate',generator,['--only',h],env));
  assert.throws(()=>researchPolicy('h9-generate',generator,['--only','h48-h9'],{...env,CUBEOPT_H:'11'}));
});
test('dedicated ZBLL build keeps H10 budget and bounded batch runtime', () => {
  const binary = resolve(here, 'target/zbll/release/cube48opt-research');
  const policy = researchPolicy('double-zbll-batch', binary, ['solve-h10', 'table', '8', '20', '0'], { CUBEOPT_BACKEND: 'h10', CUBEOPT_SOLVE_THREADS: '1' });
  assert.equal(policy.tableBytes, 30_336_314_216);
  assert.equal(policy.deadlineMs, 7_200_000);
  for (const threads of ['0', '-1', '1.5', '999']) assert.throws(() => researchPolicy('double-zbll-batch', binary, ['solve-h10', 'table'], { CUBEOPT_BACKEND: 'h10', CUBEOPT_SOLVE_THREADS: threads }));
});
const sizes = [31_683_944, 61_307_240, 120_553_832, 239_047_016, 476_033_384,
  950_006_120, 1_897_951_528, 3_793_842_344, 7_585_624_040, 15_169_187_432, 30_336_314_216];
const environment = (h: number): NodeJS.ProcessEnv => ({ CUBEOPT_BACKEND: 'h48', CUBEOPT_H: String(h) });
test('native H48 benchmarks have a bounded hour with unchanged memory limits', () => {
  const args = ['solve-h48', '7', 'table', '8', '20', '0'];
  const normal = researchPolicy('wca100', native, args, environment(7));
  const benchmark = researchPolicy('wca100', native, args, {...environment(7), CUBEOPT_BENCHMARK:'1'});
  assert.equal(normal.deadlineMs, 600_000);
  assert.equal(benchmark.deadlineMs, 3_600_000);
  assert.equal(benchmark.rssLimit, normal.rssLimit);
  assert.throws(()=>researchPolicy('wca100',native,['query-h48','7','table'],{...environment(7),CUBEOPT_BENCHMARK:'1'}));
  assert.throws(()=>researchPolicy('wca100',native,['solve-h48','11','table'],{...environment(11),CUBEOPT_BENCHMARK:'1'}));
});
function mainHeader(h: number) {
  const header = Buffer.alloc(512);
  const mainBytes = sizes[h] - 2_060_648;
  header.writeBigUInt64LE(512n, 176);
  header.writeBigUInt64LE(BigInt(mainBytes + 512), 184);
  header.writeBigUInt64LE(BigInt(3393 * 34650 * 2 ** h + 2 * (mainBytes / 64)), 200);
  header.writeBigUInt64LE(BigInt(mainBytes + 512), 216);
  header.write(`h48 solver h =${String(h).padStart(2, ' ')}`, 224);
  header[324] = h;
  header[325] = 2;
  header[326] = h < 4 ? 8 : h < 8 ? 9 : 10;
  header[327] = 3;
  return header;
}

test('H0–H10 use exact padded file sizes and one-table RSS budgets', () => {
  for (let h = 0; h <= 10; h++) {
    assert.equal(h48FileBytes(h), sizes[h]);
    for (const mode of ['solve-h48', 'query-h48']) {
      const p = researchPolicy('protocol-only', native, [mode, String(h), 'not-opened.dat'], environment(h));
      assert.equal(p.h, h);
      assert.equal(p.tableBytes, sizes[h]);
      assert.equal(p.rssLimit, sizes[h] + 768 * 2 ** 20);
      assert.equal(p.deadlineMs, 600_000);
      assert.equal(validateH48Metadata(h, sizes[h], mainHeader(h)), sizes[h]);
    }
  }
});

test('renamed, truncated, oversized, wrong-H and wrong-format tables are rejected from metadata', () => {
  const header = mainHeader(7);
  for (const bytes of [0, sizes[7] - 1, sizes[7] + 1, 60_670_567_784])
    assert.throws(() => validateH48Metadata(7, bytes, header));
  assert.throws(() => validateH48Metadata(7, sizes[7], header.subarray(1)));
  for (const offset of [176, 184, 200, 216, 224, 324, 325, 326, 327]) {
    const invalid = Buffer.from(header);
    invalid[offset] ^= 1;
    assert.throws(() => validateH48Metadata(7, sizes[7], invalid), `offset ${offset}`);
  }
  const disguisedH11 = Buffer.from(header);
  disguisedH11[324] = 11;
  assert.throws(() => validateH48Metadata(7, sizes[7], disguisedH11));
});

test('backend, H, entry, arity and option mismatches cannot reach a child', () => {
  for (const [args, env] of [
    [['solve-h48', '7', 'renamed.dat'], {}],
    [['solve-h48', '7', 'renamed.dat'], { CUBEOPT_BACKEND: 'h48' }],
    [['solve-h48', '7', 'renamed.dat'], environment(6)],
    [['solve-h48', '07', 'renamed.dat'], environment(7)],
    [['solve-h48', '11', 'renamed.dat'], environment(10)],
    [['query-h48', '0', 'renamed.dat'], environment(11)],
    [['solve-h11', 'renamed.dat'], { CUBEOPT_BACKEND: 'h10' }],
    [['solve-h48', '7'], environment(7)],
    [['query-h48', '7', 'renamed.dat', '8'], environment(7)],
    [['solve-h48', '7', 'renamed.dat', '9'], environment(7)],
    [['solve-h48', '7', 'renamed.dat', '2'], environment(7)],
    [['solve-h48', '7', 'renamed.dat', '0'], environment(7)],
    [['solve-h48', '7', 'renamed.dat', '8', '21'], environment(7)],
    [['solve-h48', '7', 'renamed.dat', '8', '20', '-1'], environment(7)],
    [['solve-h10', 'renamed.dat'], environment(7)],
    [['solve', 'small', 'table'], { CUBEOPT_BACKEND: 'opt', CUBEOPT_H: '7' }],
  ] as [string[], NodeJS.ProcessEnv][])
    assert.throws(() => researchPolicy('protocol-only', native, args, env), JSON.stringify({ args, env }));
  assert.throws(() => researchPolicy('protocol-only', native + '-alias', ['solve-h48', '7', 'table'], environment(7)));
  assert.throws(() => researchPolicy('protocol-only', process.execPath, ['/tmp/guard.mts', native], environment(7)));
  assert.throws(() => h48FileBytes(11));
});

test('existing Opt and H10 budgets and entry separation remain intact', () => {
  assert.equal(researchPolicy('opt1', native, ['solve', 'small', 'table'], {}).tableBytes, 30_401_280);
  assert.equal(researchPolicy('opt9', native, ['solve', 'small', 'table'], { CUBEOPT_VARIANT: '9' }).tableBytes, 15_565_455_360);
  assert.equal(researchPolicy('h10', native, ['solve-h10', 'table'], { CUBEOPT_BACKEND: 'h10' }).tableBytes, sizes[10]);
  const small = researchPolicy('small', process.execPath, [resolve(here, 'verify-h10.mjs')], { CUBEOPT_BACKEND: 'h10' });
  assert.equal(small.rssLimit, 512 * 2 ** 20);
  const sequential = researchPolicy('opt9', process.execPath, [resolve(here, 'benchmark.mjs'), 'native', 'small', 'table', 'out', '--sequential'], { CUBEOPT_VARIANT: '9' });
  assert.equal(sequential.rssLimit, 15_565_455_360 + 2 ** 30);
});

test('actual guard rejects H11 before any table or memory access, without spawning native', () => {
  const env = { ...process.env, CUBEOPT_BACKEND: 'h48', CUBEOPT_H: '11' };
  const result = spawnSync(process.execPath, [resolve(here, 'guard.mts'), 'must-not-run', native,
    'solve-h48', '11', '/does-not-exist/renamed-table.dat'],
  { env, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /H11 execution is prohibited/);
  assert.doesNotMatch(result.stderr, /ENOENT|memory observation|Insufficient memory/);
});
