// User-authorized 2026-10-11 sample only; monitoring accepted for this run.
import { readFileSync, writeFileSync, existsSync, renameSync, openSync, closeSync, fsyncSync, unlinkSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '../../../..');
const { observeZbllMemory } = await import(resolve(root,'core/scripts/zbll-memory-budget.mts'));
const symmetryArg=process.argv.find(x=>x.startsWith('--symmetry-batch='));
const symmetryBatch=symmetryArg?.slice('--symmetry-batch='.length);
if(symmetryBatch && !/^\d{6}$/.test(symmetryBatch))throw Error('Invalid symmetry batch');
const batchArg=process.argv.find(x=>x.startsWith('--batch='));
const batch=batchArg===undefined?null:Number(batchArg.slice(8));
if(batch!==null && (!Number.isInteger(batch)||batch<0||batch>=Math.ceil(222784/128)))throw Error('Invalid batch');
const dir=symmetryBatch?resolve(root,'.local-data/double-zbll-symmetry-v2/batches',symmetryBatch):batch===null?resolve(root,'.local-data/double-zbll-auf-20261011'):resolve(root,'.local-data/double-zbll-auf-full/batches',String(batch).padStart(4,'0'));
mkdirSync(dir,{recursive:true});
const req = createRequire(resolve(root, 'core/jobs/alg-build/package.json'));
const { cube3x3x3 } = await import(resolve(root,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const { normalizeWcaScramble: normalize } = await import(req.resolve('@cuberoot/shared/normalize-wca-scramble'));
const kp = await cube3x3x3.kpuzzle();
const atom = (name: string, data: unknown) => { writeFileSync(resolve(dir, name+'.tmp'), JSON.stringify(data,null,2)); renameSync(resolve(dir,name+'.tmp'),resolve(dir,name)); };
const source = JSON.parse(readFileSync(resolve(root,'.local-data/double-zbll-v1/source.json'),'utf8'));
const cases = source.cases;
if(cases.length!==472) throw Error('Source changed');
const baseline = new Map(readFileSync(resolve(root,'.local-data/double-zbll-v1/solutions.csv'),'utf8').trim().split('\n').map(line=>{const [id,n]=line.split(',');return [+id,+n];}));
const original = new Map(readFileSync(resolve(root,'.local-data/double-zbll-v1/corpus.csv'),'utf8').trim().split('\n').map(line=>{const i=line.indexOf(',');return [+line.slice(0,i),line.slice(i+1)];}));
const aufs = ['', 'U', 'U2', "U'"];
let seed = 20261011;
const rand = () => { seed ^= seed<<13; seed ^= seed>>>17; seed ^= seed<<5; return seed>>>0; };
const pairs = new Set<number>();
while(pairs.size<32) pairs.add(rand()%(472*472));
if(batch!==null){const sampled=new Set(pairs);pairs.clear();for(let pair=batch*128;pair<Math.min(222784,(batch+1)*128);pair++)if(!sampled.has(pair))pairs.add(pair);}
const rows: {id:number;setup:string;pair:number;top:number;bottom:number;phase:number}[] = [];
const pattern = (alg: string) => {const p=kp.defaultPattern().applyAlg(alg).patternData;return JSON.stringify([p.EDGES,p.CORNERS]);};
if(symmetryBatch)rows.push(...JSON.parse(readFileSync(resolve(dir,'input.json'),'utf8')));
else for(const pair of pairs){
  const top=Math.floor(pair/472), bottom=pair%472;
  const a=normalize(cases[top].meta?.optimal?.htm?.scramble || cases[top].setup);
  const b=normalize(cases[bottom].meta?.optimal?.htm?.scramble || cases[bottom].setup);
  const old=pattern(original.get(pair)!); let matched=false;
  for(let phase=0;phase<256;phase++){
    const setup=normalize(`${aufs[phase&3]} ${a} ${aufs[(phase>>2)&3]} x2 ${aufs[(phase>>4)&3]} ${b} ${aufs[(phase>>6)&3]} x2`);
    if(pattern(setup)===old) matched=true;
    rows.push({id:pair*256+phase,pair,top,bottom,phase,setup});
  }
  if(!matched) throw Error(`Baseline missing from phase set: ${pair}`);
}
const corpus=resolve(dir,'corpus.csv'), out=resolve(dir,'solutions.csv');
const corpusText=rows.map(r=>`${r.id},${r.setup}`).join('\n')+'\n';
if(existsSync(corpus) && readFileSync(corpus,'utf8')!==corpusText) throw Error('Corpus changed');
writeFileSync(corpus,corpusText); atom('input.json',rows);
atom('authorization.json',{userRequest:batch===null?'没事 你直接开始测吧。':'你跑完之后觉得可以的话，就接着跑。但是你要记得断点续传哦。',scope:batch===null?'32 deterministic random ordered pairs x 256 phases':'One 128-pair resumable batch of the long-running AUF job',protection:'Runtime monitoring accepted for this task; not an OS zero-swap guarantee',count:rows.length,seed:20261011});
if(!process.argv.includes('--solve')) { console.log(`Prepared ${rows.length} states; every original state is included.`); process.exit(0); }
const lock=resolve(dir,'owner.pid');
if(existsSync(lock)){try{process.kill(Number(readFileSync(lock,'utf8')),0);throw Error('Owner still running');}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;}unlinkSync(lock);}
const fd=openSync(lock,'wx');writeFileSync(fd,String(process.pid));closeSync(fd);
process.on('exit',()=>{try{unlinkSync(lock);}catch{}});
const memory=()=>{
  const raw=execFileSync('vm_stat',{encoding:'utf8'});
  const n=(k: string)=>{const m=new RegExp(k+':\\s+(\\d+)').exec(raw);if(!m)throw Error(k);return +m[1];};
  const page=+(raw.match(/page size of (\d+)/)?.[1]||0);if(!page)throw Error('page size');
  return {available:(n('Pages free')+n('File-backed pages'))*page,swapouts:n('Swapouts'),pressure:+execFileSync('sysctl',['-n','kern.memorystatus_vm_pressure_level'],{encoding:'utf8'})};
};
const boot=execFileSync('sysctl',['-n','kern.boottime'],{encoding:'utf8'}).trim();
const before=memory();
if((batch!==null||symmetryBatch) && (process.env.AUF_EXPECTED_BOOT!==boot || Number(process.env.AUF_EXPECTED_SWAPOUTS)!==before.swapouts))throw Error('Long-job baseline changed; do not reset');
const prior=existsSync(resolve(dir,'progress.json'))?JSON.parse(readFileSync(resolve(dir,'progress.json'),'utf8')):null;
if(prior?.reason && !prior.reason.startsWith('Interrupted'))throw Error('Prior protection stop needs review; cannot reset baseline');
if(prior && (prior.boot!==boot || prior.baselineSwapouts!==before.swapouts)) throw Error('Resume baseline changed; needs review');
if(before.available<34*2**30 || before.pressure!==1)throw Error(`Insufficient resources: ${JSON.stringify(before)}`);
const running=execFileSync('ps',['-axo','pid,comm'],{encoding:'utf8'}).split('\n').filter(x=>/solve_h48_h10|cube48opt-research|table_generator/.test(x));
if(running.length)throw Error('Another solver is running: '+running.join('\n'));
if(existsSync(out)){const s=readFileSync(out,'utf8');if(s&&!s.endsWith('\n')){writeFileSync(resolve(dir,`partial-${Date.now()}.csv`),s);writeFileSync(out,s.slice(0,s.lastIndexOf('\n')+1));}}
let completed=existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).length:0;
let peak=prior?.peakRssGiB*2**30||0, min=prior?.minimumHeadroomGiB*2**30||Infinity, reason='';
let child: ChildProcess | undefined, timer: ReturnType<typeof setInterval> | undefined; const start=Date.now();
const progress=(status: string, extra={})=>atom('progress.json',{status,completed,total:rows.length,boot,baselineSwapouts:before.swapouts,peakRssGiB:peak/2**30,minimumHeadroomGiB:Number.isFinite(min)?min/2**30:null,elapsedSeconds:(Date.now()-start)/1000,updatedAt:new Date().toISOString(),reason:reason||undefined,...extra});
const stop=(why: string)=>{if(reason)return;reason=why;try{if(child?.pid)process.kill(-child.pid,'SIGTERM');}catch{}progress('stopped');console.error(why);};
try{
  progress('starting',{startMemory:before});
  const wake=spawn('caffeinate',['-i','-w',String(process.pid)],{stdio:'ignore'});wake.unref();
  child=spawn(process.execPath,['--import',resolve(root,'core/node_modules/tsx/dist/loader.mjs'),resolve(root,'solver/333opt/solve_h10.mts'),'--no-counts'],{cwd:resolve(root,'core'),env:{...process.env,CORPUS:corpus,OUT:out},detached:true,stdio:['ignore','pipe','pipe']});
  const closed=new Promise((res,rej)=>{child!.on('error',rej);child!.on('close',res);});
  process.on('SIGINT',()=>stop('Interrupted'));process.on('SIGTERM',()=>stop('Interrupted'));
  timer=setInterval(()=>{try{
    const m=memory();
    if(m.swapouts>before.swapouts)return stop('New swap-out detected');
    if(m.pressure!==1)return stop('Memory pressure increased');
    const budget=observeZbllMemory(process.pid,m.available,boot),rss=budget.rssBytes;
    peak=Math.max(peak,rss);min=Math.min(min,budget.marginBytes);
    if(rss>32*2**30 || budget.marginBytes<2*2**30)return stop('RSS or 2 GiB headroom limit');
    progress('solving',{currentSwapouts:m.swapouts,currentRssGiB:rss/2**30});
  }catch(e){stop('Monitor failed: '+e);}},1000);
  child.stderr!.pipe(process.stderr);
  for await(const line of createInterface({input:child.stdout!})){
    console.log(line);const m=/^\[(\d+)\/(\d+)\]/.exec(line);
    if(m){completed=+m[1];const f=openSync(out,'r+');fsyncSync(f);closeSync(f);progress('solving');}
  }
  const code=await closed;clearInterval(timer);
  if(reason || code!==0)throw Error(reason||'Solver exit '+code);
  const after=memory();if(after.swapouts!==before.swapouts)throw Error('Swapout changed');
  const solved=new Map();const lookup=new Map(rows.map(r=>[r.id,r]));const home=pattern('');
  for(const line of readFileSync(out,'utf8').trim().split('\n')){
    const match=/^(\d+),(\d+),(.+)$/.exec(line);if(!match)throw Error('Bad result');
    const id=+match[1],length=+match[2],alg=normalize(match[3]);const row=lookup.get(id);
    if(!row||solved.has(id)||alg.split(/\s+/).length!==length||pattern(row.setup+' '+alg)!==home)throw Error('State verification failed '+id);
    solved.set(id,length);
  }
  if(solved.size!==rows.length)throw Error('Incomplete solutions');
  if(symmetryBatch){
    completed=solved.size;
    atom('report.json',{states:completed,verified:completed,solutionsSha256:createHash('sha256').update(readFileSync(out)).digest('hex'),elapsedSeconds:(Date.now()-start)/1000,baselineSwapouts:before.swapouts,finalSwapouts:after.swapouts});
    progress('complete',{finalSwapouts:after.swapouts});
  }else{
  const comparison=[...pairs].map(pair=>{
    const rr=rows.filter(r=>r.pair===pair);const lengths=rr.map(r=>solved.get(r.id));const best=Math.min(...lengths),worst=Math.max(...lengths),old=baseline.get(pair);
    if(old===undefined||best>old)throw Error('Best longer than included original or baseline missing');
    return {pair,top:`${cases[rr[0].top].subgroup}|${cases[rr[0].top].name}`,bottom:`${cases[rr[0].bottom].subgroup}|${cases[rr[0].bottom].name}`,original:old,best,saved:old-best,mean:lengths.reduce((s,x)=>s+x,0)/256,worst,bestPhase:rr[lengths.indexOf(best)].phase};
  });
  const avg=(key: 'original'|'best'|'saved'|'mean')=>comparison.reduce((s,x)=>s+x[key],0)/comparison.length;
  const histogram: Record<number,number>={};for(const r of comparison)histogram[r.saved]=(histogram[r.saved]||0)+1;
  completed=solved.size;
  const report={pairCount:pairs.size,states:completed,verified:completed,solutionsSha256:createHash('sha256').update(readFileSync(out)).digest('hex'),originalMean:avg('original'),bestMean:avg('best'),meanSaved:avg('saved'),allPhasesMean:avg('mean'),savedHistogram:histogram,comparison,elapsedSeconds:(Date.now()-start)/1000,peakRssGiB:peak/2**30,minimumHeadroomGiB:min/2**30,baselineSwapouts:before.swapouts,finalSwapouts:after.swapouts};
  atom('report.json',report);writeFileSync(resolve(dir,'comparison.csv'),'pair,top,bottom,original,best,saved,mean,worst,bestPhase\n'+comparison.map(r=>[r.pair,JSON.stringify(r.top),JSON.stringify(r.bottom),r.original,r.best,r.saved,r.mean,r.worst,r.bestPhase].join(',')).join('\n')+'\n');
  progress('complete',{finalSwapouts:after.swapouts});console.log(JSON.stringify(report,null,2));
  }
}catch(e){clearInterval(timer);if(child?.exitCode===null&&child.pid){try{process.kill(-child.pid,'SIGTERM');}catch{}}progress(reason?'stopped':'failed',{error:String(e)});throw e;}
