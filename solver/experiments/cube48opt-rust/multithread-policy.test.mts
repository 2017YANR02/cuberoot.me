// Pure request/evidence fixtures: no PDB, process spawning or memory observation.
import assert from 'node:assert/strict';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { multithreadBaselineSha256, multithreadStoppedSha256, multithreadPriorHashes,
  multithreadPaths, multithreadSources, multithreadPolicy, validateMultithreadReview, validateWasmRepairReview,
  opt9ExperimentConfig, opt9ExperimentScope, opt9ExperimentHashes, opt9ExperimentBuildSources, validateOpt9ExperimentContinuation, validateOpt9FixedReference,
  opt10ExperimentConfig, opt10ExperimentScope, opt10HotpathReferenceHashes, opt10CosetReferenceHashes, validateOpt10ExperimentContinuation } from './multithread-policy.mts';
import { validateOpt9ExperimentRows } from './run-opt9-experiment.mts';
import { opt10ExperimentRequest, opt10ExperimentReportMode } from './run-opt10-experiment.mts';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE,'../../..'), OUT = resolve(ROOT,'.tmp/cubeopt-reverse');
const GiB=2**30, sha='1'.repeat(64);
function native(kind='opt', tier=9) {
  const env:any={CUBEOPT_MULTITHREAD_REVIEW:resolve(OUT,'mt18-fixture/launch.json'),CUBEOPT_SOLVE_THREADS:'1',
    CUBEOPT_SEARCH_THREADS:'18',CUBEOPT_MEASURE_RSS:'1',CUBEOPT_BACKEND:kind};
  let args:string[];
  if(kind==='h48'){env.CUBEOPT_H=String(tier);args=['solve-h48',String(tier),resolve(ROOT,`solver/tables/h48-nissy-core/h48h${tier}.dat`),'8','20','0'];}
  else if(kind==='opt10')args=['solve-opt10',resolve(OUT,'opt9-generated/small-memory.bin'),resolve(OUT,'opt10-generated-v2/cuberoot-opt10.dat'),'8','20','0'];
  else {env.CUBEOPT_VARIANT=String(tier);args=['solve',resolve(OUT,`opt${tier}-generated/small-memory.bin`),resolve(OUT,`opt${tier}-generated/${tier===1?'h48prun01.dat':`h48prun31h${tier}.dat`}`),'8','20','0'];}
  return {label:'wca100-mt18-fixture',executable:multithreadPaths.native,args,env};
}
function wasm(tier=9) {
  const r=native('opt',tier); delete r.env.CUBEOPT_SEARCH_THREADS;delete r.env.CUBEOPT_MEASURE_RSS;
  return {...r,executable:process.execPath,args:[resolve(HERE,'wasm-benchmark.mjs'),'--variant',String(tier),'--threads','18','--engine','both',
    '--table',r.args[2],'--small',r.args[1],'--wasm',resolve(OUT,'build/cube48opt-rust8.wasm'),'--out',resolve(OUT,'mt18-fixture/result')]};
}
function fixture() {
  const request=native(),policy=multithreadPolicy(request,18);
  const now={boot:'unchanged-boot',swapouts:0,pressure:1,available:60*GiB};
  const predecessor={resourcesPath:multithreadPaths.priorResources,resourcesSha256:multithreadPriorHashes.resources,
    exitPath:multithreadPaths.priorExit,exitSha256:multithreadPriorHashes.exit,reportPath:multithreadPaths.priorReport,reportSha256:multithreadPriorHashes.report};
  const e:any={policy,baseline:{sha256:multithreadBaselineSha256,value:{...now,stopped:'old stop'}},
    stopped:{sha256:multithreadStoppedSha256,value:{stopped:'old stop'}},
    priorResources:{path:predecessor.resourcesPath,sha256:predecessor.resourcesSha256,value:{...now,stopped:'',trigger:null,minimumHeadroom:4*GiB,peakRss:31*GiB,rssLimit:32*GiB,opt10ReviewReceipt:{baselineSha256:multithreadBaselineSha256}}},
    priorExit:{path:predecessor.exitPath,sha256:predecessor.exitSha256,value:{exitCode:0,signal:null}},
    priorReport:{path:predecessor.reportPath,sha256:predecessor.reportSha256,value:{schema:'cuberoot.rust-opt10.wca100-report.v1',cases:100,independentlyVerifiedSolutions:100,optimalLengthsMatched:100,protection:{triggered:false}}},
    input:{path:multithreadPaths.input,sha256:sha,corpusSha256:sha},table:{path:policy.tablePath,bytes:policy.tableBytes},
    snapshot:{path:policy.snapshotPath,bytes:818008,sha256:sha},executableSha256:sha,
    sourceSha256:Object.fromEntries(multithreadSources.map(n=>[n,sha])),machine:{platform:'darwin',logicalCpus:18}};
  const review:any={schema:'cuberoot.multithread-wca100-review.v1',scope:'mac18-wca100-single',
    reason:'Explicit existing-table eighteen-thread request retaining previous stopped history',reviewedAt:'2026-10-14T00:00:00Z',
    label:request.label,executable:request.executable,args:request.args,backend:policy.backend,variant:policy.variant,h:policy.h,
    threads:18,batchThreads:1,cases:100,measuredPasses:1,warmupCases:0,baselineSha256:e.baseline.sha256,stoppedResourcesSha256:e.stopped.sha256,
    predecessor,boot:now.boot,swapouts:0,...Object.fromEntries(['input','table','snapshot','executableSha256','sourceSha256','machine'].map(k=>[k,e[k]]))};
  return {request,review,e,now};
}
test('only existing native Opt1..10/H7/H10 and WASM Opt1..9 with 18 workers are admitted',()=>{
  for(let v=1;v<=9;v++){const n=multithreadPolicy(native('opt',v),18),w=multithreadPolicy(wasm(v),18);
    assert.equal(n.searchThreads,18);assert.equal(w.wasmThreads,18);assert(w.rssLimit>n.rssLimit);}
  for(const r of [native('opt10'),native('h48',7),native('h48',10)])assert.equal(multithreadPolicy(r,18).searchThreads,18);
  for(const r of [native('h48',0),native('h48',9),native('h48',11),native('opt',10)])assert.throws(()=>multithreadPolicy(r,18));
});
test('wrong binaries, relative inputs, node limits, generation, parallel batch and mixed reviews are rejected',()=>{
  const base=native();
  for(const changed of [{executable:resolve(HERE,'target/release/cube48opt-research')},{args:base.args.map((v,i)=>i===1?'small-memory.bin':v)},
    {args:base.args.map((v,i)=>i===5?'1':v)},{args:['generate-opt10',...base.args.slice(1)]},
    ...[{CUBEOPT_SEARCH_THREADS:'16'},{CUBEOPT_SOLVE_THREADS:'18'},{CUBEOPT_RESOURCE_REVIEW:'/other'},{CUBEOPT_BACKEND:'nissy'},
      {CUBEOPT_MULTITHREAD_REVIEW:'relative'}].map(env=>({env:{...base.env,...env}}))]) assert.throws(()=>multithreadPolicy({...base,...changed},18));
  assert.throws(()=>multithreadPolicy(base,16));
  const w=wasm();assert.throws(()=>multithreadPolicy({...w,args:w.args.map(v=>v==='both'?'rust':v)},18));
  assert.throws(()=>multithreadPolicy({...w,args:w.args.map(v=>v==='18'?'1':v)},18));
});
test('successful v2 evidence permits exactly bound new execution without changing old baseline',()=>{
  const {request,review,e,now}=fixture(),before=structuredClone(e);
  const identity=validateMultithreadReview(review,e,request,now);
  assert.equal(identity.threads,18);assert.match(identity.commandSha256,/^[0-9a-f]{64}$/);assert.deepEqual(e,before);
});
test('altered protocol, input, artifact, source, table and predecessor fail closed',()=>{
  const {request,review,e,now}=fixture();
  for(const field of ['input','table','snapshot','executableSha256','sourceSha256','predecessor','machine'])
    assert.throws(()=>validateMultithreadReview({...review,[field]:'changed'},e,request,now));
  for(const field of ['threads','batchThreads','cases','measuredPasses','warmupCases'])
    assert.throws(()=>validateMultithreadReview({...review,[field]:99},e,request,now));
  assert.throws(()=>validateMultithreadReview(review,e,{...request,label:'wca100-mt18-another'},now));
  for(const field of ['baseline','stopped','priorResources','priorExit','priorReport'])
    assert.throws(()=>validateMultithreadReview(review,{...e,[field]:{...e[field],sha256:sha}},request,now));
});
test('new swap, boot, pressure, low headroom, consumed receipt and sticky stop block every successor',()=>{
  const {request,review,e,now}=fixture();
  for(const change of [{swapouts:1},{boot:'reboot'},{pressure:2},{available:e.policy.rssLimit+3*GiB-1}])
    assert.throws(()=>validateMultithreadReview(review,e,request,{...now,...change}));
  assert.throws(()=>validateMultithreadReview(review,e,request,now,true,false));
  assert.throws(()=>validateMultithreadReview(review,e,request,now,false,true));
  for(const field of ['stopped','trigger']){const copy=structuredClone(e);copy.priorResources.value[field]='failure';assert.throws(()=>validateMultithreadReview(review,copy,request,now));}
  const bad=structuredClone(e);bad.priorExit.value.exitCode=1;assert.throws(()=>validateMultithreadReview(review,bad,request,now));
});

test('explicit Opt9 repair preserves failed evidence and refuses any resource incident',()=>{
  const {request,review,e,now}=fixture();
  request.label='wca100-mt18-wasm-opt9-repair-fixture';
  e.policy.entry='wasm-benchmark.mjs';e.policy.variant=9;
  e.wasmBuild={sha256:'new'};
  e.failedStop={sha256:'stop',value:{...now,label:'wca100-mt18-wasm-opt9',stopped:'Multithread child exited with status 1',multithreadReviewReceipt:{variant:9,threads:18,wasmBuild:{sha256:'old'}}}};
  e.failedResources={sha256:'resources',value:{...now,stopped:e.failedStop.value.stopped,trigger:{reason:e.failedStop.value.stopped},minimumHeadroom:3*GiB,peakRss:16*GiB,rssLimit:20*GiB}};
  review.repair={stopSha256:'stop',resourcesSha256:'resources',reason:'User explicitly requested repair; a new diagnostic build preserves the previously discarded error stack.'};
  validateWasmRepairReview(review,e,request,now);
  for(const change of [{swapouts:1},{pressure:2},{minimumHeadroom:GiB},{peakRss:21*GiB},{stopped:'Memory pressure'}]){
    const copy=structuredClone(e);Object.assign(copy.failedResources.value,change);
    assert.throws(()=>validateWasmRepairReview(review,copy,request,now));
  }
  assert.throws(()=>validateWasmRepairReview({...review,repair:undefined},e,request,now));
  assert.throws(()=>validateWasmRepairReview(review,{...e,wasmBuild:{sha256:'old'}},request,now));
  assert.throws(()=>validateWasmRepairReview(review,{...e,policy:{...e.policy,variant:8}},request,now));
});

test('new 1000/16 authorization is Opt9 only and cannot relabel old 100/18 runs',()=>{
  const n=native();n.label='wca1000-mt16-rust-native-opt9';n.env.CUBEOPT_SEARCH_THREADS='16';
  const p=multithreadPolicy(n,18);assert.equal(p.count,1000);assert.equal(p.searchThreads,16);
  assert.equal(p.scope,'mac16-wca1000-single');
  assert.throws(()=>multithreadPolicy({...n,env:{...n.env,CUBEOPT_SEARCH_THREADS:'18'}},18));
  const w=wasm();w.label='wca1000-mt16-original-wasm-opt9';w.args=w.args.map(v=>v==='18'?'16':v==='both'?'original':v);w.args.push('--cases','1000');
  assert.equal(multithreadPolicy(w,18).wasmThreads,16);
  assert.throws(()=>multithreadPolicy({...w,args:w.args.map(v=>v==='original'?'rust':v)},18));
  assert.throws(()=>multithreadPolicy({...w,args:w.args.slice(0,-2)},18));
});

function experimentFixture(candidate='bpmx') {
  const f=fixture(),c=opt9ExperimentConfig(candidate);
  Object.assign(f.request,{label:c.label,executable:c.executable});f.request.env.CUBEOPT_SEARCH_THREADS='16';
  f.e.policy=multithreadPolicy(f.request,18);
  f.e.failedStop={sha256:opt9ExperimentHashes.stop,value:{...f.now,label:'wca1000-mt16-rust-wasm-opt9',stopped:'Multithread child exited with status 1',multithreadReviewReceipt:{scope:'mac16-wca1000-single',variant:9,threads:16}}};
  f.e.failedResources={sha256:opt9ExperimentHashes.failedResources,value:{...f.now,stopped:f.e.failedStop.value.stopped,trigger:{reason:f.e.failedStop.value.stopped},minimumHeadroom:3*GiB,peakRss:16*GiB,rssLimit:20*GiB}};
  f.e.nativeExperiment={candidate,build:{features:c.features,binary:{path:c.executable,sha256:sha},sourceSha256:Object.fromEntries(opt9ExperimentBuildSources.map(n=>[n,sha]))},
    failedStderr:{sha256:opt9ExperimentHashes.failedStderr},baseline:{manifest:{sha256:opt9ExperimentHashes.baselineManifest},resources:{sha256:opt9ExperimentHashes.baselineResources},exit:{sha256:opt9ExperimentHashes.baselineExit}}};
  if(c.requiresDynamicReference)f.e.nativeExperiment.dynamicReference={manifest:{sha256:opt9ExperimentHashes.dynamicManifest},totalSeconds:55.80179769600003,boot:f.now.boot,swapouts:0};
  if(c.requiresFixedReference)f.e.nativeExperiment.fixedReference={manifest:{sha256:opt9ExperimentHashes.fixedManifest},totalSeconds:43.23124978399998,boot:f.now.boot,swapouts:0};
  Object.assign(f.review,{scope:opt9ExperimentScope,label:c.label,executable:c.executable,threads:16,cases:1000,nativeExperiment:f.e.nativeExperiment,
    continuation:{stopSha256:opt9ExperimentHashes.stop,resourcesSha256:opt9ExperimentHashes.failedResources,reason:'User authorized two isolated native candidates; the exact WASM bounds failure remains preserved without resetting the resource baseline.'}});
  return f;
}
test('native Opt9 experiments accept only exact candidate paths, Opt9, 1000/16 and fixed one-pass args',()=>{
  for(const candidate of ['bpmx','dynamic','prefetch','quarter','cached','fixed','niss','ternary','axis','ranked']) {
    const {request,review,e,now}=experimentFixture(candidate);
    assert.equal(e.policy.scope,opt9ExperimentScope);assert.equal(e.policy.count,1000);
    validateMultithreadReview(review,e,request,now,false,true);
    for(const change of [{executable:multithreadPaths.native},{label:request.label+'-retry'},
      {args:request.args.map((s,i)=>i===0?'inspect':s)},
      {env:{...request.env,CUBEOPT_VARIANT:'8'}},{env:{...request.env,CUBEOPT_SEARCH_THREADS:'18'}},
      {env:{...request.env,CUBEOPT_SOLVE_THREADS:'16'}}]) assert.throws(()=>multithreadPolicy({...request,...change},18));
  }
});
test('later candidates require exact features and the preserved successful 55.8s reference',()=>{
  assert.deepEqual(opt9ExperimentConfig('prefetch').features.filter(n=>n.startsWith('opt9-')),
    ['opt9-native-bpmx','opt9-native-dynamic','opt9-native-prefetch']);
  assert.deepEqual(opt9ExperimentConfig('quarter').features.filter(n=>n.startsWith('opt9-')),
    ['opt9-native-bpmx','opt9-native-dynamic','opt9-native-prefetch','opt9-native-quarter']);
  assert.deepEqual(opt9ExperimentConfig('cached').features.filter(n=>n.startsWith('opt9-')),
    ['opt9-native-bpmx','opt9-native-dynamic','opt9-native-prefetch','opt9-native-quarter','opt9-native-quarter-cache','opt9-native-root-bound']);
  assert.equal(opt9ExperimentConfig('cached').executable,resolve(HERE,'target/opt9-cached/release/cube48opt-research'));
  assert.deepEqual(opt9ExperimentConfig('fixed').features.filter(n=>n.startsWith('opt9-')),
    ['opt9-native-bpmx','opt9-native-dynamic','opt9-native-fixed-contexts','opt9-native-prefetch','opt9-native-quarter','opt9-native-root-bound']);
  assert.equal(opt9ExperimentConfig('fixed').executable,resolve(HERE,'target/opt9-fixed/release/cube48opt-research'));
  assert.deepEqual(opt9ExperimentConfig('niss').features.filter(n=>n.startsWith('opt9-')),
    ['opt9-native-bpmx','opt9-native-dynamic','opt9-native-fixed-contexts','opt9-native-niss','opt9-native-prefetch','opt9-native-quarter','opt9-native-root-bound']);
  assert.equal(opt9ExperimentConfig('niss').executable,resolve(HERE,'target/opt9-niss/release/cube48opt-research'));
  assert.deepEqual(opt9ExperimentConfig('ternary').features.filter(n=>n.startsWith('opt9-')),
    ['opt9-native-bpmx','opt9-native-dynamic','opt9-native-fixed-contexts','opt9-native-prefetch','opt9-native-quarter','opt9-native-root-bound','opt9-native-ternary']);
  assert.equal(opt9ExperimentConfig('ternary').executable,resolve(HERE,'target/opt9-ternary/release/cube48opt-research'));
  assert.deepEqual(opt9ExperimentConfig('axis').features.filter(n=>n.startsWith('opt9-')),
    ['opt9-native-axis','opt9-native-bpmx','opt9-native-dynamic','opt9-native-fixed-contexts','opt9-native-prefetch','opt9-native-quarter','opt9-native-root-bound']);
  assert.equal(opt9ExperimentConfig('axis').executable,resolve(HERE,'target/opt9-axis/release/cube48opt-research'));
  assert.deepEqual(opt9ExperimentConfig('ranked').features.filter(n=>n.startsWith('opt9-')),
    ['opt9-native-bpmx','opt9-native-dynamic','opt9-native-fixed-contexts','opt9-native-prefetch','opt9-native-quarter','opt9-native-ranked','opt9-native-root-bound']);
  assert.equal(opt9ExperimentConfig('ranked').executable,resolve(HERE,'target/opt9-ranked/release/cube48opt-research'));
  for(const candidate of ['prefetch','quarter','cached','fixed','niss','ternary','axis','ranked']) {
    const {request,review,e,now}=experimentFixture(candidate);
    for(const replacement of [undefined,{...e.nativeExperiment.dynamicReference,manifest:{sha256:sha}},
      {...e.nativeExperiment.dynamicReference,totalSeconds:40},{...e.nativeExperiment.dynamicReference,swapouts:1},
      {...e.nativeExperiment.dynamicReference,boot:'new-boot'}]) {
      const copy=structuredClone(e);copy.nativeExperiment.dynamicReference=replacement;
      assert.throws(()=>validateOpt9ExperimentContinuation(review,copy,request,now));
    }
    const wrong=structuredClone(e);wrong.nativeExperiment.build.features=opt9ExperimentConfig('dynamic').features;
    assert.throws(()=>validateOpt9ExperimentContinuation(review,wrong,request,now));
    if(candidate==='cached') {
      const incomplete=structuredClone(e);incomplete.nativeExperiment.build.features=opt9ExperimentConfig('quarter').features;
      assert.throws(()=>validateOpt9ExperimentContinuation(review,incomplete,request,now));
    }
    if(['fixed','niss','ternary','axis','ranked'].includes(candidate)) {
      for(const feature of ['opt9-native-fixed-contexts','opt9-native-root-bound',...(['niss','ternary','axis','ranked'].includes(candidate)?[`opt9-native-${candidate}`]:[]),...(candidate==='ranked'?['opt9-native-dynamic']:[])]) {
        const incomplete=structuredClone(e);incomplete.nativeExperiment.build.features=incomplete.nativeExperiment.build.features.filter((name:string)=>name!==feature);
        assert.throws(()=>validateOpt9ExperimentContinuation(review,incomplete,request,now));
      }
      const cached=structuredClone(e);cached.nativeExperiment.build.features.push('opt9-native-quarter-cache');cached.nativeExperiment.build.features.sort();
      assert.throws(()=>validateOpt9ExperimentContinuation(review,cached,request,now));
      if(['ternary','axis','ranked'].includes(candidate)) {
        for(const feature of ['opt9-native-niss',...(['axis','ranked'].includes(candidate)?['opt9-native-ternary']:[]),...(candidate==='ranked'?['opt9-native-axis']:[])]) {
          const mixed=structuredClone(e);mixed.nativeExperiment.build.features.push(feature);mixed.nativeExperiment.build.features.sort();
          assert.throws(()=>validateOpt9ExperimentContinuation(review,mixed,request,now));
        }
      }
    }
    if(['niss','ternary','axis','ranked'].includes(candidate)) {
      for(const replacement of [undefined,{...e.nativeExperiment.fixedReference,manifest:{sha256:sha}},
        {...e.nativeExperiment.fixedReference,totalSeconds:30},{...e.nativeExperiment.fixedReference,swapouts:1},
        {...e.nativeExperiment.fixedReference,boot:'new-boot'}]) {
        const copy=structuredClone(e);copy.nativeExperiment.fixedReference=replacement;
        assert.throws(()=>validateOpt9ExperimentContinuation(review,copy,request,now));
      }
    }
  }
});
test('experiment continuation pins exact failure, sources, baseline and features; new stops cannot retry',()=>{
  const {request,review,e,now}=experimentFixture();
  validateOpt9ExperimentContinuation(review,e,request,now);
  for(const [part,key,value] of [['failedStop','sha256',sha],['failedResources','sha256',sha]] as const) {
    const copy=structuredClone(e);copy[part][key]=value;assert.throws(()=>validateOpt9ExperimentContinuation(review,copy,request,now));
  }
  for(const change of [{label:request.label},{swapouts:1},{pressure:2},{boot:'new-boot'}]) {
    const copy=structuredClone(e);Object.assign(copy.failedStop.value,change);assert.throws(()=>validateOpt9ExperimentContinuation(review,copy,request,now));
  }
  for(const change of [{stopped:'Resource protection'},{minimumHeadroom:GiB},{peakRss:21*GiB}]) {
    const copy=structuredClone(e);Object.assign(copy.failedResources.value,change);assert.throws(()=>validateOpt9ExperimentContinuation(review,copy,request,now));
  }
  for(const change of [{features:[]},{binary:{path:request.executable,sha256:'bad'}},{sourceSha256:{}}]) {
    const copy=structuredClone(e);Object.assign(copy.nativeExperiment.build,change);assert.throws(()=>validateOpt9ExperimentContinuation(review,copy,request,now));
  }
  assert.throws(()=>validateMultithreadReview(review,e,request,now,true,true));
  assert.throws(()=>validateMultithreadReview(review,e,request,{...now,available:e.policy.rssLimit+3*GiB-1},false,true));
});
test('the retained 43.2s reference requires its exact manifest, result and unchanged boot/swap history',()=>{
  const now={boot:'unchanged-boot',swapouts:0,pressure:1,available:60*GiB};
  const fixed={manifest:{sha256:opt9ExperimentHashes.fixedManifest},totalSeconds:43.23124978399998,boot:now.boot,swapouts:0};
  validateOpt9FixedReference(fixed,now);
  for(const replacement of [undefined,{...fixed,manifest:{sha256:sha}},{...fixed,totalSeconds:30},{...fixed,boot:'new-boot'},{...fixed,swapouts:1}])
    assert.throws(()=>validateOpt9FixedReference(replacement,now));
  for(const name of ['symmetry','unknown'])assert.throws(()=>opt9ExperimentConfig(name));
});
test('experiment summary consumes all 1000 rows on both sides and rejects partial, reordered or non-optimal output',()=>{
  const cases=Array.from({length:1000},(_,i)=>({id:String(i)}));
  const rows=cases.map(c=>({...c,threads:16,batch_threads:1,contexts:8,cancelled:false,length:18,completed_depth:17,seconds:0.5,nodes:7,probes:9}));
  let replayed=0;
  const totals=validateOpt9ExperimentRows(rows,rows,cases,()=>{replayed++;});
  assert.equal(replayed,2000);assert.deepEqual(totals.candidate,{seconds:500,nodes:7000,probes:9000});assert.equal(totals.optimalLengthsMatched,1000);
  replayed=0;
  const dual=validateOpt9ExperimentRows(rows,rows,cases,()=>{replayed++;},rows);
  assert.equal(replayed,3000);assert.equal(dual.dynamicOptimalLengthsMatched,1000);
  assert.deepEqual(dual.dynamicReference,{seconds:500,nodes:7000,probes:9000});
  replayed=0;
  const triple=validateOpt9ExperimentRows(rows,rows,cases,()=>{replayed++;},rows,rows);
  assert.equal(replayed,4000);assert.equal(triple.fixedVerifiedSolutions,1000);assert.equal(triple.fixedOptimalLengthsMatched,1000);
  assert.deepEqual(triple.fixedReference,{seconds:500,nodes:7000,probes:9000});
  assert.throws(()=>validateOpt9ExperimentRows(rows,rows,cases,()=>{},undefined,rows));
  assert.throws(()=>validateOpt9ExperimentRows(rows,rows,cases,()=>{},rows,rows.slice(1)));
  const badFixed=structuredClone(rows);Object.assign(badFixed[999],{length:19,completed_depth:18});
  assert.throws(()=>validateOpt9ExperimentRows(rows,rows,cases,()=>{},rows,badFixed));
  const unreplayableFixed=structuredClone(rows);
  assert.throws(()=>validateOpt9ExperimentRows(rows,rows,cases,(_item,row)=>{if(row===unreplayableFixed[999])throw Error('fixed replay failed');},rows,unreplayableFixed));
  assert.throws(()=>validateOpt9ExperimentRows(rows,rows,cases,()=>{},rows.slice(1)));
  const badDynamic=structuredClone(rows);Object.assign(badDynamic[999],{length:19,completed_depth:18});
  assert.throws(()=>validateOpt9ExperimentRows(rows,rows,cases,()=>{},badDynamic));
  assert.throws(()=>validateOpt9ExperimentRows(rows.slice(1),rows,cases,()=>{}));
  for(const change of [{id:'wrong'},{length:19,completed_depth:18},{threads:18},{batch_threads:2},{cancelled:true},{nodes:-1}]) {
    const bad=structuredClone(rows);Object.assign(bad[999],change);assert.throws(()=>validateOpt9ExperimentRows(bad,rows,cases,()=>{}));
  }
});

function opt10Fixture(candidate='baseline') {
  const f=experimentFixture(),c=opt10ExperimentConfig(candidate);
  f.request=opt10ExperimentRequest(candidate);f.e.policy=multithreadPolicy(f.request,18);
  f.e.nativeExperiment=undefined;
  f.e.table={path:f.e.policy.tablePath,bytes:f.e.policy.tableBytes};
  f.e.opt10Experiment={candidate,build:{features:c.features,binary:{path:c.executable,sha256:sha},sourceSha256:Object.fromEntries(opt9ExperimentBuildSources.map(n=>[n,sha]))},
    failedStderr:{sha256:opt9ExperimentHashes.failedStderr},original:{manifest:{sha256:opt9ExperimentHashes.baselineManifest},resources:{sha256:opt9ExperimentHashes.baselineResources},exit:{sha256:opt9ExperimentHashes.baselineExit}},
    ...(candidate!=='baseline'?{baselineReference:{boot:f.now.boot,swapouts:0,totalSeconds:100}}:{}),
    ...(c.requiresHotpathReference?{hotpathReference:{manifest:{sha256:opt10HotpathReferenceHashes.manifest},report:{sha256:opt10HotpathReferenceHashes.report},boot:f.now.boot,swapouts:0,totalSeconds:25.145347332000014}}:{}),
    ...(c.requiresCosetReference?{cosetReference:{manifest:{sha256:opt10CosetReferenceHashes.manifest},report:{sha256:opt10CosetReferenceHashes.report},boot:f.now.boot,swapouts:0,totalSeconds:24.591098480000003}}:{})};
  Object.assign(f.review,{scope:opt10ExperimentScope,label:c.label,executable:c.executable,args:f.request.args,backend:'opt10',variant:null,h:null,
    nativeExperiment:undefined,opt10Experiment:f.e.opt10Experiment,table:f.e.table});
  return f;
}
test('Opt10 native candidates use dedicated binaries, fixed1000/16 and exact isolated feature sets',()=>{
  assert.deepEqual(opt10ExperimentConfig('baseline').features,['default','h10-fast-coord','h10-prefetch','neon-moves','opt10-runtime']);
  assert.deepEqual(opt10ExperimentConfig('search').features,['default','h10-fast-coord','h10-prefetch','neon-moves','opt10-native-search','opt10-runtime','opt9-native-bpmx','opt9-native-dynamic','opt9-native-fixed-contexts','opt9-native-quarter','opt9-native-root-bound']);
  assert.deepEqual(opt10ExperimentConfig('hotpath').features,[...opt10ExperimentConfig('search').features,'opt10-native-hotpath'].sort());
  assert.equal(opt10ExperimentConfig('hotpath').executable,resolve(HERE,'target/opt10-hotpath/release/cube48opt-research'));
  assert.deepEqual(opt10ExperimentConfig('batch').features,[...opt10ExperimentConfig('hotpath').features,'opt10-native-batch'].sort());
  assert.equal(opt10ExperimentConfig('batch').executable,resolve(HERE,'target/opt10-batch/release/cube48opt-research'));
  for(const candidate of ['dual','prefix','coset']) {
    assert.deepEqual(opt10ExperimentConfig(candidate).features,[...opt10ExperimentConfig('hotpath').features,`opt10-native-${candidate}`].sort());
    assert.equal(opt10ExperimentConfig(candidate).executable,resolve(HERE,`target/opt10-${candidate}/release/cube48opt-research`));
  }
  assert.deepEqual(opt10ExperimentConfig('coset-chain').features,[...opt10ExperimentConfig('coset').features,'opt10-native-coset-chain'].sort());
  assert.equal(opt10ExperimentConfig('coset-chain').executable,resolve(HERE,'target/opt10-coset-chain/release/cube48opt-research'));
  assert.deepEqual(opt10ExperimentConfig('coset-gated').features,[...opt10ExperimentConfig('coset-chain').features,'opt10-native-coset-gated'].sort());
  assert.equal(opt10ExperimentConfig('coset-gated').executable,resolve(HERE,'target/opt10-coset-gated/release/cube48opt-research'));
  assert.deepEqual(opt10ExperimentConfig('profile').features,[...opt10ExperimentConfig('coset').features,'opt10-native-profile'].sort());
  assert.equal(opt10ExperimentConfig('profile').executable,resolve(HERE,'target/opt10-profile/release/cube48opt-research'));
  assert.deepEqual(opt10ExperimentConfig('lookahead').features,[...opt10ExperimentConfig('coset').features,'opt10-native-lookahead'].sort());
  assert.equal(opt10ExperimentConfig('lookahead').executable,resolve(HERE,'target/opt10-lookahead/release/cube48opt-research'));
  assert.deepEqual(opt10ExperimentConfig('projection').features,[...opt10ExperimentConfig('coset').features,'opt10-native-projection'].sort());
  assert.equal(opt10ExperimentConfig('projection').executable,resolve(HERE,'target/opt10-projection/release/cube48opt-research'));
  for(const candidate of ['baseline','search','hotpath','batch','dual','prefix','coset','coset-chain','coset-gated','profile','lookahead','projection']) {
    const {request,review,e,now}=opt10Fixture(candidate);
    validateMultithreadReview(review,e,request,now,false,true);
    assert.equal(e.policy.rssLimit,31_130_911_744+GiB+16*16*1024**2);
    for(const change of [{executable:multithreadPaths.native},{label:request.label+'-retry'},{args:request.args.map((v,i)=>i===0?'generate-opt10':v)},
      {env:{...request.env,CUBEOPT_VARIANT:'9'}},{env:{...request.env,CUBEOPT_SEARCH_THREADS:'18'}},{env:{...request.env,CUBEOPT_SOLVE_THREADS:'16'}}])
      assert.throws(()=>multithreadPolicy({...request,...change},18));
    for(const feature of ['opt9-native-prefetch','opt9-native-quarter-cache','opt9-native-ranked','wasm-batch-probes']) {
      const bad=structuredClone(e);bad.opt10Experiment.build.features.push(feature);bad.opt10Experiment.build.features.sort();
      assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));
    }
    if(['hotpath','batch','dual','prefix','coset','coset-chain','coset-gated','profile','lookahead','projection'].includes(candidate)) {
      const missing=structuredClone(e);missing.opt10Experiment.build.features=opt10ExperimentConfig(candidate==='hotpath'?'search':'hotpath').features;
      assert.throws(()=>validateOpt10ExperimentContinuation(review,missing,request,now));
      const missingBaseline=structuredClone(e);delete missingBaseline.opt10Experiment.baselineReference;
      assert.throws(()=>validateOpt10ExperimentContinuation(review,missingBaseline,request,now));
      assert.throws(()=>multithreadPolicy({...request,executable:opt10ExperimentConfig('search').executable},18));
    }
    for(const other of ['batch','dual','prefix','coset','coset-chain','coset-gated','profile','lookahead','projection'].filter(other=>other!==candidate)) {
      const mixed=structuredClone(e);mixed.opt10Experiment.build.features.push(`opt10-native-${other}`);mixed.opt10Experiment.build.features.sort();
      assert.throws(()=>validateOpt10ExperimentContinuation(review,mixed,request,now));
    }
  }
  assert.throws(()=>opt10ExperimentConfig('unknown'));
});
test('new Opt10 candidate references pin preserved hotpath snapshot/report, same boot and zero Swapouts',()=>{
  for(const candidate of ['batch','dual','prefix','coset','coset-chain','coset-gated','profile','lookahead','projection']) {
  const {request,review,e,now}=opt10Fixture(candidate),original=e.opt10Experiment.hotpathReference;
  for(const reference of [undefined,{...original,manifest:{sha256:sha}},{...original,report:{sha256:sha}},
    {...original,totalSeconds:20},{...original,boot:'new-boot'},{...original,swapouts:1}]) {
    const bad=structuredClone(e);bad.opt10Experiment.hotpathReference=reference;
    assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));
  }
  assert.throws(()=>multithreadPolicy({...request,label:request.label+'-retry'},18));
  }
});
test('coset-chain and coset-gated require exact parent features and preserved 24.591s coset evidence',()=>{
  for(const candidate of ['coset-chain','coset-gated']) {
  const {request,review,e,now}=opt10Fixture(candidate),reference=e.opt10Experiment.cosetReference;
  for(const replacement of [undefined,{...reference,manifest:{sha256:sha}},{...reference,report:{sha256:sha}},
    {...reference,totalSeconds:20},{...reference,boot:'new-boot'},{...reference,swapouts:1}]) {
    const bad=structuredClone(e);bad.opt10Experiment.cosetReference=replacement;
    assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));
  }
  for(const feature of ['opt10-native-coset','opt10-native-coset-chain',...(candidate==='coset-gated'?['opt10-native-coset-gated']:[])]) {
    const bad=structuredClone(e);bad.opt10Experiment.build.features=bad.opt10Experiment.build.features.filter((f:string)=>f!==feature);
    assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));
  }
  const previous=opt10Fixture('coset');previous.e.opt10Experiment.cosetReference=reference;
  assert.throws(()=>validateOpt10ExperimentContinuation(previous.review,previous.e,previous.request,previous.now));
  }
});
test('profile is diagnostic-only, excludes chain/gated, and pins preserved coset evidence',()=>{
  const {request,review,e,now}=opt10Fixture('profile'),reference=e.opt10Experiment.cosetReference;
  for(const replacement of [undefined,{...reference,manifest:{sha256:sha}},{...reference,report:{sha256:sha}},
    {...reference,totalSeconds:20},{...reference,boot:'new-boot'},{...reference,swapouts:1}]) {
    const bad=structuredClone(e);bad.opt10Experiment.cosetReference=replacement;
    assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));
  }
  for(const feature of ['opt10-native-coset','opt10-native-profile']) {
    const bad=structuredClone(e);bad.opt10Experiment.build.features=bad.opt10Experiment.build.features.filter((f:string)=>f!==feature);
    assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));
  }
  const mode=opt10ExperimentReportMode('profile');
  assert.equal(mode.diagnosticOnly,true);assert.equal(mode.performanceEligible,false);
  assert.match(mode.comparison!,/runtime overhead/);assert.match(mode.comparison!,/must not be used for performance rankings/);
  for(const candidate of ['baseline','search','hotpath','batch','dual','prefix','coset','coset-chain','coset-gated'])
    assert.deepEqual(opt10ExperimentReportMode(candidate),{});
});
test('lookahead and projection bind separate builds and coset reference without mixing features',()=>{
  for(const candidate of ['lookahead','projection']) {
  const {request,review,e,now}=opt10Fixture(candidate),reference=e.opt10Experiment.cosetReference;
  assert.equal(request.label,`wca1000-mt16-rust-native-opt10-exp-${candidate}`);
  assert.equal(opt10ExperimentConfig(candidate).buildPath,resolve(HERE,`target/opt10-${candidate}/opt10-experiment-build.json`));
  assert.deepEqual(opt10ExperimentReportMode(candidate),{});
  for(const replacement of [undefined,{...reference,manifest:{sha256:sha}},{...reference,report:{sha256:sha}},
    {...reference,totalSeconds:20},{...reference,boot:'new-boot'},{...reference,swapouts:1}]) {
    const bad=structuredClone(e);bad.opt10Experiment.cosetReference=replacement;
    assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));
  }
  for(const feature of ['opt10-native-coset',`opt10-native-${candidate}`]) {
    const bad=structuredClone(e);bad.opt10Experiment.build.features=bad.opt10Experiment.build.features.filter((f:string)=>f!==feature);
    assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));
  }
  for(const prior of ['coset','profile','coset-chain','coset-gated',candidate==='projection'?'lookahead':'projection']) {
    assert.throws(()=>multithreadPolicy({...request,executable:opt10ExperimentConfig(prior).executable},18));
    const bad=structuredClone(e);bad.opt10Experiment.build.features=opt10ExperimentConfig(prior).features;
    assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));
  }
  }
});
test('Opt10 continuation keeps exact old stop and swap baseline; search requires successful baseline',()=>{
  const {request,review,e,now}=opt10Fixture('search');
  for(const part of ['failedStop','failedResources']) {const bad=structuredClone(e);bad[part].sha256=sha;assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));}
  for(const change of [{swapouts:1},{pressure:2},{boot:'new-boot'},{minimumHeadroom:GiB},{stopped:'Memory protection'}]) {
    const bad=structuredClone(e);Object.assign(bad.failedResources.value,change);assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));
  }
  for(const ref of [undefined,{boot:'other',swapouts:0,totalSeconds:100},{boot:now.boot,swapouts:1,totalSeconds:100}]) {
    const bad=structuredClone(e);bad.opt10Experiment.baselineReference=ref;assert.throws(()=>validateOpt10ExperimentContinuation(review,bad,request,now));
  }
  assert.throws(()=>validateMultithreadReview(review,e,request,now,true,true));
  assert.throws(()=>validateMultithreadReview(review,e,request,{...now,available:e.policy.rssLimit+3*GiB-1},false,true));
});
