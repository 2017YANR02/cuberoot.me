// Isolated map verification: never targets production application listeners.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
const dir = mkdtempSync('/tmp/cuberoot-defense-check-');
mkdirSync(`${dir}/logs`);
const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
const address = reservation.address(); assert(address && typeof address === 'object');
const port = address.port; await new Promise<void>(done => reservation.close(() => done()));
const limits = readFileSync(process.argv[2] || 'ops/nginx/01-traffic-limits.conf', 'utf8')
  .replace('map $host $cuberoot_comp_verification_enabled', 'map $http_x_test_mode $cuberoot_comp_verification_enabled')
  .replace('include /etc/nginx/cuberoot-comp-verification-state.conf;', 'default 1; open 0;')
  .replace('include /etc/nginx/cuberoot-cn-ranges.conf;', '198.51.100.2 1;');
const maintenance = readFileSync(process.argv[3] || 'ops/nginx/00-maintenance.conf', 'utf8').split('# Preserve combined-log')[0]
  .replace('include /etc/nginx/cuberoot-maintenance-state.conf;', 'default 1;');
writeFileSync(`${dir}/nginx.conf`, `daemon off; pid ${dir}/nginx.pid; error_log ${dir}/error.log;
events {} http { lua_package_path "/www/server/nginx/lib/lua/?.lua;;"; access_log off; set_real_ip_from 127.0.0.1; real_ip_header X-Test-IP;
${limits}\n${maintenance}
server { listen 127.0.0.1:${port}; location / {
return 200 '$cuberoot_comp_verification_enabled|$cuberoot_calc_denied|$cuberoot_page_total_key|$cuberoot_detail_total_key|$cuberoot_calc_total_key|$cuberoot_comp_proxy_total_key|$cuberoot_live_total_key|$cuberoot_api_total_key|$cuberoot_maintenance_enabled|$cuberoot_comp_check';
} } }`);
execFileSync('nginx', ['-t', '-p', `${dir}/`, '-c', `${dir}/nginx.conf`]);
const child = spawn('nginx', ['-p', `${dir}/`, '-c', `${dir}/nginx.conf`]);
const exited = once(child, 'exit');
async function get(path: string, mode: string, ip = '198.51.100.1'): Promise<string[]> {
  return new Promise((done, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers: { 'X-Test-Mode': mode, 'X-Test-IP': ip } }, res => {
      let text = ''; res.on('data', chunk => { text += chunk; }); res.on('end', () => done(text.split('|')));
    }); req.on('error', reject); req.end();
  });
}
try {
  for (let n = 0; n < 40; n++) { try { await get('/', 'open'); break; } catch { await new Promise(r => setTimeout(r, 50)); } }
  for (const path of ['/', '/zh/calc', '/calc', '/wca/comp/A/result/333', '/zh/wca/persons/2017YANR02', '/api/comp/A', '/v1/cubing-live/A', '/tools/cstimer/']) {
    const open = await get(path, 'open');
    assert.deepEqual(open, ['0', '0', '', '', '', '', '', '', '0', '0'], path);
    const cn = await get(path, 'protect', '198.51.100.2');
    assert.deepEqual(cn, ['1', '0', '', '', '', '', '', '', '0', '0'], `CN ${path}`);
  }
  assert.deepEqual(await get('/zh/calc', 'protect'), ['1', '1', 'pages', '', 'calc', '', '', 'api', '1', '0']);
  assert.equal((await get('/wca/comp/A/result/333', 'protect'))[3], 'detail');
  assert.equal((await get('/api/comp/A', 'protect'))[5], 'comp');
  assert.equal((await get('/v1/cubing-live/A', 'protect'))[6], 'live');
  assert.equal((await get('/tools/cstimer/', 'protect'))[9], '2');
  assert.equal((await get('/v1/traffic-defense', 'protect'))[8], '0');
  console.log('PASS: open/protected maps, all incident budgets, CN, calculator, static verification and maintenance');
} finally { child.kill('SIGQUIT'); await exited; }
