/** Post-run verification only. No table loading and no solver execution. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,createReadStream,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {nxDir,nxRoot,nxLabel,nxTableBytes,nxHash,nxBinary,nxReview} from './nxopt-policy.mts';
import {readWca100} from './wasm-benchmark.mjs';
import {verify} from './benchmark.mjs';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const base=resolve(nxRoot,'.tmp/cubeopt-reverse');
const partial=process.argv[2]==='--partial';
assert(process.argv.length===2||partial);
const resources=read(resolve(base,nxLabel+'-resources.json'));
if(!partial) {const exit=read(resolve(nxDir,'exit.json'));assert.equal(exit.code,0);assert.equal(exit.completed,100);assert.equal(exit.error,null);}
assert.equal(resources.stopped,'');assert.equal(resources.trigger,null);assert.equal(resources.swapouts,48);assert.equal(resources.pressure,1);
assert(resources.peakRss>0&&resources.peakRss<=resources.rssLimit);assert(resources.minimumHeadroom>=2*2**30);
const raw=resolve(nxDir,'results.jsonl'), rows=readFileSync(raw,'utf8').trim().split('\n').map(JSON.parse);
const reference=readFileSync(resolve(base,'wca1000-mt16-rust-native-opt9-exp-fixed.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const corpus=readWca100(resolve(nxRoot,'solver/testdata/benchmarks/wca-first100.json'),100);
assert(rows.length>0&&rows.length<=100);if(!partial)assert.equal(rows.length,100);assert.equal(reference.length,1000);
const {cube3x3x3}=await import(pathToFileURL(resolve(nxRoot,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
const puzzle=await cube3x3x3.kpuzzle();
for(let i=0;i<rows.length;i++) {
 assert.equal(rows[i].id,corpus.cases[i].id);assert.equal(rows[i].id,reference[i].id);assert.equal(rows[i].length,reference[i].length);
 verify(puzzle,corpus.cases[i],rows[i]);
}
if(partial) {console.log(`${rows.length} completed solutions independently verified with matching optimal lengths`);process.exit(0);}
const table=resolve(nxDir,'nxopth22b.dat');assert.equal(statSync(table).size,nxTableBytes);
const hash=createHash('sha256');for await(const chunk of createReadStream(table))hash.update(chunk);
const timing=read(resolve(nxDir,'timing.json'));assert(timing.seconds>0);assert.equal(timing.cases,100);
const nodes=rows.reduce((s,r)=>s+r.nodes,0),rawSha256=nxHash(raw);
const report={id:'nxopt-22',engine:'nxopt-native',date:new Date().toISOString(),...timing,
 verifiedSolutions:100,optimalLengthsMatched:100,peakRssBytes:resources.peakRss,processTreePeakRssBytes:resources.peakRss,
 rssMethod:'Conservative process-tree peak across generation and solving; no isolated solver RSS claim',
 nodes:null,engineEvals:nodes,probes:rows.reduce((s,r)=>s+r.probes,0),
 nodeCounter:{value:nodes,definition:'nxopt-evals-v1',cases:100,sourceField:'evals',rawSha256},
 compiler:'Apple Clang · -O3 -march=native · HTM EO2/EP2 PS=16',tableBytes:nxTableBytes,tableSha256:hash.digest('hex'),rawSha256,
 artifactSha256:nxHash(nxBinary),reviewSha256:nxHash(nxReview),resourceSha256:nxHash(resolve(base,nxLabel+'-resources.json')),
 sourceCommit:'f430921a48306874864b9f2ac8a059b43492fd3a',source:'https://github.com/rokicki/cube20src',swapoutsDelta:0,
 parallelism:'4 workers solving separate scrambles against one resident shared table',generation:read(resolve(nxDir,'ready.json'))};
writeFileSync(resolve(nxDir,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({seconds:report.seconds,cases:report.cases,verified:report.verifiedSolutions,tableBytes:report.tableBytes,peakRssBytes:report.peakRssBytes,nodes}));
