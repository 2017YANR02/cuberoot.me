/** Build local website announcements from saved translations; never publish. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {markdown} from './wca-content.mts';
const client=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=resolve(client,'../../..');
const ledger=resolve(root,'docs/wca-post-translations');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const progress=read(resolve(ledger,'progress.json'));
const logs=read(resolve(client,'app/[lang]/regulation/_data/logs.json'));
const logProgress=read(resolve(root,'docs/wca-log-translations/progress.json'));
const articles=progress.entries.flatMap((row:any)=>{
 const id=row.url.split('/').at(-1);
 if(row.status==='linked_existing_disciplinary'){
  const old=logs.find((entry:any)=>entry.id===row.existingKey);
  const record=logProgress.entries.find((entry:any)=>entry.key===row.existingKey);
  if(!old||!record)throw Error('Missing linked disciplinary entry: '+row.key);
  return [{...old,id,kind:'posts',sourceKey:row.key,sourceHash:row.sourceHash,translationHash:record.translationHash}];
 }
 if(row.status!=='translated')return [];
 const e=read(resolve(ledger,row.path));
 if(e.source.hash!==row.sourceHash||e.translation.sourceHash!==row.sourceHash||digest(e.translation)!==row.translationHash)throw Error('Ledger mismatch: '+row.key);
 return [{id,kind:'posts',sourceKey:e.key,sourceHash:e.source.hash,translationHash:row.translationHash,date:e.source.date.slice(0,10),title:{zh:e.translation.title,en:e.source.title},sourceUrl:e.source.url,html:{zh:markdown(e.translation.content),en:markdown(e.source.content)},supplements:[]}];
}).sort((a:any,b:any)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
const out=resolve(client,'app/[lang]/regulation/_data');
writeFileSync(resolve(out,'posts.json'),JSON.stringify(articles)+'\n');
writeFileSync(resolve(out,'posts-index.json'),JSON.stringify(articles.map(({id,date,title}:any)=>({id,date,title})))+'\n');
console.log(JSON.stringify({websiteArticles:articles.length,linkedDisciplinary:progress.counts.linkedDisciplinary,newTranslations:progress.counts.translated,pending:progress.counts.pending}));
