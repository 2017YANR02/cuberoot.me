/** Explicit Opt9-only 1000/16 local protocol. Sequential, one pass, no warmup or retries. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeMultithreadReview, collectMultithreadEvidence, multithreadPaths } from './multithread-policy.mts';
import { cleanRunEnvironment, validateRunCompletion } from './run-multithread.mts';
import { readWca100, validateSharedDepthResults } from './wasm-benchmark.mjs';
import { parseCompleteJsonl, readSuccessfulTiming } from './report-opt10-wca100.mjs';
import { verify } from './benchmark.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..'), BASE = resolve(ROOT, '.tmp/cubeopt-reverse');
const save = (p: string, v: any) => writeFileSync(p, JSON.stringify(v,null,2)+'\n', {flag:'wx'});
const json = (p: string) => JSON.parse(readFileSync(p,'utf8'));
const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const engine = process.argv[2];
assert(['original-wasm','rust-native','rust-wasm'].includes(engine));
const label = `wca1000-mt16-${engine}-opt9`, prefix = resolve(BASE,label), reviewDir = prefix+'-review';
assert(!existsSync(reviewDir) && !existsSync(prefix+'-resources.json') && !existsSync(prefix), 'Already prepared or consumed; never retry implicitly');
const reviewPath = resolve(reviewDir,'launch.json');
const env: NodeJS.ProcessEnv = {CUBEOPT_MULTITHREAD_REVIEW:reviewPath,CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_BACKEND:'opt',CUBEOPT_VARIANT:'9'};
const small = resolve(BASE,'opt9-generated/small-memory.bin'), table = resolve(BASE,'opt9-generated/h48prun31h9.dat');
let executable = multithreadPaths.native, args = ['solve',small,table,'8','20','0'];
if(engine === 'rust-native') Object.assign(env,{CUBEOPT_SEARCH_THREADS:'16',CUBEOPT_MEASURE_RSS:'1'});
else {
  executable = process.execPath;
  args = [resolve(HERE,'wasm-benchmark.mjs'),'--variant','9','--engine',engine === 'original-wasm' ? 'original' : 'rust',
    '--threads','16','--cases','1000','--table',table,'--small',small,'--wasm',resolve(BASE,'rust-wasm-shared-builds/build-KGlaGt/cube48opt-rust8.wasm'),'--out',prefix];
}
const corpus = readWca100(resolve(ROOT,'solver/testdata/benchmarks/wca-first1000.json'),1000);
const originalPrefix = resolve(BASE,'wca1000-mt16-original-wasm-opt9');
// A program failure in another engine does not invalidate this independent run.
// Only completed, independently replayed rows can be used as reference lengths.
const request = {label,executable,args,env};
const baseline = json(multithreadPaths.baseline);
const review: any = makeMultithreadReview(request,{boot:baseline.boot,swapouts:baseline.swapouts});
const failed = json(multithreadPaths.stop);
review.continuation = {stopSha256:hash(multithreadPaths.stop),resourcesSha256:hash(resolve(BASE,failed.label+'-resources.json')),
  reason:'User explicitly requested a new three-engine Opt9 benchmark: first 1000 WCA records, 16 threads, one pass without warmup. Previous WASM bounds panic is preserved as a program failure, not cleared; no swap baseline reset or implicit retries.'};
mkdirSync(reviewDir);
save(reviewPath,review);
const prepared = {schema:'cuberoot.multithread-wca1000-request.v1',reviewPath,reviewSha256:hash(reviewPath),...request};
save(resolve(reviewDir,'request.json'),prepared);
const stdout = prefix+(engine === 'rust-native' ? '.jsonl' : '.stdout.log'), stderr = prefix+'.stderr.log';
const fds = [openSync(stdout,'wx'),openSync(stderr,'wx')];
const child = spawn(process.execPath,['--experimental-strip-types',resolve(HERE,'guard.mts'),label,executable,...args],
  {cwd:ROOT,env:cleanRunEnvironment(env as Record<string,string>),stdio:['ignore',...fds]});
const stop = () => child.kill('SIGTERM'); process.once('SIGTERM',stop); process.once('SIGINT',stop);
const exit = await new Promise<any>(done => {child.once('error',error => done({exitCode:null,signal:null,error:String(error)}));child.once('close',(exitCode,signal)=>done({exitCode,signal}));});
exit.finishedAt = new Date().toISOString();
for(const fd of fds) closeSync(fd);
save(prefix+'-exit.json',exit);
process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);
assert.equal(exit.exitCode,0,`Run failed; retained ${stderr}`);
const resource = json(prefix+'-resources.json'), evidence = collectMultithreadEvidence(request);
validateRunCompletion(prepared,review,evidence,resource,exit);
const {cube3x3x3} = await import(pathToFileURL(resolve(ROOT,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
const puzzle = await cube3x3x3.kpuzzle();
const rows = parseCompleteJsonl(readFileSync(engine==='rust-native'?stdout:resolve(prefix,engine==='original-wasm'?'original':'rust','results.jsonl'),'utf8'),1000);
const referencePath = resolve(originalPrefix,'original/results.jsonl');
const referenceText = engine === 'original-wasm' || !existsSync(referencePath) ? '' : readFileSync(referencePath,'utf8');
const reference = referenceText ? parseCompleteJsonl(referenceText, referenceText.trimEnd().split('\n').length) : [];
assert(reference.length <= 1000);
let seconds = 0;
for(const [i,c] of corpus.cases.entries()) {
  const r=rows[i];assert.equal(r.id,c.id);assert.equal(r.threads,16);assert(Number.isFinite(r.seconds)&&r.seconds>=0);
  verify(puzzle,c,r); seconds+=r.seconds;
  if(reference[i]){assert.equal(reference[i].id,c.id);verify(puzzle,c,reference[i]);assert.equal(r.length,reference[i].length);}
  if(engine==='rust-native'){assert.equal(r.cancelled,false);assert.equal(r.completed_depth,r.length-1);assert.equal(r.batch_threads,1);assert.equal(r.contexts,8);}
  else {assert.equal(r.verified,true);if(engine==='rust-wasm')validateSharedDepthResults(r.search,16);}
}
const peakRssBytes = engine==='rust-native' ? readSuccessfulTiming(readFileSync(stderr,'utf8'),exit).peakRssBytes : json(resolve(prefix,engine==='original-wasm'?'original':'rust','report.json')).peakRssBytes;
assert(Number.isFinite(peakRssBytes)&&peakRssBytes>0);
const report = {schema:'cuberoot.opt9.wca1000-mt16-report.v1',engine,cases:1000,threads:16,measuredPasses:1,warmupCases:0,
  corpusSha256:corpus.corpusSha256,totalSeconds:seconds,peakRssBytes,verifiedSolutions:1000,
  originalLengthsMatched:reference.length,tableBytes:review.table.bytes,reviewPath,resourcePath:prefix+'-resources.json',
  machine:review.machine,completedAt:new Date().toISOString()};
save(prefix+'-report.json',report);console.log(JSON.stringify(report));
