/** Validate source bindings, saved translations, links, and checkpoint recovery. */
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=dirname(fileURLToPath(import.meta.url));
const read=(p:string)=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const p=read('progress.json');
const snapshot=read(p.snapshot);
const sourceMap=new Map(snapshot.entries.map((e:any)=>[e.key,e]));
const errors:string[]=[];
const check=(ok:unknown,text:string)=>{if(!ok)errors.push(text);};
check(sourceMap.size===snapshot.entries.length,'Duplicate snapshot keys');
check(new Set(p.entries.map((e:any)=>e.key)).size===p.entries.length,'Duplicate ledger keys');
check(snapshot.entries.length===p.entries.length,'Snapshot/ledger total mismatch');
const logProgress=read('../wca-log-translations/progress.json');
let translated=0,linked=0,pending=0,links=0;
const urlTokens=(s:string)=>(s.match(/(?:https?:\/\/|mailto:)[^\s)\]>"']+/g)??[]).map(url=>url.replace(/[.,，。；！]+$/g,''));
for(const row of p.entries){
 try{
  const source:any=sourceMap.get(row.key);
  check(Boolean(source),'Missing source: '+row.key);
  check(source?.hash===row.sourceHash&&source?.url===row.url&&source?.sourceId===row.sourceId,'Source binding: '+row.key);
  if(row.status==='linked_existing_disciplinary'){
   linked++;
   const r=logProgress.entries.find((e:any)=>e.key===row.existingKey);
   check(r?.url===row.url&&r?.status==='translated','Reused disciplinary binding: '+row.key);
   continue;
  }
  if(row.status==='pending_translation'){pending++;continue;}
  check(row.status==='translated','Unknown status: '+row.key);
  check(/^entries\/[a-z0-9-]+\.json$/.test(row.path),'Invalid path: '+row.key);
  const record=read(row.path);
  check(record.key===row.key,'Record key: '+row.key);
  check(JSON.stringify(record.source)===JSON.stringify(source),'Source snapshot equality: '+row.key);
  check(record.translation.sourceHash===row.sourceHash,'Translation source hash: '+row.key);
  check(digest(record.translation)===row.translationHash&&record.translationHash===row.translationHash,'Translation hash: '+row.key);
  check(record.translation.version===row.translationVersion,'Translation version: '+row.key);
  check(record.translation.reviewStatus===row.reviewStatus,'Review status: '+row.key);
  if(['independently_verified','pending_source_verification'].includes(row.reviewStatus)){
   const review=record.review;
   check(review?.status===row.reviewStatus&&review?.sourceHash===row.sourceHash,'Review source binding: '+row.key);
   check(review?.reviewedTranslationHash===row.translationHash,'Review translation binding: '+row.key);
   const evidence=review?.report?read(review.report).entries.find((e:any)=>e.key===row.key):null;
   check(evidence?.verdict==='pass'&&evidence?.sourceHash===row.sourceHash&&evidence?.reviewedTranslationHash===row.translationHash,'Independent review evidence: '+row.key);
   check(Boolean(evidence?.sourceConcern)===(row.reviewStatus==='pending_source_verification'),'Source concern status: '+row.key);
  }
  check(/[\u3400-\u9fff]/.test(record.translation.content)&&(/[\u3400-\u9fff]/.test(record.translation.title)||/^TNoodle [\d.]+$/i.test(record.translation.title)),'Chinese content: '+row.key);
  for(const url of new Set(urlTokens(source.content))){
   links++;
   check(record.translation.content.includes(url),'Missing source link: '+row.key+': '+url);
  }
  translated++;
 }catch(e){errors.push(row.key+': '+String(e));}
}
check(p.counts.total===p.entries.length&&p.counts.linkedDisciplinary===linked&&p.counts.translated===translated&&p.counts.pending===pending,'Ledger counts');
const entryFiles=readdirSync(resolve(root,'entries')).filter(f=>f.endsWith('.json'));
check(entryFiles.length===translated,'Entry files vs translated count');
let recovered=0;
const checkpoints=readdirSync(resolve(root,'checkpoints')).filter(f=>f.endsWith('.json')).sort();
for(const file of checkpoints){
 const c=read('checkpoints/'+file);
 check(c.counts.total===c.entries.length,'Checkpoint count: '+file);
 for(const row of c.entries.filter((r:any)=>r.status==='translated')){
  try{
   let record=read(row.path);
   if(record.translationHash!==row.translationHash){
    const archived='versions/'+row.path.split('/').at(-1).replace('.json','')+'/'+row.translationHash+'.json';
    if(!existsSync(resolve(root,archived))){errors.push('Missing checkpoint archive: '+file+': '+row.key);continue;}
    record=read(archived);
   }
   const ok=record.key===row.key&&record.source.hash===row.sourceHash&&digest(record.translation)===row.translationHash&&record.translation.version===row.translationVersion;
   check(ok,'Checkpoint binding: '+file+': '+row.key);
   if(ok)recovered++;
  }catch(e){errors.push('Checkpoint '+file+': '+String(e));}
 }
}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),ok:errors.length===0,counts:{...p.counts,entryFiles:entryFiles.length,sourceLinks:links,checkpoints:checkpoints.length},checkpointBindingsVerified:recovered,snapshotSha256:createHash('sha256').update(readFileSync(resolve(root,p.snapshot))).digest('hex'),errors,scope:'覆盖、来源版本、链接、译文哈希及检查点可恢复性校验；不代替逐条独立语义审校。'},null,2));
if(errors.length)process.exitCode=1;
