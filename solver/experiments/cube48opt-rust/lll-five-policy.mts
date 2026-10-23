/** Fixed five-case sample explicitly requested on 2026-10-23. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,lstatSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {observeStatsResources} from './stats-resume-review.mts';
import {collectZbllMultisolutionEvidence,validateZbllMultisolutionInput,zbllMultisolutionPaths} from './zbll-multisolution-policy.mts';
const root=resolve(import.meta.dirname,'../../..'), GiB=2**30;
export const dir=resolve(root,'.tmp/1lll-five-20261023');
export const label='1lll-five-20261023-opt9';
export const retryLabel=label+'-retry1';
const retryAuthorization='那你重新跑吧 现在内存应该是够的';
const runDir=(scope:string)=>{assert([label,retryLabel].includes(scope));return scope===label?dir:resolve(dir,'retry-1');};
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const read=(p:string)=>{assert(lstatSync(p).isFile()&&lstatSync(p).size<8*2**20);return readFileSync(p);};
export function request(scope=label){const currentDir=runDir(scope);return {label:scope,executable:zbllMultisolutionPaths.executable,args:['solve',zbllMultisolutionPaths.small,zbllMultisolutionPaths.table,'8','20','250000'],env:{CUBEOPT_LLL_FIVE_REVIEW:resolve(currentDir,'session.json'),CUBEOPT_BACKEND:'opt',CUBEOPT_VARIANT:'9',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_SEARCH_THREADS:'1',CUBEOPT_MEASURE_RSS:'1'}};}
export function lllFivePolicy(r:{label:string;executable:string;args:string[];env:NodeJS.ProcessEnv}){
 const e=request(r.label);assert.equal(r.label,e.label);assert.equal(r.executable,e.executable);assert.deepEqual(r.args,e.args);
 assert.deepEqual(Object.fromEntries(Object.entries(r.env).filter(([k])=>k.startsWith('CUBEOPT_'))),e.env);
 assert.equal(r.env.NODE_OPTIONS,undefined);assert.equal(r.env.NODE_PATH,undefined);
 assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
 return {entry:'native',mode:'solve',backend:'opt',variant:9,h:null,tablePath:null,tableBytes:15565455360,rssLimit:15565455360+GiB,measureNativeRss:true,deadlineMs:180000,openBenchmark:true as const,lllFive:true as const,scopeStopPath:resolve(runDir(r.label),'stop.json')};
}
function evidence(scope=label){
 const old=collectZbllMultisolutionEvidence(); // Rechecks release, table identity and unchanged historical stops.
 const priorPath=resolve(root,'.tmp/cubeopt-reverse/zbll-mcc-20261023-opt9-single-resources.json');
 const priorBytes=read(priorPath),prior=JSON.parse(priorBytes.toString());
 assert.equal(prior.stopped,'');assert.equal(prior.swapouts,prior.openBenchmarkReceipt.before.swapouts);assert.equal(prior.boot,old.setupFailure.boot);
 const exit=JSON.parse(read(resolve(root,'.tmp/zbll-mcc-20261023/single/run.json')).toString());assert.equal(exit.exitCode,0);
 const input=read(resolve(dir,'input.tsv'));const info=validateZbllMultisolutionInput(input);assert.equal(info.rows,500);
 const queries=JSON.parse(read(resolve(dir,'queries.json')).toString());assert.equal(queries.cases.length,5);assert.equal(queries.queries.length,500);
 assert.equal(input.toString(),queries.queries.map((q:any)=>`${q.id}\t${q.scramble}\n`).join(''));
 for(const c of queries.cases)assert.equal(queries.queries.filter((q:any)=>q.caseId===c.id).length,100);
 let continuation:any=undefined;
 if(scope===retryLabel){
  const paths=['session.json','receipt.json','stop.json','raw.jsonl','stderr.log','status.json'].map(f=>resolve(dir,f));
  const resourcePath=resolve(root,'.tmp/cubeopt-reverse/'+label+'-resources.json');paths.push(resourcePath);
  const records=Object.fromEntries(paths.map(p=>[p,sha(read(p))]));
  const stopped=JSON.parse(read(resourcePath).toString());const first=JSON.parse(read(resolve(dir,'session.json')).toString());
  assert.equal(stopped.boot,prior.boot);assert.equal(stopped.stopped,'Resource protection: Swapouts changed');
  assert.equal(stopped.openBenchmarkReceipt.before.swapouts,0);assert.equal(stopped.swapouts,16);assert.equal(stopped.pressure,1);
  assert.equal(stopped.trigger.details.swapouts,16);assert.equal(read(resolve(dir,'raw.jsonl')).length,0,'Resume must skip any saved successful results');
  assert.deepEqual(first.request,request(label));assert.deepEqual(first.evidence.input,info);
  assert.equal(stopped.openBenchmarkReceipt.reviewSha256,records[resolve(dir,'session.json')]);
  continuation={authorization:retryAuthorization,previousSwapouts:0,acceptedSwapouts:16,records};
 }
 return {...(continuation?{continuation}:{}),old,priorSha256:sha(priorBytes),boot:prior.boot,swapouts:continuation?16:prior.swapouts,input:info,queriesSha256:sha(read(resolve(dir,'queries.json'))),source:sha(read(resolve(import.meta.dirname,'lll-five-policy.mts')))};
}
export function validateLllFiveSession(s:any,e:any,n:any,used=false,stopped=false){
 assert(!used&&!stopped,'Five-case sample already consumed/stopped; never restart automatically');
 assert.equal(s.schema,'cuberoot.lll-five.session.v1');assert.deepEqual(s.request,request(s.request.label));assert.deepEqual(s.evidence,e);
 if(s.request.label===retryLabel){assert.equal(s.authorization,retryAuthorization);assert.equal(e.continuation?.authorization,retryAuthorization);assert.equal(e.swapouts,16);}
 assert.equal(n.boot,e.boot);assert.equal(n.swapouts,e.swapouts);assert.equal(n.pressure,1);assert(n.available>=15565455360+4*GiB);
 assert.equal(s.boot,e.boot);assert.equal(s.swapouts,e.swapouts);assert(Date.now()-Date.parse(s.preparedAt)>=0&&Date.now()-Date.parse(s.preparedAt)<86400000);
}
export function validateLllFiveReview(r:Parameters<typeof lllFivePolicy>[0],n:any){
 lllFivePolicy(r);const currentDir=runDir(r.label),b=read(resolve(currentDir,'session.json')),s=JSON.parse(b.toString()),e=evidence(r.label);
 const used=existsSync(resolve(currentDir,'receipt.json'))||existsSync(resolve(root,`.tmp/cubeopt-reverse/${r.label}-resources.json`));
 validateLllFiveSession(s,e,n,used,existsSync(resolve(currentDir,'stop.json')));
 return {input:read(resolve(dir,'input.tsv')),receiptPath:resolve(currentDir,'receipt.json'),receipt:{schema:'cuberoot.lll-five.receipt.v1',request:request(r.label),reviewSha256:sha(b),before:n,consumedAt:new Date().toISOString()}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const mode=process.argv[2];assert(['prepare','prepare-retry1'].includes(mode)&&process.argv.length===3);
 const scope=mode==='prepare-retry1'?retryLabel:label,currentDir=runDir(scope);assert(!existsSync(resolve(currentDir,'session.json')));
 const n=observeStatsResources();assert(!n.computeRunning&&!n.lockExists);
 const e=evidence(scope),s={schema:'cuberoot.lll-five.session.v1',authorization:scope===retryLabel?retryAuthorization:'用户要求快速计算五个1LLL情况，每例少量候选供人工排序校准；500次有节点预算的补全，共用一个常驻Opt9进程。',request:request(scope),evidence:e,preparedAt:new Date().toISOString(),boot:n.boot,swapouts:n.swapouts};
 validateLllFiveSession(s,e,n);mkdirSync(currentDir,{recursive:true});writeFileSync(resolve(currentDir,'session.json'),JSON.stringify(s,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({prepared:true,available:n.available,swapouts:n.swapouts}));
}
