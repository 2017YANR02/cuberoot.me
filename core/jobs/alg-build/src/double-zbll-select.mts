/** Bounded, table-free selection from a fixed prefix of saved results. */
import { createReadStream, readFileSync, openSync, closeSync, readSync, statSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { PairSelection, rankSolution, compareSolutions } from './double-zbll-selection.mjs';
import { DOUBLE_ZBLL_MOVES, DOUBLE_ZBLL_RECORD_BYTES, decodeDoubleZbll } from '@cuberoot/shared/double-zbll';
import { atomicJson } from './double-zbll-symmetry-state.mjs';

if (process.argv.length!==3 || !['--snapshot','--export'].includes(process.argv[2])) throw Error('Use --snapshot or --export; neither starts a solver.');
const exporting = process.argv[2] === '--export';
const work=resolve(import.meta.dirname,'../../../../.tmp/double-zbll-symmetry-v2');
const model=await import(resolve(work,'model.mts'));
const selection=new PairSelection(model), seen=new Uint8Array(model.N*model.N);
const integrity=JSON.parse(readFileSync(resolve(work,'migration-integrity.json'),'utf8'));
const completion = exporting ? JSON.parse(readFileSync(resolve(work,'solutions-integrity.json'),'utf8')) : undefined;
if (exporting && JSON.parse(readFileSync(resolve(work,'progress.json'),'utf8')).status !== 'complete') throw Error('Export requires a completed verified task');
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
if (exporting) {
  if (rows !== model.orbitCount || completion.total !== rows
    || sources[0].sha256 !== completion.importedSha256 || sources[1].sha256 !== completion.solutionsSha256
    || sources.some(s => s.bytes !== statSync(resolve(work,s.file)).size)) throw Error('Completed journal integrity mismatch');
  const n=model.cases.length, total=n*n, bytes=new Uint8Array(total*DOUBLE_ZBLL_RECORD_BYTES), assigned=new Uint8Array(total);
  const histogram=Array<number>(21).fill(0); let count=0;
  for (const row of result.rows) for (const rotation of [0,4]) {
    const mapped=model.image(Math.floor(row.stateId/model.N),row.stateId%model.N,rotation);
    const top=model.states[Math.floor(mapped/model.N)].caseIndex,bottom=model.states[mapped%model.N].caseIndex,pair=top*n+bottom;
    if(assigned[pair])continue;
    const scramble=model.normalize(model.transform(model.normalize(model.invert(row.solution)),rotation));
    if(compareSolutions(rankSolution(scramble),row)!==0 || model.pattern(scramble)!==model.pattern(model.setup(mapped))) throw Error('Export symmetry/state/rank mismatch');
    const moves=scramble.split(/\s+/);bytes[pair*DOUBLE_ZBLL_RECORD_BYTES]=moves.length;
    for(let i=0;i<moves.length;i++) { const move=DOUBLE_ZBLL_MOVES.indexOf(moves[i]); if(move<0)throw Error('Invalid export move');bytes[pair*DOUBLE_ZBLL_RECORD_BYTES+i+1]=move; }
    if(decodeDoubleZbll(bytes,n,top,bottom)!==scramble)throw Error('Export codec mismatch');
    assigned[pair]=1;histogram[moves.length]++;count++;
    if(count%20000===0)console.log(`已验证网站打乱 ${count.toLocaleString()} / ${total.toLocaleString()}`);
  }
  if(n!==493 || count!==total || assigned.some(v=>v!==1))throw Error('Incomplete 493-case export');
  const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
  const casesText=JSON.stringify(model.file),dataSha256=hash(bytes),casesSha256=hash(casesText);
  const dataFile=`pairs-${dataSha256.slice(0,16)}.bin`,casesFile=`cases-${casesSha256.slice(0,16)}.json`;
  const dir=resolve(work,'export');mkdirSync(dir,{recursive:true});
  const save=(name:string,data:string|Uint8Array)=>{writeFileSync(resolve(dir,name+'.tmp'),data);renameSync(resolve(dir,name+'.tmp'),resolve(dir,name));};
  save(dataFile,bytes);save(casesFile,casesText);
  const manifest={schema:1,version:hash(dataSha256+casesSha256).slice(0,16),caseCount:n,pairCount:total,recordBytes:DOUBLE_ZBLL_RECORD_BYTES,moves:DOUBLE_ZBLL_MOVES,metric:'HTM',
    solver:'Rust Opt10 coset',selection:['htm','qtm','generators'],selectionScope:'Best among all saved optimal-HTM state solutions; not exhaustive QTM optimization within one state',
    phases:'All AUF states, reduced by eight axis-preserving rotations; independently verified ordered pairs',
    dataFile,dataBytes:bytes.length,dataSha256,casesFile,casesSha256,generatedAt:new Date().toISOString(),histogram,
    sourceStates:rows,sources,zbllCaseCount:472,pllCaseCount:21};
  save('manifest.json',JSON.stringify(manifest,null,2)+'\n');
  console.log(`已导出 ${total.toLocaleString()} 条完整网站打乱：${dir}`);
}
