/** Read-only consistency check for the local WCA translation ledger. Node 24+. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const root=process.argv.includes('--repository')?'/Users/eula/Developer/cuberoot.me/docs/wca-log-translations':dirname(fileURLToPath(import.meta.url));
const read=(p:string)=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const p=read('progress.json');
const snapshot=read(p.snapshot);
const errors:string[]=[];
const check=(ok:unknown,message:string)=>{if(!ok)errors.push(message);};
const keys=new Set(snapshot.entries.map((e:any)=>e.key));
check(keys.size===snapshot.entries.length,'Duplicate source keys');
check(new Set(p.entries.map((e:any)=>e.key)).size===p.entries.length,'Duplicate progress keys');
check(new Set(p.entries.map((e:any)=>e.path)).size===p.entries.length,'Duplicate entry paths');
check(p.entries.length===snapshot.entries.length,'Snapshot/ledger count mismatch');
let translated=0,reviewed=0,notes=0,links=0;
for(const row of p.entries){
 try{
 const s=snapshot.entries.find((e:any)=>e.key===row.key);
 check(Boolean(s),`Unknown source: ${row.key}`);
 check(/^entries\/[a-z0-9-]+\.json$/.test(row.path),`Unsafe entry path: ${row.key}`);
 const e=read(row.path);
 check(e.key===row.key,`Entry key mismatch: ${row.key}`);
 for(const k of ['key','kind','title','url','date','content','hash'])check(e.source[k]===s?.[k],`Source ${k} mismatch: ${row.key}`);
 check(row.sourceHash===s?.hash && e.translation.sourceHash===s?.hash,`Source version mismatch: ${row.key}`);
 check(row.translationVersion===e.translation.version,`Translation version mismatch: ${row.key}`);
 check(row.translationHash===digest(e.translation),`Translation hash mismatch: ${row.key}`);
 check(e.translation.language==='zh-Hans' && /[\u4e00-\u9fff]/u.test(e.translation.title) && /[\u4e00-\u9fff]/u.test(e.translation.content),`Missing Chinese translation: ${row.key}`);
 check(row.verificationStatus===e.review.status,`Review status mismatch: ${row.key}`);
 check(row.publicationStatus===e.publication.status,`Publication status mismatch: ${row.key}`);
 if(e.review.independent){
   const report=read(e.review.independent.report);
   const reviewed=report.entries.find((r:any)=>r.key===row.key);
   check(reviewed?.sourceHash===row.sourceHash,`Independent source binding: ${row.key}`);
   if(e.review.status==='independently_verified'){
     const evidence=e.review.recheck?read(e.review.recheck.report).entries.find((r:any)=>r.key===row.key):reviewed;
     check(evidence?.verdict==='pass' && evidence?.reviewedTranslationHash===row.translationHash,`Independent translation binding: ${row.key}`);
   }
 }
 const urls=[...new Set((s.content.match(/(?:https?:\/\/|mailto:)[^\s<>"')]+/g)??[]).map((url:string)=>url.replaceAll('&amp;','&')))];
 links+=urls.length;
 for(const url of urls)check(e.translation.content.includes(url),`Missing link: ${row.key}: ${url}`);
 if(row.status==='translated')translated++;
 if(e.review.status==='independently_verified')reviewed++;
 if(e.review.notes.length)notes++;
 }catch(error){errors.push(`${row.key}: ${String(error)}`);}
}
const actualFiles=readdirSync(resolve(root,'entries')).filter(n=>n.endsWith('.json'));
check(actualFiles.length===p.entries.length,'Entry file count mismatch');
check(p.counts.total===p.entries.length && p.counts.translated===translated && p.counts.pending===p.entries.length-translated,'Incorrect progress counts');
for(const kind of ['incidents','disciplinary'])check(p.counts[kind]===p.entries.filter((e:any)=>e.kind===kind).length,`Incorrect ${kind} count`);
const checkpoints=readdirSync(resolve(root,'checkpoints')).filter(n=>n.endsWith('.json')).sort();
let checkpointEntryBindingsVerified=0;
const recovery:any[]=[];
for(const name of checkpoints){
 const c=read('checkpoints/'+name);check(c.entries.length===c.counts.total,`Checkpoint count: ${name}`);check(c.entries.filter((e:any)=>e.status==='translated').length===c.counts.translated,`Checkpoint translated count: ${name}`);
 let recovered=0;
 for(const r of c.entries.filter((r:any)=>r.status==='translated')){
   let e=read(r.path);
   if(digest(e.translation)!==r.translationHash){
     const archived=`versions/${r.path.split('/')[1].replace('.json','')}/${r.translationHash}-v${r.translationVersion}.json`;
     if(!existsSync(resolve(root,archived))){errors.push(`Missing archived checkpoint version: ${name}:${r.key}`);continue;}
     e=read(archived);
   }
   const ok=e.key===r.key && e.source.hash===r.sourceHash && digest(e.translation)===r.translationHash && e.translation.version===r.translationVersion;
   check(ok,`Checkpoint binding: ${name}:${r.key}`);if(ok){recovered++;checkpointEntryBindingsVerified++;}
 }
 recovery.push({path:'checkpoints/'+name,recoverableTranslatedEntries:recovered});
}
check(p.counts.independentlyReviewed===reviewed,'Independent review count mismatch');
check(p.counts.pendingIndependentReview===p.entries.length-reviewed,'Pending review count mismatch');
check(p.counts.entriesWithReviewNotes===notes,'Review note count mismatch');
if(p.counts.linkedAnnouncementsFullTextTranslated){
 const f=read('supplements/forum-388-full.json');
 check(createHash('sha256').update(f.source.content).digest('hex')===f.source.hash,'Forum source hash');
 check(digest(f.translation)===f.translationHash && f.translation.sourceHash===f.source.hash,'Forum translation binding');
 const r=read(f.review.report).entries.find((r:any)=>r.key===f.key);
 check(r?.sourceHash===f.source.hash && r?.reviewedTranslationHash===f.translationHash && r?.verdict==='pass','Forum independent review binding');
 check(f.source.id==='archive:forum_topics/388#p1640' && f.publication.status==='not_authorized','Forum scope/publication');
}
const result={checkedAt:new Date().toISOString(),ok:errors.length===0,counts:{...p.counts,files:actualFiles.length,independentlyReviewed:reviewed,entriesWithNotes:notes,sourceLinkOccurrencesPreserved:links,checkpoints:checkpoints.length},checkpointEntryBindingsVerified,recovery,snapshotSha256:createHash('sha256').update(readFileSync(resolve(root,p.snapshot))).digest('hex'),errors,scope:'结构、版本、覆盖、链接、独立审校证据及检查点恢复一致性；独立审校为原译文语义对照，不代表外部事实核验或公开译载许可。'};
console.log(JSON.stringify(result,null,2));
if(errors.length)process.exitCode=1;
