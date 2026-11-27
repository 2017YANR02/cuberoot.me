// Isolated nginx + mock authorization: no production requests or real secrets.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(), 'cuberoot-site-gate-'));mkdirSync(dir+'/logs');
const auth=createServer((req,res)=> { const ok=req.headers.cookie==='verified=1'||req.headers['x-cuberoot-comp-service']==='test-service'; res.writeHead(ok?204:403);res.end(); });
auth.listen(0,'127.0.0.1');await once(auth,'listening');const authPort=auth.address().port;
const portReserve=createServer();portReserve.listen(0,'127.0.0.1');await once(portReserve,'listening');const port=portReserve.address().port;await new Promise(r=>portReserve.close(r));
let maps=readFileSync(process.argv[2] || 'ops/nginx/01-traffic-limits.conf','utf8').split('# Generated monthly')[0]
  .replace('map $host $cuberoot_comp_verification_enabled', 'map $http_x_test_mode $cuberoot_comp_verification_enabled')
  .replace('include /etc/nginx/cuberoot-comp-verification-state.conf;', 'default 1; scoped 0; expired 0;')
  .replace('map $host $cuberoot_comp_only_until', 'map $http_x_test_mode $cuberoot_comp_only_until')
  .replace('include /etc/nginx/cuberoot-comp-only-until.conf;', 'default 0; scoped 4102444800; expired 1;')
  .replace('include /etc/nginx/cuberoot-permanent-comp-bans/*.conf;', '198.51.100.8 1;');
let inc=readFileSync(process.argv[3] || 'ops/nginx/competition-access.inc','utf8').replace('http://127.0.0.1:3001/v1/competition-access/check', `http://127.0.0.1:${authPort}/check`);
writeFileSync(dir+'/nginx.conf',`daemon off; pid ${dir}/nginx.pid; error_log ${dir}/error.log; events {} http { lua_package_path "/www/server/nginx/lib/lua/?.lua;;"; access_log off; set_real_ip_from 127.0.0.1; real_ip_header X-Test-IP; map $http_x_test_cn $cuberoot_cn_exempt { default 0; 1 1; } ${maps} server { listen 127.0.0.1:${port}; server_name cuberoot.me; if ($cuberoot_lightpanda_denied) { return 403; } ${inc} location / { content_by_lua_block { ngx.say('mock page') } } } }`);
execFileSync('nginx',['-t','-p',dir+'/','-c',dir+'/nginx.conf']);const child=spawn('nginx',['-p',dir+'/','-c',dir+'/nginx.conf']);
async function get(path,headers={}){return new Promise((resolve,reject)=> {const req=request({host:'127.0.0.1',port,path,headers:{host:'cuberoot.me',...headers}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:res.headers}));});req.on('error',reject);req.end();});}
try {
for(let n=0;n<40;n++){try{await get('/ready');break;}catch{await new Promise(r=>setTimeout(r,50));}}
for (const [agent, ip, status] of [
  ['Mozilla/5.0 (X11; Linux x86_64) Chrome/155.0.0.0', '198.51.100.6', 403],
  ['Mozilla/5.0 (linux x86_64) (compatible; Googlebot/2.1)', '198.51.100.6', 403],
  ['Mozilla/5.0 (X11; Linux x86_64) (compatible; Googlebot/2.1)', '34.22.85.1', 200],
  ['Mozilla/5.0 (X11; Linux x86_64) (compatible; bingbot/2.0)', '13.66.139.1', 200],
  ['Mozilla/5.0 (Linux; Android 15) Chrome/155.0.0.0 Mobile', '198.51.100.6', 200],
  ['Mozilla/5.0 (Windows NT 10.0) Chrome/155.0.0.0', '198.51.100.6', 200],
  ['Lightpanda/1.0', '34.22.85.1', 403],
] as const) {
  assert.equal((await get('/robots.txt', { 'User-Agent': agent, 'X-Test-IP': ip })).status, status, agent);
}
for(const path of ['/tools/cstimer/','/tools/blddb/index.html','/tools/blddb','/blog/hello','/blog-test/hello.html']){
 const denied=await get(path+'?a=1&b=2');assert.equal(denied.status,307,path);assert.equal(denied.headers['x-cuberoot-verification-required'],'1');assert.equal(new URL(denied.headers.location,'https://cuberoot.me').searchParams.get('returnTo'),path+'?a=1&b=2');
 assert.equal((await get(path,{cookie:'verified=1'})).status,200);assert.equal((await get(path,{'x-test-cn':'1'})).status,200);assert.equal((await get(path,{'x-cuberoot-comp-service':'test-service'})).status,200);
}
for(const path of ['/tools/cstimer/js/main.js','/tools/table.bin.gz','/tools/data.json','/tools/icons/a.svg','/competition-verify','/zh/competition-verify','/v1/competition-access/challenge'])assert.equal((await get(path)).status,200,path);
assert.equal((await get('/api/comp/A')).status,403);assert.equal((await get('/api/comp/A',{cookie:'verified=1'})).status,200);
const staticDenied=await get('/tools/cstimer/',{host:'static.cuberoot.me'});assert.ok(staticDenied.headers.location.startsWith('https://cuberoot.me/competition-verify?'));
const scoped = { 'x-test-mode': 'scoped' };
for (const path of ['/zh', '/zh/timer', '/zh/wca/comp/A', '/stats/comp_countries.json', '/tools/cstimer/', '/v1/competition-access/challenge']) {
  assert.equal((await get(path, scoped)).status, 200, path);
}
for (const path of ['/api/comp/A', '/v1/cubing-live/A', '/v1/cubing-live-stream/A', '/stats/comp/A.json', '/stats/comp/%41.json?v=4']) {
  assert.equal((await get(path, scoped)).status, 403, path);
  assert.equal((await get(path, { ...scoped, cookie: 'verified=1' })).status, 200, path);
  assert.equal((await get(path, { ...scoped, 'x-test-cn': '1' })).status, 403, path);
  assert.equal((await get(path, { 'x-test-mode': 'expired' })).status, 200, path);
}
const listed = { 'X-Test-IP': '198.51.100.8', 'x-test-mode': 'expired', 'x-test-cn': '1', cookie: 'verified=1' };
for (const path of ['/zh/wca/comp/A', '/api/comp/A', '/v1/cubing-live/A', '/stats/comp/A.json', '/stats/comp_series.json']) {
  const denied = await get(path, listed);
  assert.equal(denied.status, 403, path);
  assert.equal(denied.headers['x-cuberoot-comp-scraper'], 'blocked');
}
for (const path of ['/zh', '/zh/timer', '/robots.txt', '/api/comp/access', '/stats/scramble/example.json']) {
  assert.equal((await get(path, listed)).status, 200, path);
}
console.log('PASS: site verification, global competition snapshots and verified access, expiry, and scoped permanent source denies');
} finally { child.kill('SIGQUIT');await once(child,'exit');await new Promise(r=>auth.close(r));}
