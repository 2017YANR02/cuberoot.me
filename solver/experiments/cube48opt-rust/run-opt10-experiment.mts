/** Native Opt10 only: existing table, WCA1000, sixteen threads, one pass. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants, openSync, closeSync, fstatSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cpus } from 'node:os';
import { collectMultithreadEvidence, makeMultithreadReview, multithreadPaths, multithreadPolicy,
  opt10ExperimentConfig, opt10ExperimentPaths, recordOpt10ExperimentBuild, validateOpt10ExperimentContinuation } from './multithread-policy.mts';
import { cleanRunEnvironment, validateRunCompletion } from './run-multithread.mts';
import { validateOpt9ExperimentRows } from './run-opt9-experiment.mts';
import { parseCompleteJsonl, readSuccessfulTiming } from './report-opt10-wca100.mjs';
import { readWca100 } from './wasm-benchmark.mjs';
import { verify } from './benchmark.mjs';

const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../..'),BASE=resolve(ROOT,'.tmp/cubeopt-reverse');
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const save=(path:string,value:any)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
function read(path:string) {
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {const stat=fstatSync(fd);assert(stat.isFile()&&stat.size<=8*1024**2,'Expected bounded regular evidence');return readFileSync(fd);}
  finally {closeSync(fd);}
}
const json=(path:string)=>JSON.parse(read(path).toString());
function paths(candidate:string) {
  const config=opt10ExperimentConfig(candidate),prefix=resolve(BASE,config.label),dir=prefix+'-review';
  return {...config,prefix,dir,reviewPath:resolve(dir,'launch.json'),requestPath:resolve(dir,'request.json'),
    stdout:prefix+'.jsonl',stderr:prefix+'.stderr.log',exit:prefix+'-exit.json',resources:prefix+'-resources.json',
    report:prefix+'-report.json',failure:prefix+'-failure.json',started:prefix+'-started.json'};
}
export function opt10ExperimentRequest(candidate:string) {
  const p=paths(candidate);
  return {label:p.label,executable:p.executable,
    args:['solve-opt10',resolve(BASE,'opt9-generated/small-memory.bin'),resolve(BASE,'opt10-generated-v2/cuberoot-opt10.dat'),'8','20','0'],
    env:{CUBEOPT_MULTITHREAD_REVIEW:p.reviewPath,CUBEOPT_BACKEND:'opt10',CUBEOPT_SEARCH_THREADS:'16',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_MEASURE_RSS:'1'}};
}
export function opt10ExperimentReportMode(candidate:string) {
  opt10ExperimentConfig(candidate);
  return candidate==='profile'?{diagnosticOnly:true,performanceEligible:false,
    comparison:'Diagnostic counters add runtime overhead. Elapsed time is diagnostic only and must not be used for performance rankings or speedup claims. Preserved references validate optimal lengths; no fresh paired timing.'}:{};
}
function ensureFresh(p:ReturnType<typeof paths>) {
  for(const path of [p.stdout,p.stderr,p.exit,p.resources,p.report,p.failure,p.started])assert(!existsSync(path),`Already attempted; preserve ${path}`);
}
export function prepareOpt10Experiment(candidate:string) {
  assert.equal(process.platform,'darwin');const p=paths(candidate),request=opt10ExperimentRequest(candidate);
  assert(!existsSync(p.dir),'Candidate already prepared; no overwrite or retry');ensureFresh(p);
  const baseline=json(multithreadPaths.baseline),review=makeMultithreadReview(request,{boot:baseline.boot,swapouts:baseline.swapouts});
  const evidence=collectMultithreadEvidence(request);validateOpt10ExperimentContinuation(review,evidence,request,baseline);
  mkdirSync(p.dir);save(p.reviewPath,review);
  save(p.requestPath,{schema:'cuberoot.opt10-native-experiment-request.v1',candidate,reviewPath:p.reviewPath,reviewSha256:digest(read(p.reviewPath)),...request});
  return {preparedOnly:true,candidate,requestPath:p.requestPath,reviewPath:p.reviewPath};
}

export async function executeOpt10Experiment(candidate:string) {
  assert.equal(process.platform,'darwin');const p=paths(candidate),request=json(p.requestPath),review=json(p.reviewPath),expected=opt10ExperimentRequest(candidate);
  const diagnosticOnly=candidate==='profile';
  assert.equal(request.schema,'cuberoot.opt10-native-experiment-request.v1');assert.equal(request.candidate,candidate);
  assert.equal(request.reviewPath,p.reviewPath);assert.equal(request.reviewSha256,digest(read(p.reviewPath)));
  for(const field of ['label','executable','args','env'])assert.deepEqual(request[field],expected[field as keyof typeof expected]);
  const policy=multithreadPolicy(request,cpus().length),evidence=collectMultithreadEvidence(request);
  validateOpt10ExperimentContinuation(review,evidence,request,json(multithreadPaths.baseline));ensureFresh(p);
  save(p.started,{candidate,startedAt:new Date().toISOString(),requestSha256:digest(read(p.requestPath)),reviewSha256:request.reviewSha256});
  const fds:number[]=[];
  try {
    fds.push(openSync(p.stdout,'wx',0o600));fds.push(openSync(p.stderr,'wx',0o600));
    const child=spawn(process.execPath,['--experimental-strip-types',resolve(HERE,'guard.mts'),p.label,p.executable,...request.args],
      {cwd:ROOT,env:cleanRunEnvironment(request.env),stdio:['ignore',fds[0],fds[1]]});
    const stop=()=>child.kill('SIGTERM');process.once('SIGTERM',stop);process.once('SIGINT',stop);
    let error:string|undefined;
    const completion=await new Promise<any>(done=>{child.once('error',e=>{error=String(e);});child.once('close',(exitCode,signal)=>done({exitCode,signal,...(error?{error}:{}),finishedAt:new Date().toISOString()}));});
    process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);
    while(fds.length)closeSync(fds.pop()!);save(p.exit,completion);
    assert.equal(completion.exitCode,0,`Guarded Opt10 failed; retained ${p.stderr}`);assert.equal(completion.signal,null);
    const resource=json(p.resources),after=collectMultithreadEvidence(request);
    validateRunCompletion(request,review,after,resource,completion);
    const corpus=readWca100(resolve(ROOT,'solver/testdata/benchmarks/wca-first1000.json'),1000);
    assert.equal(corpus.corpusSha256,review.input.corpusSha256);
    const {cube3x3x3}=await import(pathToFileURL(resolve(ROOT,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
    const puzzle=await cube3x3x3.kpuzzle(),rows=parseCompleteJsonl(read(p.stdout).toString(),1000);
    const prior=review.opt10Experiment.original,baseline=review.opt10Experiment.baselineReference,hotpath=review.opt10Experiment.hotpathReference,coset=review.opt10Experiment.cosetReference;
    const originalRows=parseCompleteJsonl(read(prior.records['results.jsonl'].path).toString(),1000);
    const totals=validateOpt9ExperimentRows(rows,originalRows,corpus.cases,(item,row)=>verify(puzzle,item,row));
    const originalReport=json(prior.records['report.json'].path);assert.equal(totals.baseline.seconds,originalReport.totalSeconds);
    let comparison;
    if(baseline) {
      const baselineRows=parseCompleteJsonl(read(baseline.results.path).toString(),1000);
      const checked=validateOpt9ExperimentRows(rows,baselineRows,corpus.cases,(item,row)=>verify(puzzle,item,row));
      assert.equal(checked.baseline.seconds,baseline.totalSeconds);
      comparison={opt10Baseline:checked.baseline,opt10BaselineVerifiedSolutions:1000,opt10BaselineOptimalLengthsMatched:1000,
        opt10BaselineEvidence:baseline,...(diagnosticOnly?{}:{baselineOverCandidateTimeRatio:checked.baseline.seconds/totals.candidate.seconds})};
    }
    let hotpathComparison;
    if(hotpath) {
      const hotpathRows=parseCompleteJsonl(read(hotpath.results.path).toString(),1000);
      const checked=validateOpt9ExperimentRows(rows,hotpathRows,corpus.cases,(item,row)=>verify(puzzle,item,row));
      assert.equal(checked.baseline.seconds,hotpath.totalSeconds);
      hotpathComparison={hotpathReference:checked.baseline,hotpathVerifiedSolutions:1000,hotpathOptimalLengthsMatched:1000,
        hotpathReferenceEvidence:hotpath,...(diagnosticOnly?{}:{hotpathOverCandidateTimeRatio:checked.baseline.seconds/totals.candidate.seconds})};
    }
    let cosetComparison;
    if(coset) {
      const cosetRows=parseCompleteJsonl(read(coset.results.path).toString(),1000);
      const checked=validateOpt9ExperimentRows(rows,cosetRows,corpus.cases,(item,row)=>verify(puzzle,item,row));
      assert.equal(checked.baseline.seconds,coset.totalSeconds);
      cosetComparison={cosetReference:checked.baseline,cosetVerifiedSolutions:1000,cosetOptimalLengthsMatched:1000,
        cosetReferenceEvidence:coset,...(diagnosticOnly?{}:{cosetOverCandidateTimeRatio:checked.baseline.seconds/totals.candidate.seconds})};
    }
    const timing=readSuccessfulTiming(read(p.stderr).toString(),completion);assert(timing.peakRssBytes<=policy.rssLimit);
    const report={schema:'cuberoot.opt10-native-experiment-report.v1',experiment:candidate,engine:'rust-native',variant:10,
      cases:1000,threads:16,batchThreads:1,measuredPasses:1,warmupCases:0,corpusSha256:corpus.corpusSha256,
      ...totals,...comparison,...hotpathComparison,...cosetComparison,totalSeconds:totals.candidate.seconds,totalNodes:totals.candidate.nodes,totalProbes:totals.candidate.probes,
      peakRssBytes:timing.peakRssBytes,guardPeakRssBytes:resource.peakRss,machine:review.machine,table:review.table,snapshot:review.snapshot,
      build:review.opt10Experiment.build,originalReference:prior,freshPaired:false,
      comparison:candidate==='baseline'?'Opt9 historical output is an optimal-length reference only; this establishes the new Opt10 timing baseline.':coset?'Same-machine preserved Opt10 baseline, hotpath and coset under the same protocol, measured earlier; not a fresh paired run.':hotpath?'Same-machine preserved Opt10 baseline and hotpath under the same protocol, measured earlier; not a fresh paired run.':'Same-machine Opt10 baseline under the same protocol, measured earlier; not a fresh paired run.',
      reviewPath:p.reviewPath,reviewSha256:request.reviewSha256,resourcePath:p.resources,resourceSha256:digest(read(p.resources)),
      rawSha256:digest(read(p.stdout)),completedAt:new Date().toISOString(),...opt10ExperimentReportMode(candidate)};
    save(p.report,report);return report;
  } catch(error) {
    const failure={candidate,label:p.label,failedAt:new Date().toISOString(),error:String(error),reviewSha256:request.reviewSha256,partialResultsPreserved:true};
    if(!existsSync(p.failure))save(p.failure,failure);if(!existsSync(opt10ExperimentPaths.stop))save(opt10ExperimentPaths.stop,failure);throw error;
  } finally {while(fds.length)closeSync(fds.pop()!);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [mode,candidate,...extra]=process.argv.slice(2);assert.equal(extra.length,0);
  assert(['record-build','prepare','execute'].includes(mode),'Usage: run-opt10-experiment.mts record-build|prepare|execute baseline|search|hotpath|batch|dual|prefix|coset|coset-chain|coset-gated|profile|lookahead|projection');
  const result=mode==='record-build'?recordOpt10ExperimentBuild(candidate):mode==='prepare'?prepareOpt10Experiment(candidate):await executeOpt10Experiment(candidate);
  console.log(JSON.stringify(result));
}
