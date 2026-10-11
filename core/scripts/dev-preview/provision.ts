// Run from a dedicated checkout, never the maintainer's working directory.
// Only owner-approved queue entries reach the existing preview management CLI.
import {readFileSync,writeFileSync,existsSync,mkdirSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {slug,publicKey} from './model.ts';
const root=resolve(import.meta.dirname,'../../..');
const config=JSON.parse(readFileSync(join(homedir(),'.config/cuberoot-preview/host.json'),'utf8'));
if(root!==resolve(config.checkout)||root===resolve(homedir(),'Documents/cuberoot.me'))throw Error('Use the dedicated provisioning checkout.');
if(typeof config.token!=='string'||config.token.length<32||typeof config.aliyun!=='string'||!config.dnsProfile)throw Error('Host configuration missing');
const state=join(homedir(),'.config/cuberoot-preview');
mkdirSync(state,{recursive:true,mode:0o700});
const lock=join(state,'worker.pid');
if(existsSync(lock)){
  const pid=Number(readFileSync(lock,'utf8'));
  if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid worker lock');
  let alive=false;try{process.kill(pid,0);alive=true;}catch{/* stale */}
  if(alive)throw Error('Provisioning worker already running');unlinkSync(lock);
}
writeFileSync(lock,String(process.pid),{flag:'wx',mode:0o600});
const run=(command:string,args:string[],timeout=180000)=>execFileSync(command,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:4*1024*1024});
const git=(...args:string[])=>run('git',args).trim();
const cli=(...args:string[])=>run(process.execPath,[join(root,'core/scripts/dev-preview/cli.ts'),...args]);
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function api(path:string,body?:unknown){
  const r=await fetch(`https://api.cuberoot.me/v1/dev-preview/host/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error(`Queue HTTP ${r.status}`);return r.json();
}
function dns(action:string,args:string[]){return JSON.parse(run(config.aliyun,['alidns',action,'--profile',config.dnsProfile,...args],45000));}
function ensureDns(id:string){
  const rr=`dev-${id}`;
  const records=dns('DescribeDomainRecords',['--DomainName','cuberoot.me','--RRKeyWord',rr,'--SearchMode','EXACT','--PageSize','500']).DomainRecords?.Record??[];
  if(records.length){if(records.length!==1||records[0].RR!==rr||records[0].Type!=='A'||records[0].Value!=='47.97.30.181'||records[0].Line!=='default'||records[0].Status!=='ENABLE')throw Error('Existing DNS conflicts; inspect without overwriting');return;}
  dns('AddDomainRecord',['--DomainName','cuberoot.me','--RR',rr,'--Type','A','--Value','47.97.30.181','--Line','default','--TTL','600']);
}
const artifacts=['ops/dev-preview/machines.json','ops/nginx/dev-machines.conf','core/packages/shared/src/dev-preview.ts'];
function publish(id:string,phase:string){
  const checkpoint=join(state,`${id}-${phase}.sha`);
  const changed=run('git',['status','--porcelain','--untracked-files=no']).split('\n').filter(Boolean).map(s=>s.slice(3));
  if(changed.some(f=>!artifacts.includes(f)))throw Error('Unexpected changed files in provisioning checkout');
  git('add','--',...artifacts);
  const changedIndex=git('diff','--cached','--name-only');
  if(!changedIndex && existsSync(checkpoint)) return readFileSync(checkpoint,'utf8');
  if(!changedIndex) throw Error('No deployment checkpoint; inspect existing machine before onboarding');
  git('commit','-m',`ops: provision development preview ${id}`);
  git('fetch','origin','main');git('rebase','origin/main');
  const sha=git('rev-parse','HEAD');
  git('push','origin','HEAD:refs/heads/main');writeFileSync(checkpoint,sha,{mode:0o600});return sha;
}
async function deployments(sha:string,names:string[]){
  for(let i=0;i<120;i++){
    const runs=JSON.parse(run('gh',['run','list','--commit',sha,'--limit','30','--json','name,status,conclusion']));
    if(names.every(name=>runs.some((r:{name:string;conclusion:string})=>r.name===name&&r.conclusion==='success')))return;
    if(runs.some((r:{name:string;status:string;conclusion:string})=>names.includes(r.name)&&r.status==='completed'&&r.conclusion!=='success'))throw Error('Deployment failed; inspect GitHub Actions before retry');
    await delay(15000);
  }
  throw Error('Deployment still pending; owner can retry after inspecting Actions');
}
async function provision(r:{id:string;owner_slug:string;device_slug:string;os:string;public_key:string}){
  const owner=slug(r.owner_slug,25),device=slug(r.device_slug,25),id=`${owner}-${device}`;
  if(!['mac','windows'].includes(r.os))throw Error('Invalid OS');publicKey(r.public_key);
  const request=join(state,`${r.id}.request.json`),profile=join(state,`${r.id}.connection.json`);
  writeFileSync(request,JSON.stringify({version:1,id,publicKey:r.public_key}),{mode:0o600});
  // Resume only this request after failures; never mix partially generated machines.
  const active=join(state,'active-request');
  if(existsSync(active)&&readFileSync(active,'utf8')!==r.id)throw Error('Previous provisioning needs repair before another request');
  writeFileSync(active,r.id,{mode:0o600});
  if(!git('status','--porcelain')){git('fetch','origin','main');git('merge','--ff-only','origin/main');}
  cli('register','--owner',owner,'--device',device,'--os',r.os);
  cli('authorize','--id',id,'--request',request,'--out',profile);
  ensureDns(id);
  const registry=JSON.parse(readFileSync(join(root,artifacts[0]),'utf8'));
  const machine=registry.machines.find((m:{owner:string;device:string})=>`${m.owner}-${m.device}`===id);
  if(machine.status==='pending'){
    const sha=publish(id,'http');await deployments(sha,['Deploy Web Ops Config']);
    cli('certificate','--id',id);cli('activate','--id',id);
  }
  const sha=publish(id,'https');
  await deployments(sha,['Deploy Web Ops Config','Deploy Core','Deploy Next']);
  cli('render','--check');
  // A disconnected employee cannot pass page verification yet. Report infrastructure
  // ready, not a connected/verified workstation. client.ts check verifies after startup.
  await api(r.id,{status:'ready',profile:JSON.parse(readFileSync(profile,'utf8'))});
  unlinkSync(active);
}
try{
  const request=await api('next');
  if(request){
    await api(request.id,{status:'provisioning'});
    try{await provision(request);console.log(`Provisioned ${request.id}`);}
    catch(error){await api(request.id,{status:'failed'});throw error;}
  }
}finally{unlinkSync(lock);}
