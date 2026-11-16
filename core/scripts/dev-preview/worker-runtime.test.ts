import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { commandRunner, publishArtifacts, writeArtifacts } from './worker-runtime.ts';
import type { Registry } from './model.ts';

test('publishes only artifacts, preserves dirty/staged work, resumes pushes and refuses concurrent registry edits',async()=>{
  const parent=resolve(import.meta.dirname,'../../../.tmp/scratch');await mkdir(parent,{recursive:true});
  const base=await mkdtemp(join(parent,'preview-publish-')),remote=join(base,'remote'),repo=join(base,'repo'),workspace=join(base,'generated');
  await mkdir(remote);await mkdir(repo);
  const run=commandRunner(repo,new AbortController().signal);
  const git=(...args:string[])=>run('git',args);
  await run('git',['init','--bare','--initial-branch=main',remote]);await git('init','--initial-branch=main');
  await git('config','user.name','Preview Test');await git('config','user.email','preview@example.invalid');
  const registry:Registry={version:1,domain:'cuberoot.me',server:'47.97.30.181',adminSsh:'cuberoot',reservedPorts:[],machines:[]};
  await writeArtifacts(repo,registry);await writeFile(join(repo,'work.txt'),'original');await git('add','.');await git('commit','-m','base');
  await git('remote','add','origin',remote);await git('push','-u','origin','main');
  const head=await git('rev-parse','HEAD');
  await writeFile(join(repo,'work.txt'),'staged');await git('add','work.txt');await writeFile(join(repo,'work.txt'),'unstaged');
  const before=await git('status','--porcelain'),index=await git('write-tree');
  registry.machines.push({owner:'test',device:'mac',os:'mac',transport:'ssh',status:'pending',localPort:3000,remotePort:7105,certificate:'dev-test-mac',aliases:[]});
  await writeArtifacts(workspace,registry);
  let recorded='',checks=0;
  const args={run,workspace,baseSha:head,message:'preview artifacts',checkpoint:async(sha:string)=>{recorded=sha;},assertLease:async()=>{checks++;}};
  const published=await publishArtifacts(args);
  assert.equal(recorded,published);assert.equal(checks,1);
  assert.equal(await git('rev-parse','HEAD'),head);assert.equal(await git('status','--porcelain'),before);assert.equal(await git('write-tree'),index);
  assert.equal(await readFile(join(repo,'work.txt'),'utf8'),'unstaged');assert.equal(await git('show',`${published}:work.txt`),'original');
  assert.equal(await publishArtifacts({...args,previousSha:published}),published);assert.equal(checks,1);
  registry.machines[0].status='active';await writeArtifacts(workspace,registry);
  await assert.rejects(publishArtifacts(args),/registry changed/);
});

test('losing the lease aborts a running command and does not expose credential errors',async()=>{
  const abort=new AbortController(),run=commandRunner(process.cwd(),abort.signal);
  const running=run(process.execPath,['-e','setInterval(()=>{},1000)']);
  setTimeout(()=>abort.abort(),80);
  await assert.rejects(running,/Worker lease lost/);
  const safe=commandRunner(process.cwd(),new AbortController().signal);
  await assert.rejects(safe(process.execPath,['-e','console.error("Refresh token expired: private-token");process.exit(1)']),error=>{
    assert.match(String(error),/DNS login expired/);assert.doesNotMatch(String(error),/private-token/);return true;
  });
});
