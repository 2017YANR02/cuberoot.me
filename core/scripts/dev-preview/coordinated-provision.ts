// Both operator Macs use the same durable lease and checkpoint. No Git worktree.
import { readFile, writeFile, stat, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir, hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { slug, publicKey, validate, type Registry } from './model.ts';
import { commandRunner, publishArtifacts, writeArtifacts } from './worker-runtime.ts';
import { artifacts } from './checkout.ts';
import { deploymentState } from './deployments.ts';
import { retryable, retryDelay, RetryableError } from './retry.ts';

type Checkpoint={requestId?:string;baseSha?:string;registry?:Registry;commits?:{http?:string;https?:string};retryAt?:number;attempt?:number};
type Request={id:string;owner_slug:string;device_slug:string;os:string;public_key:string;status:string};
const root=resolve(import.meta.dirname,'../../..');
const state=join(homedir(),'.config/cuberoot-preview');
const configPath=join(state,'host.json');
if((await stat(configPath)).mode&0o077)throw Error('Host config must be readable only by its owner');
const config=JSON.parse(await readFile(configPath,'utf8'));
if(root!==resolve(config.checkout)||typeof config.token!=='string'||config.token.length<32||typeof config.aliyun!=='string'||!config.dnsProfile)throw Error('Host configuration missing or checkout differs');
if(config.enabled===false){console.log('Preview worker prepared; activation is disabled.');process.exit(0);}
const abort=new AbortController();
process.once('SIGTERM',()=>abort.abort());process.once('SIGINT',()=>abort.abort());
const run=commandRunner(root,abort.signal);
const git=(...args:string[])=>run('git',args);
const workspace=join(root,'.local-data/dev-preview-worker',randomUUID());
let lease='',checkpoint:Checkpoint={},failureStage='checkout';
async function api(path:string,body?:unknown){
  if(abort.signal.aborted)throw Error('Worker lease lost');
  const response=await fetch(`https://api.cuberoot.me/v1/dev-preview/host/${path}`,{
    method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json',...(lease?{'X-Preview-Lease':lease}:{})},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]),
  });
  if(!response.ok)throw Object.assign(Error(`Queue HTTP ${response.status}`),{status:response.status});
  return response.json();
}
const save=()=>api('lease/checkpoint',checkpoint);
const renew=async()=>{try{await api('lease/renew',{});}catch{abort.abort();throw Error('Worker lease lost');}};
const wait=async(ms:number)=>{await new Promise<void>((done,reject)=>{
  const cancel=()=>{clearTimeout(timer);reject(Error('Worker lease lost'));};
  const timer=setTimeout(()=>{abort.signal.removeEventListener('abort',cancel);done();},ms);
  if(abort.signal.aborted)cancel();else abort.signal.addEventListener('abort',cancel,{once:true});
});};
const cli=(...args:string[])=>run(process.execPath,[join(root,'core/scripts/dev-preview/cli.ts'),...args,'--workspace',workspace]);
async function dns(action:string,args:string[]){return JSON.parse(await run(config.aliyun,['alidns',action,'--profile',config.dnsProfile,...args],{timeout:45000}));}
async function ensureDns(id:string){
  const rr=`dev-${id}`;
  const records=(await dns('DescribeDomainRecords',['--DomainName','cuberoot.me','--RRKeyWord',rr,'--SearchMode','COMBINATION','--PageSize','500'])).DomainRecords?.Record??[];
  if(records.length){
    if(records.length!==1||records[0].RR!==rr||records[0].Type!=='A'||records[0].Value!=='47.97.30.181'||records[0].Line!=='default'||records[0].Status!=='ENABLE')throw Error('Existing DNS conflicts; inspect without overwriting');
    return;
  }
  await renew();
  await dns('AddDomainRecord',['--DomainName','cuberoot.me','--RR',rr,'--Type','A','--Value','47.97.30.181','--Line','default','--TTL','600']);
}
async function deployments(sha:string,names:string[]){
  for(let i=0;i<120;i++){
    await git('fetch','origin','main');
    const runs=JSON.parse(await run('gh',['run','list','--branch','main','--limit','60','--json','name,status,conclusion,headSha']));
    const equivalents=new Set<string>([sha]);
    for(const candidate of new Set<string>(runs.filter((r:{name:string})=>names.includes(r.name)).map((r:{headSha:string})=>r.headSha))){
      try{await git('merge-base','--is-ancestor',sha,candidate);if(!await git('diff','--name-only',sha,candidate,'--',...artifacts))equivalents.add(candidate);}catch{/* unrelated run */}
    }
    const status=deploymentState(sha,names,runs,candidate=>equivalents.has(candidate));
    if(status==='success')return;
    if(status==='failure')throw Error('Deployment failed; inspect GitHub Actions before retry');
    await wait(15000);
  }
  throw new RetryableError('Deployment still pending');
}
async function publish(id:string,phase:'http'|'https'){
  const sha=await publishArtifacts({run,workspace,baseSha:checkpoint.baseSha!,previousSha:checkpoint.commits?.[phase],
    message:`ops: provision development preview ${id} (${phase})`,assertLease:renew,
    checkpoint:async sha=>{checkpoint.commits={...checkpoint.commits,[phase]:sha};await save();},
  });
  checkpoint.baseSha=sha;await save();return sha;
}
async function provision(r:Request){
  const id=`${slug(r.owner_slug,25)}-${slug(r.device_slug,25)}`;
  if(!['mac','windows'].includes(r.os))throw Error('Invalid OS');publicKey(r.public_key);
  if(checkpoint.requestId&&checkpoint.requestId!==r.id)throw Error('Previous provisioning needs repair before another request');
  await git('fetch','origin','main');
  if(!checkpoint.requestId){
    checkpoint={requestId:r.id,baseSha:await git('rev-parse','origin/main')};
    checkpoint.registry=validate(JSON.parse(await git('show',`${checkpoint.baseSha}:ops/dev-preview/machines.json`)));await save();
  }
  await writeArtifacts(workspace,validate(checkpoint.registry!));
  const request=join(workspace,'request.json'),profile=join(workspace,'connection.json');
  await writeFile(request,JSON.stringify({version:1,id,publicKey:r.public_key}),{mode:0o600});
  failureStage='identity';await renew();
  await cli('register','--owner',r.owner_slug,'--device',r.device_slug,'--os',r.os);
  checkpoint.registry=validate(JSON.parse(await readFile(join(workspace,artifacts[0]),'utf8')));await save();
  failureStage='authorization';await renew();
  await cli('authorize','--id',id,'--request',request,'--out',profile);
  failureStage='dns';await ensureDns(id);
  const machine=checkpoint.registry.machines.find(m=>`${m.owner}-${m.device}`===id)!;
  if(machine.status==='pending'){
    failureStage='deployment';await deployments(await publish(id,'http'),['Deploy Web Ops Config']);
    failureStage='certificate';await renew();await cli('certificate','--id',id);await cli('activate','--id',id);
    checkpoint.registry=validate(JSON.parse(await readFile(join(workspace,artifacts[0]),'utf8')));await save();
  }
  failureStage='deployment';await deployments(await publish(id,'https'),['Deploy Web Ops Config','Deploy Core','Deploy Next']);
  await cli('render','--check');
  await api(r.id,{status:'ready',profile:JSON.parse(await readFile(profile,'utf8'))});
  checkpoint={};await save();console.log(`Provisioned ${id}`);
}
let heartbeat:ReturnType<typeof setInterval>|undefined,completed=false;
try{
  // A computer with expired DNS authorization must not monopolize the queue.
  await dns('DescribeDomainRecords',['--DomainName','cuberoot.me','--PageSize','1']);
  let claimed;
  try{claimed=await api('lease',{worker:hostname().replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,100)});}catch(error){
    if((error as {status?:number}).status===409){console.log('Another operator is handling the queue.');process.exit(0);}throw error;
  }
  lease=claimed.lease;checkpoint=claimed.checkpoint;
  let renewing=false;
  heartbeat=setInterval(()=>{if(!renewing){renewing=true;void renew().catch(()=>{}).finally(()=>{renewing=false;});}},30000);
  // One-time handover preserves the pending registry/ports from the legacy worker.
  if(!checkpoint.requestId){
    const legacy=await readFile(join(state,'handover.json'),'utf8').catch(()=>null);
    if(legacy){const candidate=JSON.parse(legacy) as Checkpoint;const current=await api(candidate.requestId!);
      if(current&&!['ready','rejected'].includes(current.status)){validate(candidate.registry!);checkpoint=candidate;await save();}
    }
  }
  let canProvision=true;
  if(checkpoint.requestId){
    const current=await api(checkpoint.requestId);
    if(current?.status==='ready'){checkpoint={};await save();}
    else if(!current||['failed','rejected'].includes(current.status))canProvision=false;
  }
  const request:Request|null=canProvision?await api('next'):null;
  if(request&&Date.now()>=(checkpoint.retryAt??0)){
    await api(request.id,{status:'provisioning'});
    try{await provision(request);}catch(error){
      if(abort.signal.aborted)throw error;
      if(retryable(error)||(error as {retryable?:boolean}).retryable||/DNS login expired/.test(String(error))){
        checkpoint.attempt=(checkpoint.attempt??0)+1;checkpoint.retryAt=Date.now()+retryDelay(checkpoint.attempt-1);await save();
        console.log(`Temporary ${failureStage} failure; progress saved for either computer.`);
      }else{await api(request.id,{status:'failed',failureCode:failureStage});throw error;}
    }
  }
  const health=await api('health-next');
  if(health){
    await git('fetch','origin','main');
    await writeArtifacts(workspace,validate(JSON.parse(await git('show','origin/main:ops/dev-preview/machines.json'))));
    let connected=false;try{await cli('verify','--id',`${slug(health.owner_slug,25)}-${slug(health.device_slug,25)}`);connected=true;}catch{/* only verified pages count */}
    await api(`${health.id}/health`,{connected});
  }
  completed=true;
}catch(error){console.error((error as Error).message);process.exitCode=1;}
finally{
  clearInterval(heartbeat);
  if(lease&&!abort.signal.aborted)await api('lease/release',{}).catch(()=>{});
  abort.abort();
  // Successful generated copies are reproducible from the shared checkpoint/Git.
  // Failed runs retain their own directory for diagnosis; never touch another run.
  if(completed)await rm(workspace,{recursive:true,force:true});
}
