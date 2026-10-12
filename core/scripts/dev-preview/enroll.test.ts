import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

// Exercise the real enrollment process with an isolated home, API and child runner.
// No live account, ticket, SSH, DNS, local development server or shell profile is used.
test('one enrollment survives network and provisioning failure, then starts once and waits for verified health', { timeout: 15000, skip: process.platform !== 'darwin' }, async () => {
  const root=mkdtempSync(join(tmpdir(),'cuberoot-enroll-'));
  const scripts=join(root,'core/scripts/dev-preview'),home=join(root,'home');
  mkdirSync(scripts,{recursive:true});mkdirSync(home);
  writeFileSync(join(root,'package.json'),'{"type":"module"}');
  for(const name of ['enroll.ts','retry.ts','model.ts'])copyFileSync(new URL(name,import.meta.url),join(scripts,name));
  writeFileSync(join(root,'core/scripts/devsite.ts'),`
    import {readFileSync} from 'node:fs';
    export const configPath=${JSON.stringify(join(home,'projects.json'))};
    export const projects=()=>JSON.parse(readFileSync(configPath,'utf8'));
    export const binPath=${JSON.stringify(join(home,'bin'))};
    export const launcherPath=${JSON.stringify(join(home,'launcher.ts'))};
    export const wrapper=()=> 'node launcher run "$@" %*';
  `);
  writeFileSync(join(home,'projects.json'),JSON.stringify({cuberoot:{directory:join(root,'core')},other:{directory:'keep'}}));
  const pub='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILX0ASs3XktuhMw0kwIYLoLbRGQZLuQq9hkafwCqDB8C';
  writeFileSync(join(scripts,'client.ts'),`
    import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs';
    const dir=${JSON.stringify(join(home,'.cuberoot/dev-preview/test-pc'))};
    mkdirSync(dir,{recursive:true});
    const command=process.argv[2];
    appendFileSync(${JSON.stringify(join(root,'commands'))},command+'\\n');
    if(command==='init')writeFileSync(dir+'/id_ed25519.pub',${JSON.stringify(pub)});
    if(command==='run'){
      writeFileSync(${JSON.stringify(join(root,'running'))},'yes');
      setInterval(()=>{},1000);
      process.once('SIGTERM',()=>process.exit(0));
    }
  `);
  const preload=join(root,'preload.mjs');
  writeFileSync(preload,`
    import os from 'node:os';import timers from 'node:timers/promises';
    import {syncBuiltinESMExports} from 'node:module';import {existsSync} from 'node:fs';
    os.homedir=()=>${JSON.stringify(home)};
    const delay=timers.setTimeout;timers.setTimeout=(ms,...args)=>delay(Math.min(ms,5),...args);
    syncBuiltinESMExports();
    let count=0;
    globalThis.fetch=async()=>{
      count++;
      if(count===1)throw new TypeError('fetch failed',{cause:Object.assign(new Error('offline'),{code:'ECONNRESET'})});
      const status=count<4?'preparing':count===4?'failed':count===5?'provisioning':'ready';
      const connected=existsSync(${JSON.stringify(join(root,'running'))});
      return new Response(JSON.stringify({id:'test-pc',os:process.platform==='darwin'?'mac':'windows',status,connected,profile:{url:'https://dev-test-pc.cuberoot.me/zh'}}));
    };
  `);
  const child=spawn(process.execPath,['--import',pathToFileURL(preload).href,join(scripts,'enroll.ts'),'--ticket','a'.repeat(64)],{stdio:['ignore','pipe','pipe']});
  let output='';child.stdout!.on('data',chunk=>{output+=chunk;});child.stderr!.on('data',chunk=>{output+=chunk;});
  const closed=new Promise<void>(resolve=>child.once('exit',()=>resolve()));
  try{
    const end=Date.now()+10000;
    while(!output.includes('Verified and available:')&&child.exitCode===null&&Date.now()<end)await new Promise(r=>setTimeout(r,20));
    assert.match(output,/Network temporarily unavailable/);
    assert.match(output,/owner must resolve a provisioning conflict/);
    assert.match(output,/Verified and available:/);
    assert.equal(readFileSync(join(root,'commands'),'utf8'),'init\nconfigure\nrun\n');
    assert.deepEqual(JSON.parse(readFileSync(join(home,'projects.json'),'utf8')).other,{directory:'keep'});
    assert.equal(existsSync(join(home,'.cuberoot/dev-preview/test-pc/enroll.pid')),true);
  }finally{
    child.kill('SIGTERM');await closed;
    rmSync(root,{recursive:true,force:true});
  }
});
