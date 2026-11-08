// Isolated loopback listeners; never reloads or signals the production nginx.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';

const source = readFileSync(process.argv[2] || 'ops/nginx/www.cuberoot.me.conf', 'utf8');
function block(marker: string) {
  const start = source.indexOf(marker);
  assert(start >= 0, marker);
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error('Unclosed nginx block');
}
let peerCalls = 0;
let leakedCredentials = false;
const local = createServer((req, res) => {
  const found = req.url === '/_next/static/local.js';
  res.writeHead(found ? 200 : 404);
  res.end(found ? 'local' : 'missing');
});
const peer = createServer((req, res) => {
  peerCalls++;
  leakedCredentials ||= Boolean(req.headers.cookie || req.headers.authorization);
  const found = req.url?.startsWith('/_next/static/peer.js');
  res.writeHead(found ? 200 : 404, { 'Content-Type': 'application/javascript', 'Cross-Origin-Resource-Policy': 'same-origin' });
  res.end(found ? 'peer' : 'missing');
});
const reservation = createServer();
for (const server of [local, peer, reservation]) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
}
function port(server: ReturnType<typeof createServer>) {
  const address = server.address();
  assert(address && typeof address !== 'string');
  return address.port;
}
const listenPort = port(reservation);
await new Promise<void>(done => reservation.close(() => done()));
const locations = [block('location ^~ /_next/static/'), block('location @next_static_vercel')].join('\n')
  .replace('http://127.0.0.1:3002', `http://127.0.0.1:${port(local)}`)
  .replace('https://google-api.cuberoot.me', `http://127.0.0.1:${port(peer)}`);
const dir = mkdtempSync('/tmp/cuberoot-static-check-');
mkdirSync(`${dir}/logs`);
writeFileSync(`${dir}/nginx.conf`, `daemon off; pid ${dir}/nginx.pid; error_log ${dir}/error.log;
events {} http { lua_package_path "/www/server/nginx/lib/lua/?.lua;;"; access_log off;
server { listen 127.0.0.1:${listenPort}; ${locations} } }`);
execFileSync('nginx', ['-t', '-p', `${dir}/`, '-c', `${dir}/nginx.conf`]);
const child = spawn('nginx', ['-p', `${dir}/`, '-c', `${dir}/nginx.conf`]);
child.stderr.on('data', chunk => process.stderr.write(chunk));
const exited = once(child, 'exit');
async function get(path: string, method = 'GET') {
  return new Promise<{ status?: number; body: string; policy?: string }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: listenPort, path, method,
      headers: { Cookie: 'test-cookie', Authorization: 'Bearer test-only' },
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body, policy: res.headers['cross-origin-resource-policy'] as string | undefined }));
    });
    req.setTimeout(3000, () => req.destroy(new Error('Probe timeout')));
    req.on('error', reject); req.end();
  });
}
try {
  for (let n = 0; n < 40; n++) {
    try { await get('/_next/static/local.js'); break; } catch { await new Promise(r => setTimeout(r, 50)); }
  }
  assert.equal((await get('/_next/static/local.js')).body, 'local');
  assert.equal(peerCalls, 0);
  const recovered = await get('/_next/static/peer.js?v=1');
  assert.equal(recovered.status, 200); assert.equal(recovered.body, 'peer');
  assert.equal(recovered.policy, 'same-origin'); assert.equal(leakedCredentials, false);
  assert.equal((await get('/_next/static/peer.js', 'HEAD')).status, 200);
  assert.equal((await get('/_next/static/missing.js')).status, 404);
  assert.equal(peerCalls, 3);
  assert.equal((await get('/_next/static/peer.js', 'POST')).status, 403);
  assert.equal(peerCalls, 3);
  console.log('PASS: local first, peer GET/HEAD, final 404, POST denied, no credentials, worker policy preserved');
} catch (error) {
  console.error(readFileSync(`${dir}/error.log`, 'utf8'));
  throw error;
} finally {
  child.kill('SIGQUIT'); await exited;
  await Promise.all([local, peer].map(server => new Promise<void>(done => server.close(() => done()))));
  rmSync(dir, { recursive: true, force: true });
}
