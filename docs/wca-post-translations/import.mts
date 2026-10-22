import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
const root=dirname(fileURLToPath(import.meta.url));
const {values}=parseArgs({options:{input:{type:'string'}}});
if(!values.input)throw Error('--input is required');
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const progress=read(resolve(root,'progress.json'));
const snapshot=read(resolve(root,progress.snapshot));
const sources=new Map(snapshot.entries.map((e:any)=>[e.key,e]));
const urls=(s:string)=>(s.match(/https?:\/\/[^\s)\]>]+/g)??[]).map(url=>url.replace(/[.,，。；！]+$/g,''));
function files(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(dir,e.name)):e.name.endsWith('.json')?[resolve(dir,e.name)]:[]);}
let saved=0,recovered=0;
mkdirSync(resolve(root,'entries'),{recursive:true});
for(const path of files(resolve(values.input))){
 const draft=read(path);
 if(!draft.key||!draft.sourceHash||typeof draft.content!=='string'||typeof draft.title!=='string')continue;
 const source:any=sources.get(draft.key);
 if(!source||source.hash!==draft.sourceHash)throw Error('Source version mismatch: '+draft.key);
 if(!/[\u3400-\u9fff]/.test(draft.content)||!draft.title.trim())throw Error('Missing Chinese text: '+draft.key);
 const sourceUrls=urls(source.content),translatedUrls=urls(draft.content);
 for(const url of new Set(sourceUrls))if(sourceUrls.filter(x=>x===url).length>translatedUrls.filter(x=>x===url).length)throw Error('Missing source link '+draft.key+': '+url);
 const row=progress.entries.find((e:any)=>e.key===draft.key);
 if(row.status==='linked_existing_disciplinary')throw Error('Do not overwrite reused disciplinary translation');
 const slug=source.url.split('/').at(-1);
 const relative='entries/'+slug+'.json';
 const destination=resolve(root,relative);
 const prior=existsSync(destination)?read(destination):null;
 if(prior&&prior.source.hash===source.hash&&prior.translation.title===draft.title&&prior.translation.content===draft.content&&JSON.stringify(prior.translation.notes)===JSON.stringify(draft.notes??[])){
  if(hash(prior.translation)!==prior.translationHash)throw Error('Saved translation hash mismatch: '+draft.key);
  if(row.status!=='translated'||row.translationHash!==prior.translationHash){
   Object.assign(row,{status:'translated',path:relative,translationVersion:prior.translation.version,translationHash:prior.translationHash,reviewStatus:prior.translation.reviewStatus});
   recovered++;
  }
  continue;
 }
 if(prior){mkdirSync(resolve(root,'versions',slug),{recursive:true});writeFileSync(resolve(root,'versions',slug,prior.translationHash+'.json'),JSON.stringify(prior,null,2)+'\n');}
 const translation={version:(prior?.translation.version??0)+1,sourceHash:source.hash,language:'zh-Hans',title:draft.title,content:draft.content,notes:draft.notes??[],translatedAt:new Date().toISOString(),reviewStatus:'pending_independent_review'};
 const translationHash=hash(translation);
 const record={key:source.key,source,translation,translationHash};
 writeFileSync(destination+'.tmp',JSON.stringify(record,null,2)+'\n');renameSync(destination+'.tmp',destination);
 Object.assign(row,{status:'translated',path:relative,translationVersion:translation.version,translationHash,reviewStatus:'pending_independent_review'});
 saved++;
}
progress.updatedAt=new Date().toISOString();
progress.permission={status:'user_confirmed',scope:'All historical /posts announcements: full Chinese translation',confirmedOn:'2026-10-22'};
progress.counts={total:progress.entries.length,linkedDisciplinary:progress.entries.filter((e:any)=>e.status==='linked_existing_disciplinary').length,translated:progress.entries.filter((e:any)=>e.status==='translated').length,pending:progress.entries.filter((e:any)=>e.status==='pending_translation').length};
writeFileSync(resolve(root,'progress.json.tmp'),JSON.stringify(progress,null,2)+'\n');renameSync(resolve(root,'progress.json.tmp'),resolve(root,'progress.json'));
if(saved||recovered){const checkpoint=progress.updatedAt.replace(/[:.]/g,'-')+'-'+progress.counts.translated+'.json';writeFileSync(resolve(root,'checkpoints',checkpoint),JSON.stringify(progress,null,2)+'\n');}
console.log(JSON.stringify({saved,recovered,...progress.counts}));
