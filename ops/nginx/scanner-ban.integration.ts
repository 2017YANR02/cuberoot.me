// Run on the nginx host. Starts an isolated loopback-only nginx instance;
// never sends probe paths to the production app or changes production state.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const source = resolve(process.argv[2] || 'ops/nginx/02-scanner-ban.conf');
const dir = mkdtempSync(join(tmpdir(), 'cuberoot-scanner-check-'));
chmodSync(dir, 0o755);
mkdirSync(join(dir, 'logs'));
const journal = join(dir, 'bans.tsv');
writeFileSync(journal, `198.51.100.250\t${Math.floor(Date.now() / 1000) - 1}\n`);
// This isolated listener may run as the nginx nobody/www worker user.
chmodSync(journal, 0o666);
const policy = readFileSync(source, 'utf8').replaceAll('/var/lib/cuberoot-scanner/bans.tsv', journal);
const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const address = reservation.address();
assert(address && typeof address === 'object');
const port = address.port;
await new Promise<void>(done => reservation.close(() => done()));

// Header-based test identities exist ONLY on this private test listener.
// Production policy uses the actual connection address and existing GeoIP map.
writeFileSync(join(dir, 'nginx.conf'), `
daemon off;
worker_processes 2;
pid ${dir}/nginx.pid;
error_log ${dir}/error.log notice;
events { worker_connections 128; }
http {
  lua_package_path "/www/server/nginx/lib/lua/?.lua;;";
  access_log off;
  set_real_ip_from 127.0.0.1;
  real_ip_header X-Test-Client-IP;
  geo $remote_addr $cuberoot_cn_exempt { default 0; 113.250.213.167 1; }
  ${policy}
  server {
    listen 127.0.0.1:${port};
    server_name cuberoot.me;
    location / { content_by_lua_block { ngx.say("mock application") } }
  }
}
`);
execFileSync('nginx', ['-t', '-p', `${dir}/`, '-c', join(dir, 'nginx.conf')]);
let child = spawn('nginx', ['-p', `${dir}/`, '-c', join(dir, 'nginx.conf')], { stdio: 'ignore' });
let exited = once(child, 'exit');
let checks = 0;
function get(path: string, ip: string, host = 'cuberoot.me', headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders }>((done, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, headers: { Host: host, 'X-Test-Client-IP': ip, ...headers } }, res => {
      res.resume();
      res.on('end', () => done({ status: res.statusCode!, headers: res.headers }));
    });
    req.setTimeout(2_000, () => req.destroy(new Error('test request timeout')));
    req.on('error', reject);
    req.end();
  });
}
async function expectStatus(path: string, ip: string, status: number, host = 'cuberoot.me', headers: Record<string, string> = {}) {
  const result = await get(path, ip, host, headers);
  assert.equal(result.status, status, `${host}${path} for ${ip}`);
  checks++;
  return result;
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { await get('/ready', '127.0.0.1'); ready = true; break; } catch { await delay(50); }
  }
  assert(ready, `isolated nginx did not start; see ${dir}/error.log`);
  const probes = [
    '/.env', '/admin/.env', '/.env.production', '/.ENV.local', '/a/.env/backup',
    '/.git/config', '/.git/HEAD', '/.svn/entries', '/.hg/store',
    '/.ssh/id_rsa', '/.ssh/id_ed25519', '/.aws/credentials', '/.kube/config',
    '/.terraform/credentials.tfrc.json', '/.terraform/terraform.tfstate',
    '/wp-config.php', '/wp-config.php.bak', '/dev/phpinfo.php',
    '/etc/passwd', '/etc/shadow', '/proc/self/environ', '/proc/1/environ',
    '/%2eenv', '/%252eenv', '/%2essh/id_rsa', '/%252essh%252fid_rsa',
  ];
  for (const [index, path] of probes.entries()) {
    const ip = `198.51.100.${index + 1}`;
    await expectStatus('/healthy', ip, 200);
    const first = await expectStatus(path, ip, 403);
    assert.equal(first.headers['x-cuberoot-scanner-ban'], 'sensitive-path');
    assert.equal(first.headers['retry-after'], '2592000');
    const next = await expectStatus('/wca/comp/ordinary', ip, 403);
    assert.equal(next.headers['x-cuberoot-scanner-ban'], 'active');
  }
  const ordinary = [
    '/', '/calc', '/competition-verify', '/api/comp/Test', '/v1/auth/login',
    '/zh/dev/traffic-incident-2026-09', '/dev/security/ssh', '/.well-known/acme-challenge/test',
    '/.gitignore', '/assets/environment.js', '/a/.environment', '/dev/phpinfo',
    '/forum/t/123?text=/.env', '/search?q=/.ssh/id_rsa', '/wp-config.php-guide',
  ];
  for (const path of ordinary) await expectStatus(path, '198.51.100.100', 200);
  for (const host of ['cuberoot.me', 'www.cuberoot.me', 'next.cuberoot.me', 'api.cuberoot.me', 'static.cuberoot.me']) {
    await expectStatus('/healthy', '198.51.100.1', 403, host);
    await expectStatus('/.ssh/id_rsa', '113.250.213.167', 200, host);
    await expectStatus('/healthy', '113.250.213.167', 200, host);
  }
  await expectStatus('/healthy', '198.51.100.1', 403, 'api.cuberoot.me', {
    'X-Forwarded-For': '113.250.213.167', 'X-Real-IP': '113.250.213.167',
    'X-Cuberoot-CN-Exempt': '1', 'X-Vercel-IP-Country': 'CN',
  });
  await expectStatus('/.env', '198.51.100.200', 200, 'mira.fans');
  await expectStatus('/healthy', '198.51.100.200', 200);
  await expectStatus('/.env', '127.0.0.1', 200);
  await expectStatus('/.env', '::1', 200);
  await expectStatus('/.env', '2001:db8::123', 403);
  await expectStatus('/healthy', '2001:db8::123', 403);
  await expectStatus('/healthy', '198.51.100.250', 200);

  // A graceful reload preserves active bans across workers.
  child.kill('SIGHUP');
  await delay(150);
  await expectStatus('/healthy', '198.51.100.1', 403);
  const expiryBefore = readFileSync(journal, 'utf8');
  child.kill('SIGQUIT');
  await exited;
  child = spawn('nginx', ['-p', `${dir}/`, '-c', join(dir, 'nginx.conf')], { stdio: 'ignore' });
  exited = once(child, 'exit');
  let restarted = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { await get('/ready', '127.0.0.1'); restarted = true; break; } catch { await delay(50); }
  }
  assert(restarted, 'isolated nginx restart failed');
  await expectStatus('/healthy', '198.51.100.1', 403);
  await expectStatus('/healthy', '2001:db8::123', 403);
  await expectStatus('/healthy', '198.51.100.250', 200);
  assert.equal(readFileSync(journal, 'utf8'), expiryBefore, 'restart must not extend bans');
  const log = readFileSync(join(dir, 'error.log'), 'utf8');
  assert(!/\[error\]|\[emerg\]/.test(log), log);
  console.log(JSON.stringify({ checks, result: 'passed', evidenceDirectory: dir }));
} finally {
  child.kill('SIGQUIT');
  await Promise.race([exited, delay(3_000).then(() => { child.kill('SIGTERM'); })]);
}
