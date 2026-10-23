/** Five-case, bounded prefix-completion sample; raw evidence is immutable. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {normalize,outerTurnSequence} from '../../../core/packages/shared/src/recon_ground_truth.ts';
import {strictOuterForm} from '../../../core/packages/shared/src/timer/reconstruct/library_correction.ts';
import {algSpeed,normalizeLine,MCC_DEFAULTS,getSTM} from '../../../core/packages/client/lib/mcc.ts';
import {improveNotation,isAllowedZbllAlgorithm,ZBLL_ALLOWED_FAMILIES} from './zbll-mcc-notation.mts';
const root=resolve(import.meta.dirname,'../../..'),out=resolve(root,'.tmp/1lll-five-20261023');
const revision=process.argv[2]==='report'?process.argv[4]:undefined;
if(revision)assert(/^[a-zA-Z0-9-]+$/.test(revision),'Expected a revision directory name');
const reportOut=revision?resolve(out,revision):out;
if(revision)mkdirSync(reportOut,{recursive:true});
const {Alg}=await import(resolve(root,'core/packages/client/node_modules/cubing/dist/lib/cubing/alg/index.js'));
const {puzzles}=await import(resolve(root,'core/packages/client/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const kp=await puzzles['3x3x3'].kpuzzle(),identity=kp.defaultPattern();
const toks=(s:string)=>s.trim().split(/\s+/).filter(Boolean);
const key=(s:string)=>strictOuterForm(toks(s)).key;
const save=(name:string,value:any)=>writeFileSync(resolve(process.argv[2]==='report'?reportOut:out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const mcc=(s:string)=>{const v=algSpeed(normalizeLine(s),false,true,MCC_DEFAULTS);assert(typeof v==='number'&&Number.isFinite(v));return v;};
const cmp=(a:any,b:any)=>a.mcc-b.mcc||a.stm-b.stm||a.algorithm.localeCompare(b.algorithm);
if(process.argv[2]==='prepare'){
 const source=JSON.parse(readFileSync(resolve(out,'source.json'),'utf8'));
 const groups=['01','07','17','33','45'];
 const cases=groups.map((g,i)=>{const c=source.cases.find((x:any)=>x.subgroup===g&&x.meta?.optimal?.htm?.len>=10&&x.meta.optimal.htm.len<=11);assert(c,`Missing group ${g}`);return {id:`c${i+1}`,name:c.name,dbId:c.id,group:g,setup:key(new Alg(c.setup).toString()),rawSetup:c.setup,sourceMeta:c.meta};});
 // Require F2L solved, without relying on a copied solution.
 const u=identity.applyAlg('U').patternData;
 for(const c of cases){const d=identity.applyAlg(c.setup).patternData;for(const orbit of ['CORNERS','EDGES'])for(let i=0;i<d[orbit].pieces.length;i++)if(u[orbit].pieces[i]===i){assert.equal(d[orbit].pieces[i],i);assert.equal(d[orbit].orientation[i],0);}}
 const moves=ZBLL_ALLOWED_FAMILIES.flatMap(f=>['',"'",'2'].map(s=>f+s));
 let seed=20261023;const rand=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 const all:any[][]=[];
 for(const c of cases){const qs:any[]=[],seen=new Set();function add(prefix:string){const ns=normalize(toks(`${c.setup} ${prefix}`),{expandSlices:true});const scramble=key(ns.filter(t=>/^[URFDLB]/.test(t)).join(' '));if(!scramble||seen.has(scramble))return;seen.add(scramble);const solution=[prefix,new Alg(scramble).invert().toString()].join(' ');assert(identity.applyAlg(`${c.setup} ${solution}`).experimentalIsSolved({ignorePuzzleOrientation:true,ignoreCenterOrientation:true}));qs.push({id:`${c.id}q${String(qs.length).padStart(3,'0')}`,caseId:c.id,prefix,scramble});}
 add('');for(const m of moves)add(m);while(qs.length<100){const a=moves[rand()%moves.length],b=moves[rand()%moves.length];if(a[0]!==b[0])add(`${a} ${b}`);}all.push(qs);}
 const queries=Array.from({length:100},(_,i)=>all.map(q=>q[i])).flat();save('queries.json',{cases,queries,method:'100 unique prefix completions per case; interleaved, bounded Opt9 search; no library solutions inserted'});
 writeFileSync(resolve(out,'input.tsv'),queries.map(q=>`${q.id}\t${q.scramble}\n`).join(''),{flag:'wx'});console.log(JSON.stringify(cases.map(c=>({id:c.id,name:c.name,setup:c.setup}))));
}else if(process.argv[2]==='report'){
 const q=JSON.parse(readFileSync(resolve(out,'queries.json'),'utf8')),queries=new Map(q.queries.map((x:any)=>[x.id,x]));
 const rawPath=process.argv[3]==='retry-1'?resolve(out,'retry-1/raw.jsonl'):resolve(out,'raw.jsonl');
 const rows=readFileSync(rawPath,'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
 const byCase=new Map<string,Map<string,any>>(q.cases.map((c:any)=>[c.id,new Map()]));let incomplete=0,verified=0;
 for(const row of rows){const query:any=queries.get(row.id);assert(query);if(row.cancelled||typeof row.solution!=='string'){incomplete++;continue;}assert(identity.applyAlg(`${query.scramble} ${row.solution}`).experimentalIsSolved({ignorePuzzleOrientation:false,ignoreCenterOrientation:true}));const c=q.cases.find((c:any)=>c.id===query.caseId),raw=[query.prefix,row.solution].filter(Boolean).join(' ');const canonical=key(raw);
 for(const alg of improveNotation(canonical,{preserveOrientation:true,beamPerFrame:8,completeBoundaryAUF:true})){const algorithm=new Alg(alg).experimentalSimplify({cancel:true}).toString();assert(isAllowedZbllAlgorithm(algorithm));assert(identity.applyAlg(`${c.setup} ${algorithm}`).experimentalIsSolved({ignorePuzzleOrientation:false,ignoreCenterOrientation:true}));const path=key(algorithm);const family=['','D','D2',"D'"].map(d=>key(`${d} ${path} ${new Alg(d).invert()}`)).sort()[0];const item={algorithm,mcc:mcc(algorithm),stm:getSTM(algorithm,true),queryId:row.id,family};const bucket=byCase.get(c.id)!;if(!bucket.has(family)||cmp(item,bucket.get(family))<0)bucket.set(family,item);}verified++;}
 const results=q.cases.map((c:any)=>({...c,candidates:[...byCase.get(c.id)!.values()].sort(cmp).slice(0,200).map((x:any,i:number)=>({rank:i+1,...x}))}));
 const report={createdAt:new Date().toISOString(),method:q.method,scorer:'Original MCC defaults, ignore complete starting/ending AUF; no neural model yet',allowed:ZBLL_ALLOWED_FAMILIES,orientation:'same final cube orientation as setup frame',inputs:q.queries.length,returned:rows.length,verified,incomplete,nativeSearchSeconds:rows.reduce((n,r)=>n+(r.seconds??0),0),results};save('report.json',report);
 const format=(count:number)=>'1LLL 五例候选 · OPT9 / MCC\n仅允许 '+ZBLL_ALLOWED_FAMILIES.join(' ')+' 及逆转、半转。保留完整AUF，MCC忽略首尾AUF；均独立验解并保持结束朝向。\n这是有预算的候选采样，非穷尽多解；未加入公式库解，未用神经评分。\n\n'+results.map((c:any)=>`${c.id} · ${c.name}\n打乱：${c.candidates.length?new Alg(c.candidates[0].algorithm).invert().toString().replace(/2'/g,'2'):c.setup}\n候选数：${c.candidates.length}\n排名\tMCC\tSTM(去AUF)\t公式\n`+c.candidates.slice(0,count).map((r:any)=>`${r.rank}\t${r.mcc.toFixed(1)}\t${r.stm}\t${r.algorithm}`).join('\n')).join('\n\n')+'\n';
 writeFileSync(resolve(reportOut,'top-10.txt'),format(10),{flag:'wx'});writeFileSync(resolve(reportOut,'all-candidates.txt'),format(200),{flag:'wx'});
 console.log(JSON.stringify({verified,incomplete,searchSeconds:report.nativeSearchSeconds,cases:results.map((c:any)=>({name:c.name,count:c.candidates.length,top:c.candidates.slice(0,3)}))},null,2));
}else throw Error('Use prepare or report');
