/** Bounded, table-free selection from a fixed prefix of saved results. */
import { createReadStream, readFileSync, openSync, closeSync, readSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { PairSelection } from './double-zbll-selection.mjs';
import { atomicJson } from './double-zbll-symmetry-state.mjs';

if (process.argv.length!==3 || process.argv[2]!=='--snapshot') throw Error('Use --snapshot to select saved candidates without starting a solver.');
const work=resolve(import.meta.dirname,'../../../../.tmp/double-zbll-symmetry-v2');
const model=await import(resolve(work,'model.mts'));
const selection=new PairSelection(model), seen=new Uint8Array(model.N*model.N);
const integrity=JSON.parse(readFileSync(resolve(work,'migration-integrity.json'),'utf8'));
const sources:{file:string;bytes:number;rows:number;sha256:string}[]=[];
let rows=0;
for(const name of ['representatives.csv','solutions.csv']) {
  const file=resolve(work,name), size=statSync(file).size, fd=openSync(file,'r');
  const tail=Buffer.alloc(Math.min(size,4096));
  try {readSync(fd,tail,0,tail.length,size-tail.length);} finally {closeSync(fd);}
  const bytes=size-tail.length+tail.lastIndexOf(10)+1;
  if(size && tail.lastIndexOf(10)<0) throw Error('No complete final record');
  const hash=createHash('sha256');let count=0;
  if(bytes) for await(const line of createInterface({input:createReadStream(file,{end:bytes-1}),crlfDelay:Infinity})) {
    hash.update(line+'\n');
    const match=/^(\d+),(\d+),([URFDLB2' ]+)$/.exec(line);if(!match)throw Error('Malformed saved result');
    const id=Number(match[1]), htm=Number(match[2]);
    if(!Number.isSafeInteger(id)||id>=seen.length||seen[id]||htm<1||htm>20||model.canonical(Math.floor(id/model.N),id%model.N).id!==id)throw Error('Invalid or duplicate state');
    selection.accept(id,htm,match[3]);seen[id]=htm;count++;rows++;
  }
  const sha256=hash.digest('hex');
  if(name==='representatives.csv' && (count!==integrity.rows||sha256!==integrity.sha256))throw Error('Migration source changed');
  sources.push({file:name,bytes,rows:count,sha256});
}
const result=selection.snapshot();
let verified=0;
for(const row of result.rows) {
  if(model.pattern(model.setup(row.stateId)+' '+row.solution)!==model.solved)throw Error('Selected solution failed full-state verification');
  if(++verified%20000===0)console.log(`已验证候选 ${verified.toLocaleString()} / ${result.rows.length.toLocaleString()}`);
}
// Separate snapshot file: never contend with a running coordinator's outputs.
const output=resolve(work,'selected-pairs-snapshot.json');
atomicJson(output,{...result,generatedAt:new Date().toISOString(),sources,sourceRows:rows,verifiedCandidates:verified});
console.log(JSON.stringify({sourceRows:rows,selectedPairs:verified,output,rssMiB:process.memoryUsage().rss/2**20}));
