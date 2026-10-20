/** Original nxopt22, one resident table, fixed corpus once. No autonomous retries. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,openSync,writeSync,fsyncSync,closeSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {readWca100} from './wasm-benchmark.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const out=resolve(root,'.tmp/cubeopt-reverse/nxopt22-wca100-4-20261015');
const lock=JSON.parse(readFileSync(resolve(root,'.tmp/cubeopt-reverse/compute.lock'),'utf8'));
assert.equal(lock.pid,process.ppid);assert.equal(lock.entry,'nxopt-benchmark.mjs');assert.equal(lock.wasmThreads,4);
assert.equal(lock.backend,'nxopt');
const receipt=JSON.parse(readFileSync(resolve(out,'receipt.json'),'utf8'));assert.equal(receipt.before.swapouts,48);
const corpus=readWca100(resolve(root,'solver/testdata/benchmarks/wca-first100.json'),100);
// Nxopt's portable parser uses explicit + / 2 / - modifiers.
const input=corpus.cases.map(row=>row.scramble.split(/\s+/).map(m=>m[0]+(m[1]==="'"?'-':m[1]==='2'?'2':'+')).join(' ')).join('\n')+'\n';
writeFileSync(resolve(out,'input.txt'),input,{flag:'wx'});
const raw=openSync(resolve(out,'raw.log'),'wx'), rows=openSync(resolve(out,'results.jsonl'),'wx'), err=openSync(resolve(out,'stderr.log'),'wx');
const started=performance.now();let solveStart=null,solveEnd=null,pending=null,completed=0,failure=null;
const save=(name,value)=>writeFileSync(resolve(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const child=spawn('/Users/eula/Developer/cube20src/nxopt22',['-t','4','-x','20','-'],{cwd:out,stdio:['pipe','pipe',err]});
child.stdin.on('error',e=>{failure??=e;});
const rl=createInterface({input:child.stdout});
rl.on('line',line=>{
  writeSync(raw,line+'\n');
  try {
    if(/ read in /.test(line)) {
      assert.equal(solveStart,null);assert.equal(statSync(resolve(out,'nxopth22b.dat')).size,9930*786432+4);
      solveStart=performance.now();
      save('ready.json',{tableBytes:9930*786432+4,tableLoadSeconds:(solveStart-started)/1000,nativePid:child.pid});
      child.stdin.end(input);
    }
    const match=line.match(/^Solved (\d+) in (\d+) probes (\d+) evals (\d+) time ([\d.e+-]+)$/);
    if(match) {assert.equal(pending,null);pending={seq:+match[1],length:+match[2],probes:+match[3],nodes:+match[4],individualSeconds:+match[5]};}
    else if(pending) {
      const moves=line.trim().split(/\s+/).map(m=>m.replace(/[+1]$/,'').replace(/[-3]$/,"'"));
      assert(moves.every(m=>/^[URFDLB](?:2|')?$/.test(m)),`Invalid move line ${line}`);assert.equal(moves.length,pending.length);
      assert.equal(pending.seq,completed+1);assert(solveStart!==null);
      const item=corpus.cases[completed];
      writeSync(rows,JSON.stringify({...pending,id:item.id,solution:moves.join(' '),threads:4})+'\n');fsyncSync(rows);
      completed++;pending=null;
      if(completed===100) solveEnd=performance.now();
      if(completed%100===0) console.log(`nxopt: ${completed}/100`);
    }
    if(/^At \d+ have /.test(line)||/ read in /.test(line)) console.log(line);
    if(/^Did not solve|^!/.test(line)) throw Error(line);
  } catch(e) {failure??=e;child.kill('SIGTERM');}
});
const closed=await new Promise((ok,no)=>{child.on('error',no);child.on('close',(code,signal)=>ok({code,signal}));});
save('exit.json',{...closed,completed,error:failure?String(failure):null});
fsyncSync(raw);closeSync(raw);closeSync(rows);closeSync(err);
assert.equal(closed.code,0);assert.equal(failure,null);assert.equal(completed,100);assert.equal(pending,null);assert(solveEnd!==null&&solveStart!==null);
save('timing.json',{seconds:(solveEnd-solveStart)/1000,cases:100,threads:4,passes:1,warmupCases:0,
  timing:'Batch elapsed from input delivery after table ready through final complete solution output',corpusSha256:corpus.corpusSha256});
