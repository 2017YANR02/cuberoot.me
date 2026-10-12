// Device-side enrollment. Credentials stay on this computer; only its public key leaves it.
import {parseArgs} from 'node:util';
import {readFileSync,writeFileSync,existsSync,copyFileSync,mkdirSync,renameSync,unlinkSync,realpathSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {retry,RetryableError} from './retry.ts';
import {setTimeout as sleep} from 'node:timers/promises';
import {publicKey,slug} from './model.ts';
import {configPath,projects,binPath,launcherPath,wrapper} from '../devsite.ts';
const {values}=parseArgs({options:{ticket:{type:'string'}}});
const ticket=values.ticket;
if(!ticket||!/^[a-f0-9]{64}$/.test(ticket))throw Error('Use the enrollment command from the onboarding page.');
const repo=resolve(import.meta.dirname,'../../..'),client=join(import.meta.dirname,'client.ts');
const api='https://api.cuberoot.me/v1/dev-preview/device';
const shutdown=new AbortController();
process.once('SIGINT',()=>shutdown.abort());process.once('SIGTERM',()=>shutdown.abort());
async function call(body:unknown={}){
  return retry(async()=>{
  const r=await fetch(api,{method:'POST',headers:{Authorization:`Bearer ${ticket}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([shutdown.signal,AbortSignal.timeout(20000)])});
  if(!r.ok){
    if(r.status===408||r.status===429||r.status>=500)throw new RetryableError(`Enrollment HTTP ${r.status}`);
    throw Error(`Enrollment refused (${r.status}); check the existing request; do not create another key.`);
  }
  return r.json() as Promise<{id:string;os:string;status:string;profile:unknown;connected:boolean}>;
  },{signal:shutdown.signal,notify:ms=>console.log(`Network temporarily unavailable; retrying in ${ms/1000}s. Keep this terminal open.`)});
}
const run=(args:string[])=>execFileSync(process.execPath,[client,...args],{stdio:'inherit',timeout:120000});
const first=await call(),id=slug(first.id,59);
if(first.os!==(process.platform==='darwin'?'mac':process.platform==='win32'?'windows':'unsupported'))throw Error('The selected operating system does not match this computer.');
const dir=join(homedir(),'.cuberoot/dev-preview',id);
mkdirSync(dir,{recursive:true,mode:0o700});
const lock=join(dir,'enroll.pid');
if(existsSync(lock)){
  const pid=Number(readFileSync(lock,'utf8'));
  if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid enrollment lock; inspect before restarting');
  let alive=false;try{process.kill(pid,0);alive=true;}catch{/* stale */}
  if(alive){console.log('Enrollment is already running. Reuse that terminal.');process.exit(0);}
  unlinkSync(lock);
}
writeFileSync(lock,String(process.pid),{flag:'wx',mode:0o600});
process.once('exit',()=>{if(existsSync(lock)&&readFileSync(lock,'utf8')===String(process.pid))unlinkSync(lock);});
run(['init','--id',id]);
const key=publicKey(readFileSync(join(dir,'id_ed25519.pub'),'utf8'));
await call({publicKey:key});
console.log('Device linked. Waiting for the owner to approve on the onboarding page. Keep this terminal open.');
let lastStatus='';
while(true){
  const r=await call();
  if(r.status==='rejected')throw Error('The owner declined this request. Enrollment stopped.');
  if(r.status!==lastStatus){
    console.log(r.status==='failed'?'The owner must resolve a provisioning conflict. Waiting here; no need to reapply.':`Enrollment: ${r.status}`);
    lastStatus=r.status;
  }
  if(r.status==='ready'){
    const file=join(dir,'connection.json');writeFileSync(file,JSON.stringify(r.profile),{mode:0o600});
    run(['configure','--id',id,'--profile',file,'--repo',repo]);
    // Preserve all other projects. Update only the same checkout's CubeRoot registration.
    const registry=projects();
    const current=registry.cuberoot;
    if(!current)throw Error('Run pnpm setup:local from core first, then repeat this same enrollment command.');
    if(realpathSync(current.directory)!==realpathSync(join(repo,'core')))throw Error('cuberoot belongs to another checkout; inspect the registry before changing it.');
    const profile=JSON.parse(readFileSync(file,'utf8'));
    const backup=configPath+`.before-preview-${Date.now()}`;copyFileSync(configPath,backup);
    registry.cuberoot={directory:join(repo,'core'),url:profile.url,command:[process.execPath,client,'run','--id',id,'--open']};
    writeFileSync(configPath,JSON.stringify(registry,null,2)+'\n',{mode:0o600});
    // Migrate only this checkout's cuberoot alias; preserve the other projects and host devsite.
    mkdirSync(join(homedir(),'.local/share/devsite'),{recursive:true});
    if(existsSync(launcherPath))copyFileSync(launcherPath,launcherPath+`.backup-${Date.now()}`);
    copyFileSync(join(repo,'core/scripts/devsite.ts'),launcherPath);
    const shortcut=join(binPath,process.platform==='win32'?'cuberoot.cmd':'cuberoot');
    mkdirSync(binPath,{recursive:true});
    if(existsSync(shortcut))renameSync(shortcut,shortcut+`.backup-${Date.now()}`);
    writeFileSync(shortcut,wrapper(launcherPath).replace(process.platform==='win32'?'%*':'"$@"',process.platform==='win32'?'run cuberoot %*':'run cuberoot "$@"'),{mode:0o755,flag:'wx'});
    console.log(`Configured: ${profile.url}. Starting the existing preview runner automatically. Keep this terminal open.`);
    const runnerLock=join(dir,'runner.pid');
    let running=false;
    if(existsSync(runnerLock)){
      const pid=Number(readFileSync(runnerLock,'utf8'));
      if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid runner lock; inspect before starting');
      try{process.kill(pid,0);running=true;}catch{/* stale; runner owns cleanup */}
    }
    let stopped=false, child:ReturnType<typeof spawn>|undefined;
    const stop=()=>{stopped=true;child?.kill('SIGTERM');};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    // The existing runner owns local startup, SSH reconnection and child cleanup.
    const runningTask=running?Promise.resolve():retry(async()=>{
      if(stopped)return;
      const code=await new Promise<number|null>((resolve,reject)=>{
        child=spawn(process.execPath,[client,'run','--id',id,'--open'],{stdio:'inherit'});
        child.once('error',reject);child.once('exit',resolve);
      });
      if(stopped)return;
      if(code===75)throw new RetryableError('Temporary preview startup failure');
      throw Error('Preview runner stopped. Inspect the specific error above; keys and configuration are preserved.');
    },{signal:shutdown.signal,notify:ms=>console.log(`Retrying preview startup in ${ms/1000}s.`)});
    let runnerFailure:unknown;
    void runningTask.catch(error=>{runnerFailure=error;stopped=true;});
    let wasConnected=false;
    try{while(!stopped){
      const state=await call();
      if(state.status==='rejected')throw Error('Request declined');
      if(state.connected!==wasConnected){
        console.log(state.connected?`Verified and available: ${profile.url}`:'Connection interrupted. The runner is reconnecting; waiting for independent verification.');
        wasConnected=state.connected;
      }
      await sleep(10000,undefined,{signal:shutdown.signal});
    }}finally{stop();}
    if(runnerFailure)throw runnerFailure;
    await runningTask;
    break;
  }
  await sleep(10000,undefined,{signal:shutdown.signal});
}
