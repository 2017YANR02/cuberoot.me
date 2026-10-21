// Pure policy / 512-byte synthetic-header tests. Never open a PDB or spawn a solver.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import test from 'node:test';
import { consumeResourceReview, deliverOpt10Input, h48FileBytes, opt10ReviewScope, opt10ReviewSources, productionResourceReviewScope, researchPolicy, resourceProtectionReasons, resourceReviewCommandSha256, resourceReviewScope, validateH48Metadata, validateOpt10GenerationProof, validateOpt10Metadata, validateOpt10ResourceReview, validateResourceReview, validateSuccessfulPredecessor } from './guard.mts';
import { blockedCompute } from '../../../.codex/hooks/block-unprotected-memory-compute.mts';
import { parsePrintedSolution, parseWasmBenchmarkArguments, readWca100 } from './wasm-benchmark.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const native = resolve(here, 'target/release/cube48opt-research');
test('plain artifact upload and metadata probes do not authorize computation', () => {
  assert.equal(blockedCompute(`scp ${native} cuberoot:/tmp/cube48opt-native`), undefined);
  assert.equal(blockedCompute(`${native} --server-info`), undefined);
  assert.equal(blockedCompute('/tmp/cube48opt-native --server-info'), undefined);
  assert.ok(blockedCompute('/tmp/cube48opt-native solve small table'));
  assert.ok(blockedCompute(`${native} solve small table`));
  assert.ok(blockedCompute(`scp ${native} cuberoot:/tmp/native; ${native} solve small table`));
  assert.ok(blockedCompute(`scp $(${native} solve small table) cuberoot:/tmp/native`));
  assert.ok(blockedCompute(`scp -S ${native} local cuberoot:/tmp/native`));
});
test('dedicated 18-thread reviews route only existing-table commands with one shared native table', () => {
  const root=resolve(here,'../../..'), executable=resolve(here,'target/multithread/release/cube48opt-research');
  const env={CUBEOPT_MULTITHREAD_REVIEW:resolve(root,'.tmp/cubeopt-reverse/mt18-review/launch.json'),
    CUBEOPT_BACKEND:'h48',CUBEOPT_H:'10',CUBEOPT_SEARCH_THREADS:'18',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_MEASURE_RSS:'1'};
  const args=['solve-h48','10',resolve(root,'solver/tables/h48-nissy-core/h48h10.dat'),'8','20','0'];
  const p=researchPolicy('wca100-mt18-h10',executable,args,env);
  assert.equal(p.entry,'native');assert.equal(p.searchThreads,18);assert.equal(p.tableBytes,30_336_314_216);
  assert.equal(p.rssLimit,30_336_314_216+2**30+18*16*2**20);
  assert.throws(()=>researchPolicy('wca100-mt18-h10',executable,args,{...env,CUBEOPT_MULTITHREAD_REVIEW:undefined}));
  assert.throws(()=>researchPolicy('wca100-mt18-h10',executable,args,{...env,CUBEOPT_SOLVE_THREADS:'18'}));
});
test('one reviewed comparison binds stopped bytes, exact command, current resources and unused history', () => {
  const hash = (bytes:Buffer) => createHash('sha256').update(bytes).digest('hex');
  const encode = (value:unknown) => Buffer.from(JSON.stringify(value));
  const prior={boot:'same-boot',swapouts:0,pressure:1,available:40*2**30,stopped:'old pressure'};
  const baseline=encode(prior), resources=encode({...prior,sampledAt:'2026-10-13T15:18:34.304Z'});
  const request={label:'opt9-reviewed',executable:process.execPath,
    args:[resolve(here,'wasm-benchmark.mjs'),'--variant','9','--engine','both','--table','table','--small','small','--wasm','wasm','--out','new-out'],
    env:{CUBEOPT_BACKEND:'opt',CUBEOPT_VARIANT:'9'}};
  const current={boot:prior.boot,swapouts:0,pressure:1,available:40*2**30};
  const review={schema:'cuberoot.resource-review.v1',scope:resourceReviewScope,reason:'User-authorized lower-memory comparison after resource audit',
    reviewedAt:'2026-10-13T16:00:00.000Z',baselineSha256:hash(baseline),stoppedLabel:'old-opt10',stoppedResourcesSha256:hash(resources),
    nextLabel:request.label,commandSha256:resourceReviewCommandSha256(request.executable,request.args),boot:prior.boot,swapouts:0};
  assert.deepEqual(validateResourceReview(review,baseline,resources,request,current),{baselineSha256:hash(baseline),commandSha256:review.commandSha256});
  for(const field of ['scope','baselineSha256','stoppedResourcesSha256','nextLabel','commandSha256','boot','schema'])
    assert.throws(()=>validateResourceReview({...review,[field]:'wrong'},baseline,resources,request,current),field);
  assert.throws(()=>validateResourceReview(review,Buffer.concat([baseline,Buffer.from('\n')]),resources,request,current));
  assert.throws(()=>validateResourceReview(review,baseline,Buffer.concat([resources,Buffer.from('\n')]),request,current));
  for(const changed of [{...request,label:'other'},{...request,args:[...request.args,'--repeat','3']},
    {...request,args:request.args.map(x=>x==='both'?'rust':x)},
    {...request,args:request.args.map(x=>x==='9'?'8':x),env:{...request.env,CUBEOPT_VARIANT:'8'}},
    {...request,executable:native,args:['solve-h48','11','table'],env:{CUBEOPT_BACKEND:'h48',CUBEOPT_H:'11'}},
    {...request,executable:resolve(here,'target/opt10/release/cube48opt-research'),args:['generate-opt10','small','table','16'],env:{CUBEOPT_BACKEND:'opt10'}}])
    assert.throws(()=>validateResourceReview(review,baseline,resources,changed,current));
  for(const changed of [{...current,swapouts:1},{...current,boot:'other'},{...current,pressure:2},{...current,available:2**30}])
    assert.throws(()=>validateResourceReview(review,baseline,resources,request,changed));
  assert.throws(()=>validateResourceReview(review,baseline,resources,request,current,true,false));
  assert.throws(()=>validateResourceReview(review,baseline,resources,request,current,false,true));
  const noStop=encode({...prior,stopped:''});
  assert.throws(()=>validateResourceReview({...review,baselineSha256:hash(noStop)},noStop,resources,request,current));
  assert.equal(baseline.toString(),JSON.stringify(prior));
});

test('review receipt is consumed exclusively and retains the first record', () => {
  const directory=mkdtempSync(resolve(tmpdir(),'cubeopt-review-policy-'));
  try {
    const path=resolve(directory,'stopped-hash.json');
    consumeResourceReview(path,{label:'once'});
    const bytes=readFileSync(path);
    assert.throws(()=>consumeResourceReview(path,{label:'again'}),/EEXIST/);
    assert.equal(existsSync(path),true); assert.deepEqual(readFileSync(path),bytes);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});

test('production Opt8 four-thread review retains the stopped baseline and cannot authorize another mode', () => {
  const encode=(x:unknown)=>Buffer.from(JSON.stringify(x));
  const hash=(x:Buffer)=>createHash('sha256').update(x).digest('hex');
  const prior={boot:'same-boot',swapouts:0,stopped:'Opt10 resource stop'};
  const baseline=encode(prior), resources=encode(prior);
  const request={label:'production-opt8-four',executable:process.execPath,
    args:[resolve(here,'wasm-benchmark.mjs'),'--variant','8','--threads','4','--engine','both','--table','table','--small','small','--wasm','wasm','--out','new-out'],
    env:{CUBEOPT_BACKEND:'opt',CUBEOPT_VARIANT:'8'}};
  const review={schema:'cuberoot.resource-review.v1',scope:productionResourceReviewScope,
    reason:'Fresh resource review for explicitly requested production replacement; original stop retained',
    reviewedAt:'2026-10-14T02:00:00Z',baselineSha256:hash(baseline),stoppedLabel:'opt10-old',stoppedResourcesSha256:hash(resources),
    nextLabel:request.label,commandSha256:resourceReviewCommandSha256(request.executable,request.args),boot:prior.boot,swapouts:0};
  const current={boot:prior.boot,swapouts:0,pressure:1,available:40*2**30};
  assert.equal(validateResourceReview(review,baseline,resources,request,current).baselineSha256,hash(baseline));
  for(const changed of [{...current,swapouts:1},{...current,boot:'new-boot'},{...current,available:2**30}])
    assert.throws(()=>validateResourceReview(review,baseline,resources,request,changed));
  assert.throws(()=>validateResourceReview(review,baseline,resources,{...request,args:request.args.map(x=>x==='4'?'1':x)},current));
  assert.throws(()=>validateResourceReview({...review,scope:resourceReviewScope},baseline,resources,request,current));
  assert.throws(()=>validateResourceReview(review,baseline,resources,request,current,true));
});

test('native search parallelism shares a bounded budget and cannot multiply batch workers', () => {
  const args=['solve-h48','7','table','8','20','0'];
  const env={CUBEOPT_BACKEND:'h48',CUBEOPT_H:'7'};
  const single=researchPolicy('h7',native,args,env);
  const parallel=researchPolicy('h7',native,args,{...env,CUBEOPT_SEARCH_THREADS:'4'});
  assert.equal(parallel.rssLimit,single.rssLimit+3*16*2**20);
  assert.throws(()=>researchPolicy('h7',native,args,{...env,CUBEOPT_SEARCH_THREADS:'4',CUBEOPT_SOLVE_THREADS:'2'}));
  for(const count of ['0','17','1.5','bad'])
    assert.throws(()=>researchPolicy('h7',native,args,{...env,CUBEOPT_SEARCH_THREADS:count}));
});

test('a failed fixed-input pipe follows the stop path instead of an unhandled stream error', async () => {
  const reason=await new Promise<string>(resolve=>{
    const input=new Writable({write(_chunk,_encoding,callback){callback(new Error('EPIPE fixture'));}});
    deliverOpt10Input(input,Buffer.from('one fixed input'),resolve);
  });
  assert.match(reason,/Opt10 fixed input pipe failed:.*EPIPE fixture/);
});

test('a successor requires a successful exact predecessor and a never-measured WASM', () => {
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value));
  const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
  const args=[resolve(here,'wasm-benchmark.mjs'),'--variant','9','--engine','both','--table','table','--small','small','--wasm','old.wasm','--out','old-out'];
  const env={CUBEOPT_BACKEND:'opt',CUBEOPT_VARIANT:'9'};
  const oldPolicy=researchPolicy('old-run',process.execPath,args,env);
  const receipt={schema:'cuberoot.resource-review-consumption.v1',baselineSha256:'a'.repeat(64),stoppedLabel:'old-opt10',
    stoppedResourcesSha256:'b'.repeat(64),label:'old-run',executable:process.execPath,args,
    commandSha256:resourceReviewCommandSha256(process.execPath,args),before:{boot:'same',swapouts:0}};
  const resources={...oldPolicy,reviewReceipt:receipt,boot:'same',swapouts:0,pressure:1,stopped:'',trigger:null,
    peakRss:16*2**30,minimumHeadroom:4*2**30,sampledAt:'2026-10-13T17:02:54.639Z'};
  const engine=(name:string)=>({engine:name,cases:100,verifiedSolutions:100,optimalLengthsMatched:100,processExited:true,
    threads:1,warmupCases:0,measuredPasses:1,tableSha256:'c'.repeat(64),totalSeconds:80,
    artifacts:{sha256:{wasm:(name==='rust'?'d':'e').repeat(64)}}});
  const report={schema:'cuberoot.rust-opt-wasm-benchmark-report.v1',variant:9,
    corpusSha256:'92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde',cases:100,
    threads:1,measuredPasses:1,warmupCases:0,tableSha256:'c'.repeat(64),engines:{rust:engine('rust'),original:engine('original')}};
  const exit={exitCode:0,recordedAt:'2026-10-13T17:03:12.652Z'};
  const evidence={receipt:encode(receipt),resources:encode(resources),report:encode(report),exit:encode(exit),
    previousWasmSha256:'d'.repeat(64),candidateWasmSha256:'f'.repeat(64)};
  const review={schema:'cuberoot.resource-review.v2',baselineSha256:receipt.baselineSha256,stoppedLabel:receipt.stoppedLabel,
    stoppedResourcesSha256:receipt.stoppedResourcesSha256,boot:'same',swapouts:0,previousReceipt:receipt.baselineSha256+'.json',
    previousReceiptSha256:hash(evidence.receipt),previousResourcesSha256:hash(evidence.resources),previousReportSha256:hash(evidence.report),
    previousGuardExitSha256:hash(evidence.exit),candidateWasmSha256:evidence.candidateWasmSha256};
  const request={label:'new-run',executable:process.execPath,args:args.map(x=>x==='old.wasm'?'new.wasm':x==='old-out'?'new-out':x),env};
  assert.deepEqual(validateSuccessfulPredecessor(review,evidence,request).candidateHistorySha256,['d'.repeat(64),'f'.repeat(64)]);
  for(const field of ['previousReceipt','previousReceiptSha256','previousResourcesSha256','previousReportSha256','previousGuardExitSha256','candidateWasmSha256'])
    assert.throws(()=>validateSuccessfulPredecessor({...review,[field]:'wrong'},evidence,request),field);
  for(const bad of [{...exit,exitCode:1},{...exit,recordedAt:'2026-10-13T17:00:00.000Z'}]) {
    const bytes=encode(bad);assert.throws(()=>validateSuccessfulPredecessor({...review,previousGuardExitSha256:hash(bytes)},{...evidence,exit:bytes},request));
  }
  for(const bad of [{...resources,stopped:'memory'},{...resources,trigger:{reason:'pressure'}},{...resources,swapouts:1},
    {...resources,pressure:2},{...resources,peakRss:oldPolicy.rssLimit+1},{...resources,minimumHeadroom:1},
    {...resources,reviewReceipt:{...receipt,label:'other'}}]) {
    const bytes=encode(bad);assert.throws(()=>validateSuccessfulPredecessor({...review,previousResourcesSha256:hash(bytes)},{...evidence,resources:bytes},request));
  }
  for(const bad of [{...report,cases:99},{...report,warmupCases:100},{...report,measuredPasses:3},
    {...report,engines:{rust:report.engines.rust}},{...report,engines:{...report.engines,original:{...report.engines.original,optimalLengthsMatched:99}}}]) {
    const bytes=encode(bad);assert.throws(()=>validateSuccessfulPredecessor({...review,previousReportSha256:hash(bytes)},{...evidence,report:bytes},request));
  }
  assert.throws(()=>validateSuccessfulPredecessor({...review,candidateWasmSha256:evidence.previousWasmSha256},
    {...evidence,candidateWasmSha256:evidence.previousWasmSha256},request));
  assert.throws(()=>validateSuccessfulPredecessor(review,{...evidence,previousWasmSha256:'0'.repeat(64)},request));
  assert.throws(()=>validateSuccessfulPredecessor(review,evidence,{...request,args}));
  // A later successor cannot drop its recorded history or go back to V1.
  const linked={...receipt,previousReceiptSha256:'1'.repeat(64),candidateWasmSha256:'d'.repeat(64),
    candidateHistorySha256:['2'.repeat(64),'d'.repeat(64)]};
  const linkedBytes=encode(linked), linkedResources=encode({...resources,reviewReceipt:linked});
  const linkedReview={...review,previousReceipt:`${receipt.baselineSha256}-${linked.previousReceiptSha256}.json`,
    previousReceiptSha256:hash(linkedBytes),previousResourcesSha256:hash(linkedResources),candidateWasmSha256:'2'.repeat(64)};
  assert.throws(()=>validateSuccessfulPredecessor(linkedReview,{...evidence,receipt:linkedBytes,resources:linkedResources,candidateWasmSha256:'2'.repeat(64)},request));
});

test('resource protection records each exact failing observation', () => {
  const before={boot:'same',swapouts:0,pressure:1,available:10*2**30};
  assert.deepEqual(resourceProtectionReasons(before,before,1,2,3*2**30),[]);
  assert.deepEqual(resourceProtectionReasons(before,{...before,pressure:2},1,2,3*2**30),['memory pressure 2']);
  assert.deepEqual(resourceProtectionReasons(before,{...before,boot:'other',swapouts:1,pressure:4},3,2,1),
    ['boot changed','Swapouts changed','memory pressure 4','RSS 3 > 2',`headroom 1 < ${2*2**30}`]);
});

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
  const table=resolve(root,'.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat');
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

function opt10ChainFixture() {
  const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)), hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
  const root=resolve(here,'../../..'),small=resolve(root,'.tmp/cubeopt-reverse/opt9-generated/small-memory.bin');
  const table=resolve(root,'.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat');
  const binary=resolve(here,'target/opt10/release/cube48opt-research');
  const sources=Object.fromEntries(opt10ReviewSources.map(name=>[name,'a'.repeat(64)]));
  const current={boot:'original-boot',swapouts:0,pressure:1,available:45*2**30};
  const baseline=encode({...current,stopped:'original pressure'});
  const failed=encode({...current,stopped:'original pressure',backend:'opt10',mode:'generate-opt10',tableBytes:31_130_911_744});
  const make=(stage:string,label:string,executable:string,args:string[],env:NodeJS.ProcessEnv,previous?:any,proof?:any,metadata?:any)=>{
    const request={label,executable,args,env};
    const evidence:any={baseline,stoppedResources:failed,executableSha256:'b'.repeat(64),sourceSha256:sources,snapshotSha256:'6'.repeat(64),
      ...(previous?{previous:{receipt:encode(previous.receipt),resources:encode(previous.resources),exit:encode(previous.exit)}}:{}),
      ...(proof?{proof:encode(proof)}:{}),...(metadata?{metadata:encode(metadata),headerSha256:'c'.repeat(64),payloadSha256:'d'.repeat(64),headerSnapshotSha256:'6'.repeat(64),
        inputSha256:'e'.repeat(64),corpusSha256:'92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde'}:{})};
    const review:any={schema:'cuberoot.opt10.resource-review.v1',scope:opt10ReviewScope,stage,reason:'User authorized finish and test Opt10',
      reviewedAt:'2026-10-13T18:00:00.000Z',baselineSha256:hash(baseline),stoppedLabel:'opt10-generate-v1',
      stoppedResourcesSha256:hash(failed),nextLabel:label,commandSha256:resourceReviewCommandSha256(executable,args),
      boot:current.boot,swapouts:0,executableSha256:evidence.executableSha256,sourceSha256:sources,snapshotSha256:evidence.snapshotSha256,
      ...(previous?{previous:{receiptSha256:hash(evidence.previous.receipt),resourcesSha256:hash(evidence.previous.resources),exitSha256:hash(evidence.previous.exit)}}:{}),
      ...(proof?{proofSha256:hash(evidence.proof)}:{}),...(metadata?{metadataSha256:hash(evidence.metadata),inputSha256:evidence.inputSha256,
        corpusSha256:evidence.corpusSha256,cases:100,measuredPasses:1,warmupCases:0,threads:1}:{})};
    const identity=validateOpt10ResourceReview(review,evidence,request,current);
    const receipt={schema:'cuberoot.opt10.resource-review-consumption.v1',scope:opt10ReviewScope,...identity,
      label,executable,args,before:current,reviewPath:'/fixture/review.json',reviewSha256:hash(encode(review))};
    const policy=researchPolicy(label,executable,args,env);
    const resources={...policy,...current,stopped:'',trigger:null,peakRss:policy.rssLimit-1,minimumHeadroom:4*2**30,
      opt10ReviewReceipt:receipt,sampledAt:'2026-10-13T18:01:00.000Z'};
    return {request,evidence,review,receipt,resources,exit:{exitCode:0,signal:null,finishedAt:'2026-10-13T18:01:01.000Z'}};
  };
  const verify=make('verify-opt1','verify-opt10-v2',resolve(here,'target/release/examples/verify_opt10_generation'),
    ['--verify-opt1',small,resolve(root,'.tmp/cubeopt-reverse/opt1-generated/h48prun01.dat'),'16'],{CUBEOPT_BACKEND:'opt10-verify',CUBEOPT_VARIANT:'1'});
  const proof={schema:'cuberoot.opt10.generation-proof.v1',exitCode:0,sourceSha256:sources,resources:verify.resources,
    result:{schema:'cuberoot.opt10.opt1-generation-validation.v1',sharedGenerator:true,projectionEoBits:0,base:7,completedDepth:9,threads:16,
      comparedValidCells:117_567_450,differences:0,allEqual:true,tableWritten:false,distribution:[117_567_450,0,0,0,0,0,0,0,0,0,0]}};
  const generate=make('generate-opt10','opt10-generate-v2',binary,['generate-opt10',small,table,'16'],{CUBEOPT_BACKEND:'opt10'},verify,proof);
  const metadata={schema:'cuberoot.opt10.generation-metadata.v1',binary:{path:binary,sha256:'b'.repeat(64)},
    table:{path:table,bytes:31_130_911_744,headerSha256:'c'.repeat(64),payloadSha256:'d'.repeat(64)},sourceSha256:sources,
    generation:{exitCode:0,completedDepth:12,resources:generate.resources}};
  const solve=make('solve-opt10','wca100-opt10-v2',binary,['solve-opt10',small,table,'8','20','0'],
    {CUBEOPT_BACKEND:'opt10',CUBEOPT_MEASURE_RSS:'1'},generate,proof,metadata);
  return {verify,generate,solve,current,encode,hash,proof,metadata};
}

test('Opt10 review binds the original stop, exact binary/sources and each single-use stage', () => {
  const {verify,generate,solve,current}=opt10ChainFixture();
  for(const run of [verify,generate,solve]) {
    const {review,evidence,request}=run;
    assert.equal(validateOpt10ResourceReview(review,evidence,request,current).stage,review.stage);
    for(const field of ['schema','scope','stage','stoppedLabel','baselineSha256','stoppedResourcesSha256','nextLabel','commandSha256','executableSha256','snapshotSha256','boot'])
      assert.throws(()=>validateOpt10ResourceReview({...review,[field]:'bad'},evidence,request,current),field);
    assert.throws(()=>validateOpt10ResourceReview(review,{...evidence,executableSha256:'f'.repeat(64)},request,current));
    assert.throws(()=>validateOpt10ResourceReview(review,{...evidence,sourceSha256:{...evidence.sourceSha256,'src/main.rs':'f'.repeat(64)}},request,current));
    assert.throws(()=>validateOpt10ResourceReview(review,evidence,request,current,true));
    assert.throws(()=>validateOpt10ResourceReview(review,evidence,request,current,false,true));
    for(const change of [{swapouts:1},{boot:'other'},{pressure:2},{available:1}])
      assert.throws(()=>validateOpt10ResourceReview(review,evidence,request,{...current,...change}));
  }
  assert.throws(()=>validateOpt10ResourceReview({...verify.review,previous:{}},verify.evidence,verify.request,current));
  assert.throws(()=>validateOpt10ResourceReview(generate.review,{...generate.evidence,previous:undefined},generate.request,current));
  assert.throws(()=>validateOpt10ResourceReview(solve.review,{...solve.evidence,previous:generate.evidence.previous},solve.request,current));
  const oldTable=solve.request.args.map(x=>x.replace('opt10-generated-v2/','opt10-generated/'));
  assert.throws(()=>researchPolicy(solve.request.label,solve.request.executable,oldTable,solve.request.env));
  for(const run of [verify,generate,solve]) {
    assert.throws(()=>researchPolicy(run.request.label,run.request.executable.replace(resolve(here,'../../..')+'/',''),run.request.args,run.request.env));
    const relative=run.request.args.map((x,i)=>i===1?x.replace(resolve(here,'../../..')+'/',''):x);
    assert.throws(()=>researchPolicy(run.request.label,run.request.executable,relative,run.request.env));
  }
});

test('Opt10 predecessor failures, stale proofs and incomplete generated metadata cannot advance', () => {
  const {generate,solve,current,encode,hash}=opt10ChainFixture();
  for(const run of [generate,solve]) {
    for(const part of ['receipt','resources','exit']) {
      const value=JSON.parse(run.evidence.previous[part]);
      for(const change of part==='exit'?[{exitCode:1},{signal:'SIGTERM'},{finishedAt:'2026-10-13T17:00:00Z'}]:
        part==='resources'?[{stopped:'pressure'},{trigger:{reason:'x'}},{swapouts:1},{peakRss:99*2**30},{minimumHeadroom:1}]:
        [{stage:run.review.stage},{baselineSha256:'f'.repeat(64)},{sourceSha256:{...value.sourceSha256,'src/coord.rs':'f'.repeat(64)}}]) {
        const bytes=encode({...value,...change});
        const review={...run.review,previous:{...run.review.previous,[part+'Sha256']:hash(bytes)}};
        const evidence={...run.evidence,previous:{...run.evidence.previous,[part]:bytes}};
        assert.throws(()=>validateOpt10ResourceReview(review,evidence,run.request,current),JSON.stringify({part,change}));
      }
    }
    assert.throws(()=>validateOpt10ResourceReview({...run.review,proofSha256:'f'.repeat(64)},run.evidence,run.request,current));
  }
  const proof=JSON.parse(generate.evidence.proof);proof.result.differences=1;const badProof=encode(proof);
  assert.throws(()=>validateOpt10ResourceReview({...generate.review,proofSha256:hash(badProof)},{...generate.evidence,proof:badProof},generate.request,current));
  for(const change of [{generation:{exitCode:1}},{table:{path:'old'}},{binary:{path:solve.request.executable,sha256:'f'.repeat(64)}}]) {
    const bytes=encode({...JSON.parse(solve.evidence.metadata),...change});
    assert.throws(()=>validateOpt10ResourceReview({...solve.review,metadataSha256:hash(bytes)},{...solve.evidence,metadata:bytes},solve.request,current));
  }
  for(const field of ['inputSha256','corpusSha256','metadataSha256'])
    assert.throws(()=>validateOpt10ResourceReview({...solve.review,[field]:'f'.repeat(64)},solve.evidence,solve.request,current));
  for(const change of [{cases:99},{measuredPasses:3},{warmupCases:100},{threads:2}])
    assert.throws(()=>validateOpt10ResourceReview({...solve.review,...change},solve.evidence,solve.request,current));
  assert.throws(()=>validateOpt10ResourceReview(solve.review,solve.evidence,{...solve.request,env:{CUBEOPT_BACKEND:'opt10'}},current));
  assert.throws(()=>validateOpt10ResourceReview(solve.review,{...solve.evidence,headerSnapshotSha256:'f'.repeat(64)},solve.request,current));
  assert.throws(()=>validateOpt10ResourceReview({...generate.review,snapshotSha256:'f'.repeat(64)},
    {...generate.evidence,snapshotSha256:'f'.repeat(64)},generate.request,current));
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
