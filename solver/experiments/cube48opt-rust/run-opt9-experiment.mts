/** Isolated native Opt9 candidates; fixed WCA1000, 16 threads, one pass. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync, fstatSync, constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cpus } from 'node:os';
import { collectMultithreadEvidence, makeMultithreadReview, multithreadPaths, multithreadPolicy,
  opt9ExperimentConfig, opt9ExperimentPaths, recordOpt9ExperimentBuild, validateOpt9ExperimentContinuation } from './multithread-policy.mts';
import { cleanRunEnvironment, validateRunCompletion } from './run-multithread.mts';
import { readWca100 } from './wasm-benchmark.mjs';
import { parseCompleteJsonl, readSuccessfulTiming } from './report-opt10-wca100.mjs';
import { verify } from './benchmark.mjs';

const HERE=dirname(fileURLToPath(import.meta.url)), ROOT=resolve(HERE,'../../..'), BASE=resolve(ROOT,'.tmp/cubeopt-reverse');
const digest=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const save=(path:string,value:any)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
function read(path:string,max=8*1024**2) {
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {const s=fstatSync(fd);assert(s.isFile()&&s.size<=max,`Expected bounded regular evidence: ${path}`);return readFileSync(fd);}
  finally {closeSync(fd);}
}
const json=(path:string)=>JSON.parse(read(path).toString());
function paths(candidate:string) {
  const config=opt9ExperimentConfig(candidate),prefix=resolve(BASE,config.label),dir=prefix+'-review';
  return {...config,prefix,dir,reviewPath:resolve(dir,'launch.json'),requestPath:resolve(dir,'request.json'),
    stdout:prefix+'.jsonl',stderr:prefix+'.stderr.log',exit:prefix+'-exit.json',resources:prefix+'-resources.json',
    report:prefix+'-report.json',failure:prefix+'-failure.json',started:prefix+'-started.json'};
}
function requestFor(candidate:string) {
  const p=paths(candidate);
  return {label:p.label,executable:p.executable,
    args:['solve',resolve(BASE,'opt9-generated/small-memory.bin'),resolve(BASE,'opt9-generated/h48prun31h9.dat'),'8','20','0'],
    env:{CUBEOPT_MULTITHREAD_REVIEW:p.reviewPath,CUBEOPT_BACKEND:'opt',CUBEOPT_VARIANT:'9',
      CUBEOPT_SEARCH_THREADS:'16',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_MEASURE_RSS:'1'}};
}

export function prepareOpt9Experiment(candidate:string) {
  assert.equal(process.platform,'darwin');
  const p=paths(candidate),request=requestFor(candidate);
  assert(!existsSync(p.dir),'This candidate was already prepared; never overwrite or retry');
  for(const path of [p.stdout,p.stderr,p.exit,p.resources,p.report,p.failure,p.started]) assert(!existsSync(path),`Existing candidate evidence: ${path}`);
  const baseline=json(multithreadPaths.baseline);
  const review=makeMultithreadReview(request,{boot:baseline.boot,swapouts:baseline.swapouts});
  const evidence=collectMultithreadEvidence(request);
  validateOpt9ExperimentContinuation(review,evidence,request,baseline);
  mkdirSync(p.dir);
  save(p.reviewPath,review);
  save(p.requestPath,{schema:'cuberoot.opt9-native-experiment-request.v1',candidate,
    reviewPath:p.reviewPath,reviewSha256:digest(read(p.reviewPath)),...request});
  return {preparedOnly:true,candidate,requestPath:p.requestPath,reviewPath:p.reviewPath};
}

/** Compare every native result and independently replay all retained references. */
export function validateOpt9ExperimentRows(rows:any[], reference:any[], cases:any[], replay:(item:any,row:any)=>void, dynamicRows?:any[], fixedRows?:any[]) {
  assert.equal(cases.length,1000);assert.equal(rows.length,1000);assert.equal(reference.length,1000);
  const summarize=(items:any[])=>{
    const totals={seconds:0,nodes:0,probes:0};
    for(const [i,item] of cases.entries()) {
      const row=items[i];assert.equal(row.id,item.id);assert.equal(row.threads,16);assert.equal(row.batch_threads,1);
      assert.equal(row.contexts,8);assert.equal(row.cancelled,false);assert.equal(row.completed_depth,row.length-1);
      assert(Number.isFinite(row.seconds)&&row.seconds>=0);
      for(const key of ['nodes','probes'] as const) {assert(Number.isSafeInteger(row[key])&&row[key]>=0);totals[key]+=row[key];assert(Number.isSafeInteger(totals[key]));}
      replay(item,row);totals.seconds+=row.seconds;
    }
    return totals;
  };
  const baseline=summarize(reference),candidate=summarize(rows);
  for(let i=0;i<1000;i++)assert.equal(rows[i].length,reference[i].length,`Optimal length mismatch: ${cases[i].id}`);
  let dynamicReference;
  if(dynamicRows) {
    assert.equal(dynamicRows.length,1000);dynamicReference=summarize(dynamicRows);
    for(let i=0;i<1000;i++)assert.equal(rows[i].length,dynamicRows[i].length,`Dynamic optimal length mismatch: ${cases[i].id}`);
  }
  let fixedReference;
  if(fixedRows) {
    assert(dynamicRows,'The fixed reference requires the preserved dynamic reference too');
    assert.equal(fixedRows.length,1000);fixedReference=summarize(fixedRows);
    for(let i=0;i<1000;i++)assert.equal(rows[i].length,fixedRows[i].length,`Fixed optimal length mismatch: ${cases[i].id}`);
  }
  return {baseline,candidate,verifiedSolutions:1000,baselineVerifiedSolutions:1000,optimalLengthsMatched:1000,
    ...(dynamicReference?{dynamicReference,dynamicVerifiedSolutions:1000,dynamicOptimalLengthsMatched:1000}:{}),
    ...(fixedReference?{fixedReference,fixedVerifiedSolutions:1000,fixedOptimalLengthsMatched:1000}:{})};
}

export async function executeOpt9Experiment(candidate:string) {
  assert.equal(process.platform,'darwin');
  const p=paths(candidate),request=json(p.requestPath),review=json(p.reviewPath),expected=requestFor(candidate);
  assert.equal(request.schema,'cuberoot.opt9-native-experiment-request.v1');assert.equal(request.candidate,candidate);
  assert.equal(request.reviewPath,p.reviewPath);assert.equal(request.reviewSha256,digest(read(p.reviewPath)));
  for(const field of ['label','executable','args','env'])assert.deepEqual(request[field],expected[field as keyof typeof expected]);
  const policy=multithreadPolicy(request,cpus().length), evidence=collectMultithreadEvidence(request);
  validateOpt9ExperimentContinuation(review,evidence,request,json(multithreadPaths.baseline));
  for(const path of [p.stdout,p.stderr,p.exit,p.resources,p.report,p.failure,p.started]) assert(!existsSync(path),`Already attempted: ${path}`);
  save(p.started,{candidate,startedAt:new Date().toISOString(),requestSha256:digest(read(p.requestPath)),reviewSha256:request.reviewSha256});
  const fds:number[]=[];
  try {
    fds.push(openSync(p.stdout,'wx'));fds.push(openSync(p.stderr,'wx'));
    // Only this guarded child may read the PDB. Guard supplies the fixed input.
    const child=spawn(process.execPath,['--experimental-strip-types',resolve(HERE,'guard.mts'),p.label,p.executable,...request.args],
      {cwd:ROOT,env:cleanRunEnvironment(request.env),stdio:['ignore',fds[0],fds[1]]});
    const stop=()=>child.kill('SIGTERM');process.once('SIGTERM',stop);process.once('SIGINT',stop);
    let error:string|undefined;
    const completion=await new Promise<any>(done=>{child.once('error',e=>{error=String(e);});child.once('close',(exitCode,signal)=>done({exitCode,signal,...(error?{error}:{}),finishedAt:new Date().toISOString()}));});
    process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);
    while(fds.length)closeSync(fds.pop()!);
    save(p.exit,completion);
    assert.equal(completion.exitCode,0,`Guarded candidate failed; retained ${p.stderr}`);assert.equal(completion.signal,null);
    const resource=json(p.resources),after=collectMultithreadEvidence(request);
    validateRunCompletion(request,review,after,resource,completion);
    const corpus=readWca100(resolve(ROOT,'solver/testdata/benchmarks/wca-first1000.json'),1000);
    assert.equal(corpus.corpusSha256,review.input.corpusSha256);
    const {cube3x3x3}=await import(pathToFileURL(resolve(ROOT,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
    const puzzle=await cube3x3x3.kpuzzle();
    const baselinePath=review.nativeExperiment.baseline.records['results.jsonl'].path;
    const dynamicEvidence=review.nativeExperiment.dynamicReference;
    const dynamicRows=dynamicEvidence?parseCompleteJsonl(read(dynamicEvidence.results.path).toString(),1000):undefined;
    const fixedEvidence=review.nativeExperiment.fixedReference;
    const fixedRows=fixedEvidence?parseCompleteJsonl(read(fixedEvidence.results.path).toString(),1000):undefined;
    const totals=validateOpt9ExperimentRows(parseCompleteJsonl(read(p.stdout).toString(),1000),
      parseCompleteJsonl(read(baselinePath).toString(),1000),corpus.cases,(item,row)=>verify(puzzle,item,row),dynamicRows,fixedRows);
    const timing=readSuccessfulTiming(read(p.stderr).toString(),completion);
    assert(timing.peakRssBytes<=policy.rssLimit);
    const oldReport=json(review.nativeExperiment.baseline.records['report.json'].path);
    assert.equal(totals.baseline.seconds,oldReport.totalSeconds);
    let dynamicComparison;
    if(dynamicEvidence) {
      const dynamicReport=json(dynamicEvidence.report.path);
      assert.equal(totals.dynamicReference!.seconds,dynamicReport.totalSeconds);
      assert.equal(totals.dynamicReference!.nodes,dynamicReport.totalNodes);assert.equal(totals.dynamicReference!.probes,dynamicReport.totalProbes);
      dynamicComparison={dynamicReferenceEvidence:dynamicEvidence,dynamicPeakRssBytes:dynamicReport.peakRssBytes,
        dynamicOverCandidateTimeRatio:totals.candidate.seconds>0?totals.dynamicReference!.seconds/totals.candidate.seconds:null};
    }
    let fixedComparison;
    if(fixedEvidence) {
      const fixedReport=json(fixedEvidence.report.path);
      assert.equal(totals.fixedReference!.seconds,fixedReport.totalSeconds);
      assert.equal(totals.fixedReference!.nodes,fixedReport.totalNodes);assert.equal(totals.fixedReference!.probes,fixedReport.totalProbes);
      fixedComparison={fixedReferenceEvidence:fixedEvidence,fixedPeakRssBytes:fixedReport.peakRssBytes,
        fixedOverCandidateTimeRatio:totals.candidate.seconds>0?totals.fixedReference!.seconds/totals.candidate.seconds:null};
    }
    const report={schema:'cuberoot.opt9-native-experiment-report.v1',experiment:candidate,engine:'rust-native',variant:9,
      cases:1000,threads:16,batchThreads:1,measuredPasses:1,warmupCases:0,corpusSha256:corpus.corpusSha256,
      ...totals,totalSeconds:totals.candidate.seconds,totalNodes:totals.candidate.nodes,totalProbes:totals.candidate.probes,
      peakRssBytes:timing.peakRssBytes,guardPeakRssBytes:resource.peakRss,
      baselinePeakRssBytes:oldReport.peakRssBytes,baselineOverCandidateTimeRatio:totals.candidate.seconds>0?totals.baseline.seconds/totals.candidate.seconds:null,
      ...(dynamicComparison??{}),
      ...(fixedComparison??{}),
      comparison:fixedEvidence?'Preserved original, dynamic and fixed native references on the same machine and protocol; not fresh paired runs.':dynamicEvidence?'Preserved original and dynamic native references on the same machine and protocol; not fresh paired runs.':'Preserved native baseline on the same machine and protocol; not a fresh paired run.',freshPaired:false,
      machine:review.machine,table:review.table,snapshot:review.snapshot,build:review.nativeExperiment.build,
      baselineEvidence:review.nativeExperiment.baseline,reviewPath:p.reviewPath,reviewSha256:request.reviewSha256,
      resourcePath:p.resources,resourceSha256:digest(read(p.resources)),rawSha256:digest(read(p.stdout)),
      completedAt:new Date().toISOString()};
    save(p.report,report);return report;
  } catch(error) {
    const failure={candidate,label:p.label,failedAt:new Date().toISOString(),error:String(error),reviewSha256:request.reviewSha256,partialResultsPreserved:true};
    if(!existsSync(p.failure))save(p.failure,failure);
    // Verification failures occur after guard exits too. Preserve a separate
    // sticky record so another candidate cannot bypass this failure.
    if(!existsSync(opt9ExperimentPaths.stop))save(opt9ExperimentPaths.stop,failure);
    throw error;
  } finally {while(fds.length)closeSync(fds.pop()!);}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [mode,candidate,...extra]=process.argv.slice(2);assert.equal(extra.length,0);
  assert(['record-build','prepare','execute'].includes(mode),'Usage: run-opt9-experiment.mts record-build|prepare|execute bpmx|dynamic|prefetch|quarter|cached|fixed|niss|ternary|axis|ranked');
  const result=mode==='record-build'?recordOpt9ExperimentBuild(candidate):mode==='prepare'?prepareOpt9Experiment(candidate):await executeOpt9Experiment(candidate);
  console.log(JSON.stringify(result));
}
