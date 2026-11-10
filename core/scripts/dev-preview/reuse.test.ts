import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = join(repo, '.tmp/scratch');
const pub = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILX0ASs3XktuhMw0kwIYLoLbRGQZLuQq9hkafwCqDB8C';

// Run the actual entrypoints with isolated state and fake health/browser operations.
// Any new server, tunnel or destructive signal fails the test.
for (const scenario of [
  { name: 'SSH reuse opens the preview and preserves a live PID lock', ssh: true, local: true, remote: true, ok: true },
  { name: 'SSH reuse rejects an unhealthy local service without changing the lock', ssh: true, local: false, remote: true, ok: false },
  { name: 'SSH reuse reports a broken tunnel without spawning another runner', ssh: true, local: true, remote: false, ok: false },
  { name: 'FRP reuse opens the registered URL without starting or stopping a server', ssh: false, local: true, remote: true, ok: true },
  { name: 'FRP reuse reports an unavailable preview', ssh: false, local: true, remote: false, ok: false },
]) test(scenario.name, () => {
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, 'preview-reuse-'));
  const url = 'https://dev-test-pc.cuberoot.me/zh';
  const lock = join(root, 'runner.pid');
  const browser = join(root, 'browser.json');
  try {
    writeFileSync(lock, String(process.pid)); // Deliberately not a runner: reuse must never signal this PID.
    writeFileSync(join(root, 'id_ed25519.pub'), pub);
    writeFileSync(join(root, 'profile.json'), JSON.stringify({ version: 1, id: 'test-pc', host: '47.97.30.181', sshPort: 22, sshUser: 'crdev-123456abcdef', localPort: 3000, remotePort: 7105, url, hostKey: pub, publicKey: pub, repo }));
    const preload = join(root, 'preload.mjs');
    writeFileSync(preload, `
      import cp from 'node:child_process';
      import net from 'node:net';
      import { EventEmitter } from 'node:events';
      import { writeFileSync } from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      globalThis.fetch = async url => new Response('CubeRoot', {status: String(url).startsWith('http://127.') ? ${scenario.local ? 200 : 503} : ${scenario.remote ? 200 : 502}});
      cp.spawn = (command, args) => {
        if (!['open', 'rundll32.exe'].includes(command)) throw Error('Unexpected child process: ' + command);
        writeFileSync(${JSON.stringify(browser)}, JSON.stringify(args));
        return new EventEmitter();
      };
      cp.execFileSync = (command) => {
        if (command === 'whoami.exe') return 'test-user';
        if (command === 'icacls.exe') return '';
        throw Error('Unexpected executable: ' + command);
      };
      net.createConnection = () => {
        const socket = new EventEmitter(); socket.destroy = () => {}; socket.setTimeout = () => {};
        queueMicrotask(() => socket.emit('connect')); return socket;
      };
      const kill = process.kill;
      process.kill = (pid, signal) => { if (signal !== 0) throw Error('Unexpected signal'); return kill(pid, signal); };
      syncBuiltinESMExports();
    `);
    const args = scenario.ssh
      ? [join(repo, 'core/scripts/dev-preview/client.ts'), 'run', '--id', 'test-pc', '--state', root, '--open']
      : [join(repo, 'core/scripts/local-dev.mts'), '--url', url, '--reuse'];
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, scenario.ok ? 0 : 1, result.stderr);
    assert.doesNotMatch(result.stderr, /MODULE_TYPELESS_PACKAGE_JSON/);
    assert.equal(readFileSync(lock, 'utf8'), String(process.pid));
    assert.equal(existsSync(browser), scenario.ok);
    if (scenario.ok) {
      assert.match(result.stdout, /Reusing the running CubeRoot server/);
      assert.equal(JSON.parse(readFileSync(browser, 'utf8')).at(-1), url);
    } else assert.match(result.stderr, scenario.local ? /preview is unavailable/ : /not serving a healthy CubeRoot/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
