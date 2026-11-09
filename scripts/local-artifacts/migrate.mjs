#!/usr/bin/env node
// Metadata-only migration. Never loads tables, runs engines, deletes, or overwrites.
import fs from 'node:fs';
import {resolve, dirname, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2),apply=args.includes('--apply');
let only;
for(let i=0;i<args.length;i++){
 if(args[i]==='--apply')continue;
 if(args[i]==='--only'&&args[i+1]){only=args[++i];continue;}
 throw Error('Usage: migrate.mjs [--apply] [--only SOURCE]');
}
const contract=JSON.parse(fs.readFileSync(resolve(root,'docs/local-artifact-paths.json'),'utf8'));
if(only&&!contract.mappings.some(entry=>entry.from===only))throw Error('Unregistered migration source');
const safe=p=>{const f=resolve(root,p),r=relative(root,f);if(!r||r.startsWith('../')||isAbsolute(r))throw Error('Unsafe migration path');return f;};
if(apply&&process.platform!=='win32'){
 const processes=execFileSync('ps',['-axo','comm'],{encoding:'utf8'});
 if(/(?:^|\/)(?:cube48opt-research|table_generator|solve_h48_h10|(?:std|pair|pseudo_pair|f2leo|pseudo_f2leo)_analyzer)\s*$/m.test(processes))throw Error('An active compute process must finish before migration');
}
const receipt=resolve(root,'.local-data/migrations/tmp-2026-11-09');
if(apply)fs.mkdirSync(receipt,{recursive:true});
let moved=0,missing=0;
for(const entry of contract.mappings){
 if(only&&entry.from!==only)continue;
 const source=safe(entry.from),destination=safe(entry.to);
 if(!fs.existsSync(source)){missing++;continue;}
 if(fs.existsSync(destination))throw Error(`Both paths exist; preserve and reconcile manually: ${entry.from} -> ${entry.to}`);
 if(apply){
  // Capture the directory's identity before its same-volume atomic rename.
  const s=fs.lstatSync(source);
  const record={...entry,device:s.dev,inode:s.ino,bytes:s.size,movedAt:new Date().toISOString()};
  fs.appendFileSync(resolve(receipt,'moves.jsonl'),JSON.stringify({...record,status:'planned'})+'\n');
  fs.mkdirSync(dirname(destination),{recursive:true});
  fs.renameSync(source,destination);
  const d=fs.lstatSync(destination);
  if(d.dev!==s.dev||d.ino!==s.ino)throw Error('Unexpected object identity after rename');
  fs.appendFileSync(resolve(receipt,'moves.jsonl'),JSON.stringify({...record,status:'moved'})+'\n');
 }
 moved++;
}
console.log(JSON.stringify({mode:apply?'applied':'plan',moved,missing,receipt:relative(root,receipt)}));
