// Device-side enrollment. Credentials stay on this computer; only its public key leaves it.
import {parseArgs} from 'node:util';
import {readFileSync,writeFileSync,existsSync,copyFileSync,mkdirSync,renameSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {publicKey,slug} from './model.ts';
import {configPath,projects,binPath,launcherPath,wrapper} from '../devsite.ts';
const {values}=parseArgs({options:{ticket:{type:'string'}}});
const ticket=values.ticket;
if(!ticket||!/^[a-f0-9]{64}$/.test(ticket))throw Error('Use the enrollment command from the onboarding page.');
const repo=resolve(import.meta.dirname,'../../..'),client=join(import.meta.dirname,'client.ts');
const api='https://api.cuberoot.me/v1/dev-preview/device';
async function call(body:unknown={}){
  const r=await fetch(api,{method:'POST',headers:{Authorization:`Bearer ${ticket}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error(`Enrollment failed (${r.status}); check your request on the onboarding page.`);
  return r.json() as Promise<{id:string;os:string;status:string;profile:unknown}>;
}
const run=(args:string[])=>execFileSync(process.execPath,[client,...args],{stdio:'inherit',timeout:120000});
const first=await call(),id=slug(first.id,59);
if(first.os!==(process.platform==='darwin'?'mac':process.platform==='win32'?'windows':'unsupported'))throw Error('The selected operating system does not match this computer.');
run(['init','--id',id]);
const dir=join(homedir(),'.cuberoot/dev-preview',id);
const key=publicKey(readFileSync(join(dir,'id_ed25519.pub'),'utf8'));
await call({publicKey:key});
console.log('Device linked. Waiting for the owner to approve on the onboarding page. Keep this terminal open.');
for(let i=0;i<720;i++){
  const r=await call();
  if(['rejected','failed'].includes(r.status))throw Error('Review the request on the onboarding page. The owner can retry failed provisioning.');
  if(r.status==='ready'){
    const file=join(dir,'connection.json');writeFileSync(file,JSON.stringify(r.profile),{mode:0o600});
    run(['configure','--id',id,'--profile',file,'--repo',repo]);
    // Preserve all other projects. Update only the same checkout's CubeRoot registration.
    const registry=projects();
    const current=registry.cuberoot;
    if(!current)throw Error('Run pnpm setup:local from core first, then repeat this same enrollment command.');
    if(resolve(current.directory)!==join(repo,'core'))throw Error('cuberoot belongs to another checkout; inspect the registry before changing it.');
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
    console.log(`Ready: ${profile.url}\nRun cuberoot. Logs stay in the terminal; Ctrl+C stops only the processes it starts.\nNo additional background startup task was installed.`);
    process.exit(0);
  }
  await new Promise(r=>setTimeout(r,10000));
}
console.log('Still waiting. Re-run the same enrollment command later; the device key is preserved.');
