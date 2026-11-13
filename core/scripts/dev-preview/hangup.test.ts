import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

for (const scenario of [
  { name: 'terminal hangup stops the frontend and tunnel', failures: [], paused: false },
  { name: 'network drop and stale port recover without stopping the frontend', failures: ['Connection closed by remote host.', 'remote port forwarding failed for listen port 7106'], paused: false },
  { name: 'persistent forwarding failure pauses without stopping the frontend', failures: Array(7).fill('remote port forwarding failed for listen port 7106'), paused: true },
  { name: 'authentication failure pauses without retrying or stopping the frontend', failures: ['Permission denied (publickey)'], paused: true },
  { name: 'host key failure pauses without retrying or stopping the frontend', failures: ['Host key verification failed'], paused: true },
]) test(scenario.name, { skip: process.platform === 'win32' }, () => {
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
      import { writeFileSync, readFileSync } from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const kill = process.kill.bind(process), stopped = [], schedule = setTimeout;
      const failures = ${JSON.stringify(scenario.failures)};
      let hangupSent = false;
      const hangup = () => { hangupSent = true; kill(process.pid, 'SIGHUP'); };
      // Exercise production retry paths without spending minutes waiting in the test.
      globalThis.setTimeout = (fn, ms, ...args) => schedule(fn, ms >= 10000 ? 1 : ms, ...args);
      process.kill = (pid, signal) => {
        if (!hangupSent) throw Error('Runner stopped a child before user hangup');
        if (pid > -900001 || pid < -(900002 + failures.length)) throw Error('Unexpected process signal');
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
        child.stderr = new EventEmitter();
        setInterval(() => {}, 1000); // A live child keeps the real runner's event loop open.
        if (children >= 2) {
          if (command !== 'ssh') throw Error('Expected tunnel after frontend');
          const failure = failures[children - 2];
          if (failure) {
            schedule(() => {
              child.stderr.emit('data', failure);
              child.exitCode = 255;
              child.emit('exit', 255);
            }, 1);
          } else {
            if (${scenario.paused}) throw Error('Unexpected retry after permanent failure');
            schedule(hangup, 10);
          }
        }
        return child;
      };
      if (${scenario.paused}) {
        const watcher = setInterval(() => {
          let log = ''; try { log = readFileSync(${JSON.stringify(join(root, 'service.log'))}, 'utf8'); } catch {}
          if (!log.includes('tunnel retries paused')) return;
          if (children !== failures.length + 1) throw Error('Wrong number of SSH attempts');
          if (!log.includes('Local frontend is still running')) throw Error('Missing local fallback');
          clearInterval(watcher); hangup();
        }, 5);
      }
      os.homedir=()=>${JSON.stringify(root)}; syncBuiltinESMExports();
    `);
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, join(repo, 'core/scripts/dev-preview/client.ts'), 'run', '--id', 'test-pc', '--state', root], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(root, 'runner.pid')), false);
    const expected = scenario.paused ? [[-900001, 'SIGTERM']] : [[-(900002 + scenario.failures.length), 'SIGTERM'], [-900001, 'SIGTERM']];
    assert.deepEqual(JSON.parse(readFileSync(signals, 'utf8')), expected);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
