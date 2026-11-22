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
      cp.execFileSync=(command,args)=>command==='ps'?process.getuid()+' 54321 1 Sun Nov 22 02:59:26 2026 python unrelated.py':args.includes('-d')?'n/another/project':'54321';
      process.kill=()=>{throw Error('Must not signal unrelated process');};syncBuiltinESMExports();
      const {clearPreviousDev}=await import(${JSON.stringify(moduleUrl)});
      await assert.rejects(clearPreviousDev(${JSON.stringify(root)},${JSON.stringify(client)}),/unrecognized service/);
      assert.equal(readFileSync(${JSON.stringify(sentinel)},'utf8'),'keep');
    `;
    const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:5000});assert.equal(result.status,0,result.stderr);
  } finally {rmSync(root,{recursive:true,force:true});}
});

for (const lateListener of [false, true]) test(
  lateListener ? 'rechecks ownership when Next starts listening after the first scan' : 'stops only this checkout’s watcher before Next listens',
  { skip: process.platform === 'win32' }, () => {
    const root = fixture(), client = join(root, 'client');
    mkdirSync(join(client, '.next'), { recursive: true });
    try {
      const script = `
        import assert from 'node:assert/strict';
        import cp from 'node:child_process';
        import fs from 'node:fs';
        import net from 'node:net';
        import { EventEmitter } from 'node:events';
        import { syncBuiltinESMExports } from 'node:module';
        const root = fs.realpathSync(${JSON.stringify(root)}), client = fs.realpathSync(${JSON.stringify(client)});
        const uid = process.getuid();
        const late = ${lateListener}, stopped = [];
        const watch = '/bin/turbo watch dev:serve --filter=@cuberoot/client';
        const rows = new Map([[54321, [1, watch, root]], [54322, [1, watch, '/other/checkout']]]);
        if (late) rows.set(54323, [1, 'node /repo/next dev -p 3000', client]);
        let scans = 0;
        const realpath = fs.realpathSync;
        fs.realpathSync = path => path.startsWith('/proc/') ? rows.get(Number(path.split('/')[2]))?.[2] : realpath(path);
        cp.execFileSync = (command, args, options) => {
          if (command === 'ps') {
            const started = options?.env?.LC_ALL === 'C' ? 'Sun Nov 22 02:59:26 2026' : '日 11月/22 02:59:26 2026';
            return [...rows].filter(([pid]) => !late || scans > 1 || pid === 54322)
              .map(([pid, [parent, cmd]]) => [uid, pid, parent, started, cmd].join(' ')).join('\\n');
          }
          if (args.includes('-d')) return 'n' + rows.get(Number(args[args.indexOf('-p') + 1]))?.[2];
          return ++scans > 1 && rows.has(54323) ? '54323' : '';
        };
        net.createConnection = () => {
          const socket = new EventEmitter(); socket.destroy = () => {}; socket.setTimeout = () => {};
          queueMicrotask(() => socket.emit(rows.has(54323) ? 'connect' : 'error'));
          return socket;
        };
        process.kill = (pid, signal) => {
          if (!rows.has(pid)) throw Object.assign(Error('gone'), { code: 'ESRCH' });
          assert.equal(signal, 'SIGTERM'); stopped.push(pid); rows.delete(pid);
        };
        syncBuiltinESMExports();
        const { clearPreviousDev } = await import(${JSON.stringify(moduleUrl)});
        await clearPreviousDev(root, client);
        assert.deepEqual(stopped, late ? [54323, 54321] : [54321]);
        assert.equal(rows.has(54322), true);
        assert.equal(fs.existsSync(client + '/.next'), false);
      `;
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8', env: { ...process.env, LC_ALL: 'zh_CN.UTF-8' }, timeout: 5000,
      });
      assert.equal(result.status, 0, result.stderr);
    } finally { rmSync(root, { recursive: true, force: true }); }
  },
);

test('only an orphaned tunnel with the expected command is stopped', { skip: process.platform === 'win32' }, () => {
  const script = `
    import assert from 'node:assert/strict';
    import cp from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const started = 'Sun Nov 22 02:59:26 2026';
    const args = ['-NT', '-R', '127.0.0.1:7106:127.0.0.1:3000', 'preview'];
    const command = ['ssh', ...args].join(' ');
    const rows = new Map([[54321, [1, command]], [54322, [2, command]], [54323, [1, command + '-other']]]);
    cp.execFileSync = () => [...rows].map(([pid, [parent, cmd]]) => [process.getuid(), pid, parent, started, cmd].join(' ')).join('\\n');
    process.kill = (pid, signal) => {
      if (!rows.has(pid)) throw Object.assign(Error('gone'), { code: 'ESRCH' });
      assert.equal(signal, 'SIGTERM'); assert.equal(pid, 54321); rows.delete(pid);
    };
    syncBuiltinESMExports();
    const { stopOrphanedPreviewTunnel } = await import(${JSON.stringify(moduleUrl)});
    await stopOrphanedPreviewTunnel(args);
    assert.deepEqual([...rows.keys()], [54322, 54323]);
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
});
