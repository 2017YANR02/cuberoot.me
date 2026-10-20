/** Read-only independent verification; never starts a solver. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verify} from './benchmark.mjs';
import {readWca100} from './wasm-benchmark.mjs';
const candidate=process.argv[2]??'baseline';
const descriptions:Record<string,string>={baseline:'Preserved Rust fixed native build; variant 8',quarter:'Preserved fixed native source + Opt8 quarter pruning',specialized:'Opt8 fixed coordinate and decoder; quarter pruning preserved',search:'Opt8 specialized + parent propagation, dynamic prefixes and root bound',batch:'Opt8 specialized search + grouped pruning reads'};
descriptions['native-cpu']='Opt8 specialized search; compiled for this host CPU';
descriptions['quarter-cpu']='Preserved quarter-only Opt8 source; compiled for this host CPU';
assert(process.argv.length<=3&&Object.hasOwn(descriptions,candidate));
const root=resolve(import.meta.dirname,'../../..'),label=`opt8-native-${candidate==='baseline'?'':candidate+'-'}wca100-4-20261015`,dir=resolve(root,'.tmp/cubeopt-reverse',label);
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const raw=readFileSync(resolve(dir,'raw.jsonl'));
const rows=raw.toString().trim().split('\n').map(JSON.parse);
const resources=read(resolve(root,'.tmp/cubeopt-reverse',label+'-resources.json'));
assert.equal(rows.length,100);assert.equal(resources.stopped,'');assert.equal(resources.swapouts,48);assert.equal(resources.pressure,1);assert.equal(resources.trigger,null);
const corpus=readWca100(resolve(root,'solver/testdata/benchmarks/wca-first100.json'),100);
const ref=readFileSync(resolve(root,'.tmp/cubeopt-reverse/wca1000-mt16-rust-native-opt9-exp-fixed.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const {cube3x3x3}=await import(pathToFileURL(resolve(root,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);const puzzle=await cube3x3x3.kpuzzle();
for(let i=0;i<100;i++){assert.equal(rows[i].id,corpus.cases[i].id);assert.equal(rows[i].length,ref[i].length);assert.equal(rows[i].threads,4);assert.equal(rows[i].cancelled,false);verify(puzzle,corpus.cases[i],rows[i]);}
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const review=read(resolve(dir,'session.json')),receipt=read(resolve(dir,'receipt.json'));
assert.equal(receipt.reviewSha256,sha(readFileSync(resolve(dir,'session.json'))));
assert.deepEqual(receipt.request,review.request);
assert.equal(review.request.label,label);
const executable=review.request.executable,artifactSha256=sha(readFileSync(executable));
assert.equal(artifactSha256,review.artifacts[executable]);
const report={id:'rust-opt8-native',engine:'rust-native',date:new Date().toISOString(),cases:100,threads:4,passes:1,warmupCases:0,seconds:rows.reduce((s,r)=>s+r.seconds,0),verifiedSolutions:100,optimalLengthsMatched:100,peakRssBytes:resources.peakRss,processTreePeakRssBytes:resources.peakRss,nodes:rows.reduce((s,r)=>s+r.nodes,0),tableBytes:7782727680,corpusSha256:corpus.corpusSha256,swapoutsDelta:0,compiler:'Preserved Rust fixed native build; variant 8',nodeCounter:{value:rows.reduce((s,r)=>s+r.nodes,0),definition:'rust-context-visits-v1',cases:100,sourceField:'nodes',rawSha256:sha(raw)},timing:'Sum of serial per-state native solve seconds; loading and replay excluded',artifactSha256:'3314f88daaf8be5423ae862e359c98fc741a0f9ea8bbd9695f45fd474eb857a9'};
const cuts=rows.reduce((s,r)=>s+r.quarter_siblings_removed,0);
if(candidate!=='baseline') {
 assert(cuts>0,'Quarter pruning must actually activate');
}
report.compiler=descriptions[candidate];
report.artifactSha256=artifactSha256;
const complete={...report,rawSha256:sha(raw),quarterSiblingsRemoved:cuts};
writeFileSync(resolve(dir,'report.json'),JSON.stringify(complete,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(complete));
