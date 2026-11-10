#!/usr/bin/env node
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const policyPath=resolve(root,'docs/local-artifact-policy.json');
export const policy=fs.existsSync(policyPath)?JSON.parse(fs.readFileSync(policyPath,'utf8')):{exceptions:[]};
const source=/\.(?:[cm]?[jt]sx?|rs|py|rb|sh|json|ya?ml)$/;
const excluded=/^(?:tools\/|solver\/vendor\/|core\/patches\/|.*\/node_modules\/|.*\/vendor\/)/;
export function temporaryReferences(file,text){
 if(!source.test(file)||excluded.test(file)||/(?:\.test\.|\/tests\/|\/testdata\/|\/fixtures\/)/.test(file))return [];
 if(['docs/local-artifact-paths.json','docs/local-artifact-policy.json'].includes(file)||file.startsWith('scripts/local-artifacts/')||file==='.codex/hooks/block-persistent-temp.mts')return [];
 return text.split('\n').flatMap((line,i)=>{
  const trimmed=line.trim();if(/^(?:\/\/|\*|#)/.test(trimmed))return [];
  // Match path literals, including join(root, '.tmp', 'name'); atomic foo+'.tmp' is allowed.
  const references=[...line.replace(/\+\s*['"]\.tmp['"]/g,'').matchAll(/(?:['"`])(?:[^'"`\s]*\/)?\.?tmp(?:\/[^'"`\s]*|(?=['"`]\s*,))/g)].map(m=>m[0].slice(1));
  const bad=references.filter(ref=>!ref.startsWith('/tmp')&&!ref.includes(':/tmp')&&(
   !/(?:^|\/)\.tmp\/(?:png|scratch|cache)(?:\/|$)/.test(ref)||(/\.[a-z0-9]+$/i.test(ref.split('/').at(-1))&&temporaryWrite(ref))));
  if(!bad.length)return [];
  const allowed=policy.exceptions.some(e=>e.file===file&&e.line===trimmed&&e.reason);
  return allowed?[]:[{file,line:i+1,text:trimmed,paths:bad}];
 });
}
export function temporaryWrite(file){
 const p=file.replaceAll('\\','/');
 if(!/(?:^|\/)\.?tmp(?:\/|$)/.test(p))return null;
 if(!/(?:^|\/)\.tmp\/(?:png|scratch|cache)\//.test(p))return 'Temporary writes must use .tmp/png, .tmp/scratch or .tmp/cache; durable files belong in .local-data or tracked source.';
 if(/(?:^|\/)(?:checkpoint|progress|claim|receipt|protected-stop|authorized_keys|password)(?:[.\/-]|$)|\.(?:bin|dat|sqlite|sqlite3|p8|p12|pem|key)$/i.test(p))return 'Checkpoint, credential, database and solver table files cannot be temporary.';
 if(/(?:^|\/)\.tmp\/png\//.test(p)&&!/[.](?:png|jpg|jpeg|webp|gif|svg)$/i.test(p))return '.tmp/png is reserved for disposable preview images.';
 return null;
}
export function checkRepository(staged=false){
 const args=staged?['diff','--cached','--name-only','--diff-filter=ACMR','-z']:['ls-files','--cached','--others','--exclude-standard','-z'];
 const files=execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024**2}).split('\0').filter(Boolean);
 const violations=[];
 for(const file of files){if(!source.test(file)||excluded.test(file))continue;
  const text=staged?execFileSync('git',['show',':'+file],{cwd:root,encoding:'utf8',maxBuffer:8*1024**2}):fs.readFileSync(resolve(root,file),'utf8');
  violations.push(...temporaryReferences(file,text));
 }
 return violations;
}
export function checkLocalTemporaryFiles(){
 const errors=[];
 function walk(directory){
  if(!fs.existsSync(resolve(root,directory)))return;
  for(const e of fs.readdirSync(resolve(root,directory),{withFileTypes:true})){
   const p=directory+'/'+e.name;
   if(e.isDirectory()){walk(p);continue;}
   if(e.name==='.DS_Store'||policy.disposableLocalFiles?.includes(p))continue;
   const reason=e.isSymbolicLink()?'Temporary symlinks cannot hide durable dependencies':temporaryWrite(p);
   if(reason)errors.push({file:p,reason});
  }
 }
 for(const directory of ['.tmp','core/.tmp','tmp'])walk(directory);
 return errors;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const errors=[...checkRepository(process.argv.includes('--staged')),...(process.argv.includes('--local')?checkLocalTemporaryFiles():[])];
 if(errors.length){console.error(JSON.stringify(errors,null,2));process.exitCode=1;}else console.log('Temporary-path contract passed');
}
