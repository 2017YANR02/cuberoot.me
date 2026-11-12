// New, explicitly authorized Linux diagnosis. Reuses the existing admission,
// RSS, swap, request deadline, single-table and restoration protections.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {LIMITS,memorySettings,resolveAssets,runEngine} from '../../cube48opt-rust/remote/native-service-benchmark.mjs';
import {startSearchProfile} from './profile-session.mjs';

assert.equal(process.platform,'linux'); assert.equal(process.arch,'x64');
const [task] = process.argv.slice(2); assert(/^\/root\/egg-h8-[a-z0-9-]+$/.test(task));
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => JSON.parse(readFileSync(path));
const identity = path => {const s=statSync(path,{bigint:true});return Object.fromEntries(['dev','ino','size','mtimeNs','ctimeNs'].map(k=>[k,String(s[k])]));};
const planBytes=readFileSync(`${task}/plan.json`), plan=JSON.parse(planBytes);
const caseBytes=readFileSync(`${task}/cases.json`), cases=JSON.parse(caseBytes);
assert.equal(plan.schema,'cuberoot.egg-h8-linux-diagnosis/v1');
assert.equal(plan.threads,4); assert.equal(plan.passesPerCandidate,1); assert.equal(plan.warmupCases,0);
assert.equal(cases.length,100); assert.equal(new Set(cases.map(c=>c.id)).size,100);
assert.equal(hash(caseBytes),plan.casesSha256);
for (const [file,expected] of Object.entries(plan.sourceHashes)) assert.equal(hash(readFileSync(new URL(file,import.meta.url))),expected);
assert(plan.passes.length>=1&&plan.passes.length<=4);
assert.equal(new Set(plan.passes.map(p=>p.label)).size,plan.passes.length);
for(const pass of plan.passes){assert(/^[a-z0-9-]+$/.test(pass.label));assert(['native','egg-native'].includes(pass.kind));assert(['avx2','avx512'].includes(pass.simd));}
const config={store:process.env.CUBEOPT_BENCH_STORE,out:`${task}/results`,candidates:'explicit diagnosis',...(plan.profile?{profileSearch:startSearchProfile}:{})};
assert(config.store?.startsWith('/'));mkdirSync(config.out);
const assets=resolveAssets(config,plan.passes,null);
assert.equal(assets.manifest.files.binary.sha256,plan.productionSha256);
assets.extraTables=[...new Set(plan.passes.filter(p=>p.kind==='egg-native').map(p=>p.table))].map(path=>{
 assert.equal(statSync(path).size,7_782_731_776);return {path,identity:identity(path)};
});
const save=(name,value)=>writeFileSync(`${config.out}/${name}`,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
save('input.json',{plan,planSha256:hash(planBytes),cases,assets,limits:LIMITS,memorySettings:memorySettings(),
 sourceHashes:Object.fromEntries(['linux-diagnosis.mjs','profile-session.mjs','../../cube48opt-rust/remote/native-service-benchmark.mjs'].map(file=>[file,hash(readFileSync(new URL(file,import.meta.url)))])),
 clockTicks:Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'}))});
try {
 const started=performance.now(),engines={};
 for(const pass of plan.passes)engines[pass.label]=(await runEngine(config,assets,cases,pass,started)).report;
 save('report.json',{complete:true,instrumented:plan.profile,engines,measuredPasses:1,warmupCases:0});
}catch(error){save('failure.json',{error:String(error.stack??error)});throw error;}
