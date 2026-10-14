/** Independent replay only; no solver or large table is loaded. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {verify} from './benchmark.mjs';
const root=resolve(import.meta.dirname,'../../..'),out=resolve(root,'.tmp/zbll-opt10-acceptance-20261013');
const {cube3x3x3}=await import(resolve(root,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const kp=await cube3x3x3.kpuzzle();
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const cases=read(resolve(out,'input.json'));
if(process.argv.includes('--resume')) {
  const all=readFileSync(resolve(out,'resume-output.csv'),'utf8'),prefix=readFileSync(resolve(out,'resume-prefix.csv'),'utf8');
  assert(all.startsWith(prefix));
  const rows=all.trim().split('\n');assert.equal(rows.length,8);const ids=new Set();
  for(const row of rows){const [id,n,solution]=row.split(',');assert(!ids.has(id));ids.add(id);verify(kp,{...cases[Number(id)],id},{id,length:Number(n),solution});}
  const raw=readFileSync(resolve(out,'resume-output.csv.rust.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(raw.length,6);assert(raw.every(r=>+r.id>=2));
  const result={passed:true,preservedPrefixRows:2,newResults:6,totalVerified:8,
    checkpointVerified:read(resolve(root,'.tmp/double-zbll-symmetry-v2/progress.json')).verified,completedAt:new Date().toISOString()};
  writeFileSync(resolve(out,'resume-report.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(result);
} else {
const rows=readFileSync(resolve(out,'raw.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
assert.equal(rows.length,cases.length);assert.equal(new Set(rows.map(r=>r.id)).size,cases.length);
for(const row of rows){assert.match(row.id,/^\d+$/);assert.equal(row.cancelled,false);const item=cases[Number(row.id)];assert(item);verify(kp,{...item,id:row.id},row);}
const resource=read(resolve(root,'.tmp/cubeopt-reverse/double-zbll-opt10-acceptance-resources.json'));
assert.equal(resource.stopped,'');assert.equal(resource.trigger,null);assert.equal(resource.swapouts,0);
assert(resource.minimumHeadroom>=2**31);assert(resource.peakRss<=resource.rssLimit);
const review=read(resolve(root,'.tmp/double-zbll-symmetry-v2/opt10-resource-review.json'));
const report={passed:true,cases:rows.length,verified:rows.length,threads:16,contexts:8,passes:1,
  binarySha256:review.binarySha256,table:resolve(root,'.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat'),
  rawSha256:createHash('sha256').update(readFileSync(resolve(out,'raw.jsonl'))).digest('hex'),resource,
  measurement:'Correctness regression, 64 dual-bottom and 60 historical states; no paired speed claim',completedAt:new Date().toISOString()};
writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
writeFileSync(resolve(root,'.tmp/double-zbll-symmetry-v2/rust-opt10-acceptance.json'),JSON.stringify({...report,report:resolve(out,'report.json')},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({verified:rows.length,peakGiB:resource.peakRss/2**30,minimumHeadroomGiB:resource.minimumHeadroom/2**30}));
}
