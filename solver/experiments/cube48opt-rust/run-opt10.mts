#!/usr/bin/env node
/** Official native Opt10. Default/check is read-only; run needs a fresh review. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { openSync, closeSync, existsSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyOpt10Release } from './opt10-release.mts';
import { officialArgs, officialPaths, officialPolicy, officialScope, officialDigest, readOfficialRecord, officialHasStop } from './opt10-official-policy.mts';

const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../..'),BASE=resolve(ROOT,'.tmp/cubeopt-reverse');
const save=(path:string,value:unknown)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
export function checkOfficialOpt10() {
  const r=verifyOpt10Release();
  return {release:r.manifest.id,status:'official',executable:r.executable,sha256:r.manifest.executable.sha256,
    threads:16,contexts:8,benchmarkSeconds:r.manifest.benchmark.seconds,verifiedSnapshotFiles:r.verifiedFiles,
    engineStarted:false,executionRequiresFreshReview:true,inputScope:'Existing fixed WCA1000 only; other inputs are not authorized by this entry'};
}
export function officialRunRequest(reviewPath:string,review:any) {
  assert.equal(review.schema,'cuberoot.opt10-official-solve-review.v1');assert.equal(review.scope,officialScope);
  assert.equal(reviewPath,resolve(officialPaths.reviews,`${review.label}.json`));
  const request={label:review.label,executable:officialPaths.executable,args:[...officialArgs],env:{
    CUBEOPT_OPT10_OFFICIAL_REVIEW:reviewPath,CUBEOPT_BACKEND:'opt10',CUBEOPT_SEARCH_THREADS:'16',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_MEASURE_RSS:'1'}};
  officialPolicy(request,availableParallelism());
  assert.deepEqual([review.executable,review.args],[request.executable,request.args]);
  return request;
}
export async function runOfficialOpt10(reviewPath:string) {
  checkOfficialOpt10();assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
  const reviewBytes=readOfficialRecord(reviewPath),review=JSON.parse(reviewBytes.toString()),request=officialRunRequest(reviewPath,review);
  assert(!officialHasStop(),'A protected run failed; preserve the stop and review before continuing');
  assert(!existsSync(resolve(officialPaths.receipts,`${request.label}.json`)),'Official review already consumed');
  const prefix=resolve(BASE,request.label),stdout=prefix+'.jsonl',stderr=prefix+'.stderr.log',exit=prefix+'-exit.json';
  for(const suffix of ['.jsonl','.stderr.log','-exit.json','-resources.json','-started.json'])assert(!existsSync(prefix+suffix),'Run label already attempted');
  const env={...process.env};
  for(const key of Object.keys(env))if(key.startsWith('CUBEOPT_')||key==='NODE_OPTIONS'||key==='NODE_PATH')delete env[key];
  Object.assign(env,request.env);
  const fds:number[]=[];
  try {
    fds.push(openSync(stdout,'wx',0o600));fds.push(openSync(stderr,'wx',0o600));
    save(prefix+'-started.json',{label:request.label,reviewPath,reviewSha256:officialDigest(reviewBytes),startedAt:new Date().toISOString()});
    const child=spawn(process.execPath,['--experimental-strip-types',resolve(HERE,'guard.mts'),request.label,request.executable,...request.args],
      {cwd:ROOT,env,stdio:['ignore',fds[0],fds[1]]});
    const stop=()=>child.kill('SIGTERM');process.once('SIGINT',stop);process.once('SIGTERM',stop);
    let error:string|undefined;
    const completion=await new Promise<{exitCode:number|null;signal:string|null;finishedAt:string;error?:string}>(done=>{
      child.once('error',e=>{error=String(e);});
      child.once('close',(exitCode,signal)=>done({exitCode,signal,finishedAt:new Date().toISOString(),...(error?{error}:{})}));
    });
    process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
    while(fds.length)closeSync(fds.pop()!);save(exit,completion);
    assert.equal(completion.exitCode,0,`Guard did not succeed; retained ${stderr}`);assert.equal(completion.signal,null);
    const resourcePath=prefix+'-resources.json',resource=JSON.parse(readOfficialRecord(resourcePath).toString());
    assert.equal(resource.stopped,'');assert.equal(resource.trigger,null);
    assert.equal(resource.officialReviewReceipt?.reviewSha256,officialDigest(reviewBytes));
    assert.equal(resource.officialReviewReceipt.executableSha256,review.executableSha256);
    return {release:review.releaseSha256,engineStarted:true,guardExitCode:0,stdout,stderr,exit,resources:resourcePath,
      performanceReportCreated:false};
  } finally {while(fds.length)closeSync(fds.pop()!);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [mode='check',flag,path,...extra]=process.argv.slice(2);assert.equal(extra.length,0);
  assert(mode==='check'&&!flag&&!path||mode==='run'&&flag==='--review'&&path,
    'Usage: run-opt10.mts [check] | run --review ABSOLUTE_REVIEW_JSON; no new review or solver run is created by check');
  console.log(JSON.stringify(mode==='check'?checkOfficialOpt10():await runOfficialOpt10(path),null,2));
}
