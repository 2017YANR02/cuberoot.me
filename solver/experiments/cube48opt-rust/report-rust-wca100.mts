/** Read-only replay of completed benchmark output; publish verified measurements. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verify } from './benchmark.mjs';
const root = resolve(import.meta.dirname, '../../..');
const base = resolve(root, '.tmp/cubeopt-reverse');
const corpus = JSON.parse(readFileSync(resolve(root,'solver/testdata/benchmarks/wca-first100.json'),'utf8'));
const {cube3x3x3} = await import(pathToFileURL(resolve(root,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
const puzzle = await cube3x3x3.kpuzzle();
const results = [];
let lengths: number[] | undefined;
for (const [h, name] of [[10,'wca100-rust-h10-v2'],[7,'wca100-rust-h7-v2']] as const) {
  const file = resolve(base,name+'.jsonl');
  if (!existsSync(file)) continue;
  const resource = JSON.parse(readFileSync(resolve(base,name+'-resources.json'),'utf8'));
  const rows = readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  if (rows.length !== 400 || resource.stopped) { console.log({h,rows:rows.length,stopped:resource.stopped,complete:false}); continue; }
  const stderr = readFileSync(resolve(base,name+'.stderr.log'),'utf8');
  const rss = stderr.match(/^\s*(\d+)\s+maximum resident set size\s*$/m);
  if (!rss) continue; // process has not exited yet
  assert(!/terminated by signal|Command terminated|Error:|panicked/.test(stderr));
  const totals:number[]=[];
  for (let round=0;round<4;round++) {
    let total=0;
    for(let i=0;i<100;i++) {
      const row=rows[round*100+i], item=corpus.cases[i];
      assert.equal(row.id,`r${round}_${item.id}`);
      assert.equal(row.cancelled,false);
      assert.equal(row.contexts,8);
      assert(Number.isFinite(row.seconds)&&row.seconds>=0);
      verify(puzzle,item,row);
      assert.equal(row.length,rows[i].length);
      if(lengths) assert.equal(row.length,lengths[i]);
      total+=row.seconds;
    }
    if(round>0)totals.push(total);
  }
  lengths=rows.slice(0,100).map(r=>r.length);
  const result={id:`rust-h${h}`,seconds:totals.toSorted((a,b)=>a-b)[1],peakRssBytes:Number(rss[1])};
  results.push(result);
  writeFileSync(resolve(base,name+'-report.json'),JSON.stringify({h,corpusSha256:corpus.corpusSha256,cases:100,verified:400,threads:1,protocol:'One persistent process; 100-case warmup excluded; three complete measured passes',totals,...result,resource},null,2)+'\n');
  console.log({h,totals,...result});
}
assert(results.length>0,'No completed Rust H benchmark yet');
const page=resolve(root,'core/packages/client/app/[lang]/dev/solvers/compare/unified-benchmark.ts');
const old=JSON.parse(readFileSync(page,'utf8').split('export const WCA100 = ')[1].trim().replace(/;$/,''));
assert.equal(old.corpusSha256,corpus.corpusSha256);
// Opt results use a different process protocol and remain in their raw report.
const data={...old,status:results.length===2?{zh:'Rust H7/H10 已完成 · 三轮中位数',en:'Rust H7/H10 complete · median of 3 rounds'}:{zh:'Rust H10 已完成 · H7 待完成',en:'Rust H10 complete · H7 pending'},results};
writeFileSync(page+'.tmp','/** Verified Rust-only WCA100 benchmarks. */\nexport const WCA100 = '+JSON.stringify(data,null,2)+';\n');
renameSync(page+'.tmp',page);
