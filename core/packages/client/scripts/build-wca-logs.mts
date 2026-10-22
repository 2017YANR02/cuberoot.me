/** Generate website reading data from the versioned translation ledger. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {markdown,sanitize} from './wca-content.mts';
const client=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=resolve(client,'../../..');
const ledgerRoot=resolve(root,'docs/wca-log-translations');
const read=(p:string)=>JSON.parse(readFileSync(resolve(ledgerRoot,p),'utf8'));
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const p=read('progress.json');
const entries=p.entries.map((row:any)=>{
 const e=read(row.path);
 if(e.source.hash!==row.sourceHash||e.translation.sourceHash!==row.sourceHash||digest(e.translation)!==row.translationHash)throw Error(`Ledger mismatch: ${row.key}`);
 const supplements=(e.supplements??[]).filter((s:any)=>s.status==='independently_verified').map((s:any)=>{
  const f=read(s.path);
  if(f.translation.sourceHash!==f.source.hash||digest(f.translation)!==f.translationHash)throw Error(`Supplement mismatch: ${s.path}`);
  return {id:f.key,title:{zh:f.translation.title,en:f.source.title},sourceUrl:f.source.url,date:f.source.publishedAt.slice(0,10),html:{zh:markdown(f.translation.content),en:markdown(f.source.content.replace(/\[\/?(?:u|i|list):[^\]]+\]/g,''))}};
 });
 return {id:e.key,kind:e.source.kind,date:e.source.date.slice(0,10),title:{zh:e.translation.title,en:e.source.title},sourceUrl:e.source.url,html:{zh:markdown(e.translation.content),en:e.source.kind==='disciplinary'?sanitize(e.source.content):markdown(e.source.content)},supplements};
}).sort((a:any,b:any)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
const output=resolve(client,'app/[lang]/regulation/_data/logs.json');
writeFileSync(output,JSON.stringify(entries)+'\n');
console.log(`Saved ${entries.length} log entries to ${output}`);
