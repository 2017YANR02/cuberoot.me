/** Copy only completed, independently checked local results into the webpage. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDir, openRoot, openEngines } from './open-benchmark-policy.mts';
const results=[...openEngines,'rust-wasm-opt9-quarter-fixed'].flatMap(engine=>{
  const file=resolve(openDir,engine+'-report.json');if(!existsSync(file)) return [];
  const r=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(r.exitCode,0);assert.equal(r.verifiedSolutions,1000);assert.equal(r.optimalLengthsMatched,1000);
  assert.equal(r.threads,16);assert.equal(r.passes,1);assert.equal(r.warmupCases,0);assert.equal(r.resource.stopped,'');
  const artifactSha256=engine==='rust-native'
    ? JSON.parse(readFileSync(resolve(openRoot,'solver/experiments/cube48opt-rust/opt9-release.json'),'utf8')).executable.sha256
    : r.harnessSummary.artifacts.sha256.wasm;
  return [{...Object.fromEntries(['id','engine','date','cases','threads','passes','warmupCases','verifiedSolutions','optimalLengthsMatched',
    'seconds','peakRssBytes','processTreePeakRssBytes','nodes','compiler','corpusSha256','tableBytes','tableSha256','rawSha256','swapoutsDelta'].map(key=>[key,r[key]])),artifactSha256,
    ...(r.continuation?{continuation:Object.fromEntries(Object.entries(r.continuation).filter(([key])=>key!=='previousDirectory'))}:{}),...(r.quarterRemoved?{quarterRemoved:r.quarterRemoved,searchNodes:r.searchNodes}:{})}];
});
assert(results.length>0);
const pageFile=resolve(openRoot,'core/packages/client/app/[lang]/dev/solvers/compare/current-results.json');
const old=JSON.parse(readFileSync(pageFile,'utf8'));
const opt8=old.find((r:any)=>r.id==='rust-opt8-wasm');
assert(opt8,'Keep the separately verified Opt8 release cohort');
assert.deepEqual([opt8.cases,opt8.threads,opt8.passes,opt8.warmupCases,opt8.verifiedSolutions,opt8.optimalLengthsMatched],[100,4,1,0,100,100]);
assert.equal(opt8.corpusSha256,'92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde');
results.push(opt8);
for(const variant of [8,9]) {
  const file=resolve(openRoot,`.tmp/cubeopt-reverse/wasm-opt8-opt9-20261015/opt${variant}-report.json`);
  if(!existsSync(file)) continue;
  const r=JSON.parse(readFileSync(file,'utf8')),count=variant===8?100:1000;
  assert.deepEqual([r.exitCode,r.cases,r.threads,r.passes,r.warmupCases,r.verifiedSolutions,r.optimalLengthsMatched],
    [0,count,variant===8?4:16,1,0,count,count]);
  assert.equal(r.resource.stopped,'');assert.equal(r.resource.trigger,null);assert.equal(r.swapoutsDelta,0);
  assert.equal(r.corpusSha256,variant===8?opt8.corpusSha256:results[0].corpusSha256);
  results.push(Object.fromEntries(['id','engine','date','cases','threads','passes','warmupCases','verifiedSolutions','optimalLengthsMatched',
    'seconds','peakRssBytes','processTreePeakRssBytes','nodes','compiler','corpusSha256','tableBytes','tableSha256','rawSha256','swapoutsDelta',
    'artifactSha256','cosetRemoved','quarterRemoved','searchNodes'].map(key=>[key,r[key]])) as any);
}
writeFileSync(pageFile,JSON.stringify(results,null,2)+'\n');
console.log({publishedLocally:results.map(r=>r.id)});
