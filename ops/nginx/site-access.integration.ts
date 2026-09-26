// Isolated nginx + mock authorization: no production requests or real secrets.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
const dir=mkdtempSync('/tmp/cuberoot-site-gate-');mkdirSync(dir+'/logs');
const auth=createServer((req,res)=> { const ok=req.headers.cookie==='verified=1'||req.headers['x-cuberoot-comp-service']==='test-service'; res.writeHead(ok?204:403);res.end(); });
auth.listen(0,'127.0.0.1');await once(auth,'listening');const authPort=auth.address().port;
const portReserve=createServer();portReserve.listen(0,'127.0.0.1');await once(portReserve,'listening');const port=portReserve.address().port;await new Promise(r=>portReserve.close(r));
let maps=readFileSync(process.argv[2] || 'ops/nginx/01-traffic-limits.conf','utf8').split('# Generated monthly')[0].replace('include /etc/nginx/cuberoot-comp-verification-state.conf;', 'default 1;');
let inc=readFileSync(process.argv[3] || 'ops/nginx/competition-access.inc','utf8').replace('http://127.0.0.1:3001/v1/competition-access/check', `http://127.0.0.1:${authPort}/check`);
writeFileSync(dir+'/nginx.conf',`daemon off; pid ${dir}/nginx.pid; error_log ${dir}/error.log; events {} http { lua_package_path "/www/server/nginx/lib/lua/?.lua;;"; access_log off; map $http_x_test_cn $cuberoot_cn_exempt { default 0; 1 1; } ${maps} server { listen 127.0.0.1:${port}; server_name cuberoot.me; ${inc} location / { content_by_lua_block { ngx.say('mock page') } } } }`);
execFileSync('nginx',['-t','-p',dir+'/','-c',dir+'/nginx.conf']);const child=spawn('nginx',['-p',dir+'/','-c',dir+'/nginx.conf']);
async function get(path,headers={}){return new Promise((resolve,reject)=> {const req=request({host:'127.0.0.1',port,path,headers:{host:'cuberoot.me',...headers}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:res.headers}));});req.on('error',reject);req.end();});}
try {
for(let n=0;n<40;n++){try{await get('/ready');break;}catch{await new Promise(r=>setTimeout(r,50));}}
for(const path of ['/tools/cstimer/','/tools/blddb/index.html','/tools/blddb','/blog/hello','/blog-test/hello.html']){
 const denied=await get(path+'?a=1&b=2');assert.equal(denied.status,307,path);assert.equal(denied.headers['x-cuberoot-verification-required'],'1');assert.equal(new URL(denied.headers.location,'https://cuberoot.me').searchParams.get('returnTo'),path+'?a=1&b=2');
 assert.equal((await get(path,{cookie:'verified=1'})).status,200);assert.equal((await get(path,{'x-test-cn':'1'})).status,200);assert.equal((await get(path,{'x-cuberoot-comp-service':'test-service'})).status,200);
}
for(const path of ['/tools/cstimer/js/main.js','/tools/table.bin.gz','/tools/data.json','/tools/icons/a.svg','/competition-verify','/zh/competition-verify','/v1/competition-access/challenge'])assert.equal((await get(path)).status,200,path);
assert.equal((await get('/api/comp/A')).status,403);assert.equal((await get('/api/comp/A',{cookie:'verified=1'})).status,200);
const staticDenied=await get('/tools/cstimer/',{host:'static.cuberoot.me'});assert.ok(staticDenied.headers.location.startsWith('https://cuberoot.me/competition-verify?'));
console.log('PASS: direct HTML, assets, query round-trip, signed-proxy transport, CN, API and static-host return');
} finally { child.kill('SIGQUIT');await once(child,'exit');await new Promise(r=>auth.close(r));}
