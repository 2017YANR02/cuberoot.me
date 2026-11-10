import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scratch = fileURLToPath(new URL('../../../.tmp/scratch/', import.meta.url));
const moduleUrl = new URL('./restart.ts', import.meta.url).href;
function fixture() { mkdirSync(scratch, { recursive: true }); return mkdtempSync(join(scratch, 'restart-')); }
test('authenticated restart stops only the registered session and allows a replacement', () => {
  const root = fixture();
  try {
    const worker = join(root, 'worker.mjs');
    writeFileSync(worker, `import {registerSession} from ${JSON.stringify(moduleUrl)}; await registerSession(${JSON.stringify(root)},()=>process.exit(0)); console.log('ready'); setInterval(()=>{},1000);`);
    const script = `
      import {spawn} from 'node:child_process'; import assert from 'node:assert/strict';
      import {restartManaged,registerSession} from ${JSON.stringify(moduleUrl)};
      const child=spawn(process.execPath,[${JSON.stringify(worker)}],{stdio:['ignore','pipe','pipe']});
      const exited=new Promise(resolve=>child.once('exit',resolve));
      try {
        await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.stderr.once('data',data=>reject(Error(String(data))));});
        await restartManaged(${JSON.stringify(root)}); assert.equal(await exited,0);
        const release=await registerSession(${JSON.stringify(root)},()=>{}); release();
      } finally { if(child.exitCode===null)child.kill(); }
    `;
    const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,HOME:root,USERPROFILE:root},timeout:15000});
    assert.equal(result.status,0,result.stderr);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
test('an unrelated port owner is neither killed nor allowed to lose its cache', {skip:process.platform==='win32'}, () => {
  const root=fixture(),client=join(root,'client');mkdirSync(join(client,'.next'),{recursive:true});
  const sentinel=join(client,'.next/keep');writeFileSync(sentinel,'keep');
  try {
    const script=`
      import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
      cp.execFileSync=(command,args)=>command==='ps'?'54321 1 python unrelated.py':args.includes('-d')?'n/another/project':'54321';
      process.kill=()=>{throw Error('Must not signal unrelated process');};syncBuiltinESMExports();
      const {clearPreviousDev}=await import(${JSON.stringify(moduleUrl)});
      await assert.rejects(clearPreviousDev(${JSON.stringify(root)},${JSON.stringify(client)}),/unrecognized service/);
      assert.equal(readFileSync(${JSON.stringify(sentinel)},'utf8'),'keep');
    `;
    const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:5000});assert.equal(result.status,0,result.stderr);
  } finally {rmSync(root,{recursive:true,force:true});}
});
