/** Offline scoring/export. Never invokes a model or accesses production. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const dir=path.resolve(root,process.env.ASSISTANT_EVALUATION_DIR || '.local-data/assistant-evaluation-20261112');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const lines=name=>fs.readFileSync(path.join(dir,name),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const hash=x=>createHash('sha256').update(x).digest('hex');
const sample=r=>hash(`${r.repeat}:${r.variant}:${r.id}`).slice(0,10);
const rows=lines('results.jsonl'),grades=read('manual-grades.json');
const hadInvalidAssembly=fs.existsSync(path.join(dir,'invalid-assembly-run/results.jsonl'));
const oldRows=hadInvalidAssembly?lines('invalid-assembly-run/results.jsonl'):[],oldGrades=hadInvalidAssembly?read('invalid-assembly-run/manual-grades.json'):{};
// Reuse a prior content judgment only when the entire answer artifact is identical.
// Failed/invalid assembly samples and excluded cases are never carried forward.
const previous=new Map(oldRows.filter(r=>r.result&&oldGrades[sample(r)]?.[0]!=null).map(r=>[r.id+':'+hash(JSON.stringify(r.result)),oldGrades[sample(r)]]));
for(const row of rows)if(!grades[sample(row)]&&row.result){const prior=previous.get(row.id+':'+hash(JSON.stringify(row.result)));if(prior)grades[sample(row)]=[prior[0],prior[1]+'（最终回答及结构化结果与已审阅样本完全相同）'];}
fs.writeFileSync(path.join(dir,'manual-grades.json'),JSON.stringify(grades,null,2));
const anonymous=rows.map(r=>({sample:sample(r),group:hash(r.repeat+':'+r.variant).slice(0,10),id:r.id,question:r.question,error:r.error,...r.result})).sort((a,b)=>a.id.localeCompare(b.id)||a.sample.localeCompare(b.sample));
fs.writeFileSync(path.join(dir,'anonymous-answers.json'),JSON.stringify(anonymous,null,2));
const pending=anonymous.filter(r=>!grades[r.sample]);
fs.writeFileSync(path.join(dir,'pending-review.json'),JSON.stringify(pending,null,2));
if(process.argv.includes('--review')){console.log(JSON.stringify({completed:rows.length,reviewed:rows.length-pending.length,pending}));process.exit(0);}
if(rows.length!==120||pending.length)throw new Error(`Incomplete evaluation: ${rows.length}/120 rows, ${pending.length} ungraded`);
if(new Set(rows.map(r=>`${r.repeat}:${r.variant}:${r.id}`)).size!==rows.length)throw new Error('Duplicate evaluation rows');
const median=a=>{const s=a.filter(Number.isFinite).sort((a,b)=>a-b),n=s.length;return n?(s[Math.floor(n/2)]+s[Math.ceil(n/2)-1])/2:null;};
const p95=a=>{const s=a.filter(Number.isFinite).sort((a,b)=>a-b);return s.length?s[Math.ceil(s.length*.95)-1]:null;};
const sum=a=>a.reduce((n,x)=>n+x,0);
function pricing(calls){
 let gross=0,min=0,max=0,unknown=0,uncachedUnknown=0,input=0,output=0,cached=0,embeddings=0;
 for(const c of calls){
  if(!Number.isFinite(c.input)||!Number.isFinite(c.output)){unknown++;continue;}
  if(/embedding/.test(c.model)){const cost=c.input*.5/1e6;gross+=cost;min+=cost;max+=cost;embeddings+=c.input;continue;}
  input+=c.input;output+=c.output;const hit=Number.isFinite(c.cached)?c.cached:0;if(!Number.isFinite(c.cached))uncachedUnknown++;
  cached+=hit;const peak=((c.input-hit)*2+hit*.04+c.output*8)/1e6;gross+=(c.input*2+c.output*8)/1e6;min+=peak*.5;max+=peak;
 }
 return {grossCny: gross,cacheAdjustedCny:{min,max},unknownUsageCalls:unknown,unknownCacheCalls:uncachedUnknown,input,output,cached,embeddingTokens:embeddings};
}
const isModel=c=>!/embedding|rerank/.test(c.model);
function summary(items){
 const scores=items.map(r=>grades[sample(r)][0]),calls=items.flatMap(r=>r.providerCalls),price=pricing(calls);
 return {n:items.length,full:scores.filter(s=>s===2).length,partial:scores.filter(s=>s===1).length,failed:scores.filter(s=>s===0).length,errors:items.filter(r=>r.error).length,qualityPercent:100*sum(scores)/(items.length*2),medianMs:median(items.map(r=>r.durationMs)),p95Ms:p95(items.map(r=>r.durationMs)),firstVisibleMedianMs:median(items.filter(r=>!r.error).map(r=>r.firstAnswerMs)),modelCalls:calls.filter(isModel).length,embeddingCalls:calls.filter(c=>/embedding/.test(c.model)).length,zeroModelTurns:items.filter(r=>!r.providerCalls.some(isModel)).length,...price,perTurnGrossCny:price.grossCny/items.length,perTurnCacheAdjustedCny:{min:price.cacheAdjustedCny.min/items.length,max:price.cacheAdjustedCny.max/items.length},peakRssMb:Math.max(...items.map(r=>r.rssMb))};
}
const variants=['before','after'],valid=rows.filter(r=>grades[sample(r)][0]!==null);
const pairs=valid.filter(r=>r.variant==='before').map(before=>({before,after:valid.find(r=>r.variant==='after'&&r.id===before.id&&r.repeat===before.repeat)})).filter(p=>p.after);
const pairedSuccess=new Set(pairs.filter(p=>p.before.result&&p.after.result).map(p=>p.before.repeat+':'+p.before.id));
const pairedCorrect=new Set(pairs.filter(p=>grades[sample(p.before)][0]===2&&grades[sample(p.after)][0]===2).map(p=>p.before.repeat+':'+p.before.id));
const group=fn=>Object.fromEntries(variants.map(v=>[v,summary(valid.filter(r=>r.variant===v&&fn(r)))]));
const categories=Object.fromEntries([...new Set(valid.map(r=>r.category))].map(category=>[category,group(r=>r.category===category)]));
const comparison=read('cases.json').cases.map(c=>({id:c.id,category:c.category,question:c.question,...Object.fromEntries(variants.map(v=>[v,{...summary(valid.filter(r=>r.variant===v&&r.id===c.id)),scores:rows.filter(r=>r.variant===v&&r.id===c.id).map(r=>({repeat:r.repeat,score:grades[sample(r)][0],reason:grades[sample(r)][1],answer:r.result?.answer,error:r.error}))}]))}));
const calls=lines('provider-calls.jsonl');
const result={createdAt:new Date().toISOString(),sampleCount:rows.length,validCount:valid.length,excluded:rows.filter(r=>grades[sample(r)][0]===null).map(r=>({id:r.id,variant:r.variant,repeat:r.repeat})),overall:group(()=>true),normal:group(r=>!r.fault),faults:group(r=>!!r.fault),bothSucceeded:group(r=>pairedSuccess.has(r.repeat+':'+r.id)),bothFullyCorrect:group(r=>pairedCorrect.has(r.repeat+':'+r.id)),modelGenerated:group(r=>r.providerCalls.some(isModel)),categories,pairedQuality:{better:pairs.filter(p=>grades[sample(p.after)][0]>grades[sample(p.before)][0]).length,same:pairs.filter(p=>grades[sample(p.after)][0]===grades[sample(p.before)][0]).length,worse:pairs.filter(p=>grades[sample(p.after)][0]<grades[sample(p.before)][0]).length},costs:{completedCurrentRun:pricing(rows.flatMap(r=>r.providerCalls)),invalidAssemblyRun:pricing(oldRows.flatMap(r=>r.providerCalls)),indexKnown:pricing(calls.filter(c=>c.phase==='index')),diagnostic:pricing(calls.filter(c=>c.phase==='diagnostic')),initialIndexKnownGrossCny:hadInvalidAssembly?.004129:0,initialIndexUnknownUsageCalls:hadInvalidAssembly?1:0,ledger:read('paid-ledger.json')},hashes:{results:hash(fs.readFileSync(path.join(dir,'results.jsonl'))),grades:hash(fs.readFileSync(path.join(dir,'manual-grades.json'))),manifest:hash(fs.readFileSync(path.join(dir,'run-manifest.json')))}};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(dir,'comparison.json'),JSON.stringify(comparison,null,2));
const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(dir,'comparison.csv'),[['id','category','question','before_scores','after_scores','before_median_ms','after_median_ms','before_gross_cny_per_turn','after_gross_cny_per_turn'].map(csv).join(','),...comparison.map(c=>[c.id,c.category,c.question,c.before.scores.map(s=>s.score).join('/'),c.after.scores.map(s=>s.score).join('/'),c.before.medianMs,c.after.medianMs,c.before.perTurnGrossCny,c.after.perTurnGrossCny].map(csv).join(','))].join('\n')+'\n');
fs.writeFileSync(path.join(dir,'answers.md'),'# 完整问答与评分\n\n'+comparison.map(c=>`## ${c.id} ${c.question}\n\n`+variants.map(v=>`### ${v==='before'?'优化前':'优化后'}\n\n`+rows.filter(r=>r.variant===v&&r.id===c.id).map(r=>`第 ${r.repeat} 轮 · 评分 ${grades[sample(r)][0]??'排除'}/2 · ${r.durationMs} ms\n\n${r.result?.answer??'错误：'+r.error}\n\n${(r.result?.artifacts??[]).filter(a=>a.kind==='table').map(a=>[a.title,a.columns.join(' | '),...a.rows.map(row=>row.join(' | '))].join('\n')).join('\n\n')}\n\n评分理由：${grades[sample(r)][1]}\n\n`).join('')).join('')).join(''));
console.log(JSON.stringify({overall:result.overall,pairedQuality:result.pairedQuality,bothSucceeded:result.bothSucceeded,costs:result.costs},null,2));
