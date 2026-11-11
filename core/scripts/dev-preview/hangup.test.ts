import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

test('terminal hangup removes the runner lock and stops its detached frontend and tunnel', { skip: process.platform === 'win32' }, () => {
  const repo = fileURLToPath(new URL('../../../', import.meta.url));
  const scratch = join(repo, '.tmp/scratch');
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, 'preview-hangup-'));
  const pub = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILX0ASs3XktuhMw0kwIYLoLbRGQZLuQq9hkafwCqDB8C';
  const signals = join(root, 'signals.json');
  try {
    writeFileSync(join(root, 'id_ed25519.pub'), pub);
    writeFileSync(join(root, 'profile.json'), JSON.stringify({ version: 1, id: 'test-pc', host: '47.97.30.181', sshPort: 22, sshUser: 'crdev-123456abcdef', localPort: 3000, remotePort: 7105, url: 'https://dev-test-pc.cuberoot.me/zh', hostKey: pub, publicKey: pub, repo }));
    const preload = join(root, 'preload.mjs');
    writeFileSync(preload, `
      import cp from 'node:child_process'; import os from 'node:os';
      import net from 'node:net';
      import { EventEmitter } from 'node:events';
      import { writeFileSync } from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const kill = process.kill.bind(process), stopped = [];
      process.kill = (pid, signal) => {
        if (![-900001, -900002].includes(pid)) throw Error('Unexpected process signal');
        stopped.push([pid, signal]);
        writeFileSync(${JSON.stringify(signals)}, JSON.stringify(stopped));
        return true;
      };
      globalThis.fetch = async () => new Response('CubeRoot');
      let probes = 0, children = 0;
      net.createConnection = () => {
        const socket = new EventEmitter(); socket.destroy = () => {}; socket.setTimeout = () => {};
        const occupied = ++probes > 2;
        queueMicrotask(() => socket.emit(occupied ? 'connect' : 'error')); return socket;
      };
      cp.execFileSync = () => '';
      cp.spawn = (command, args) => {
        const child = new EventEmitter(); child.pid = 900000 + ++children; child.exitCode = null;
        setInterval(() => {}, 1000); // A live child keeps the real runner's event loop open.
        if (children === 2) {
          if (command !== 'ssh') throw Error('Expected tunnel after frontend');
          setTimeout(() => kill(process.pid, 'SIGHUP'), 10);
        }
        return child;
      };
      os.homedir=()=>${JSON.stringify(root)}; syncBuiltinESMExports();
    `);
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, join(repo, 'core/scripts/dev-preview/client.ts'), 'run', '--id', 'test-pc', '--state', root], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(root, 'runner.pid')), false);
    assert.deepEqual(JSON.parse(readFileSync(signals, 'utf8')), [[-900002, 'SIGTERM'], [-900001, 'SIGTERM']]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
