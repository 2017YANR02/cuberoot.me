/** Explicit paid evaluation, using frozen runtime bundles and public fixtures. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';import {parseEnv} from 'node:util';import postgres from 'postgres';
import os from 'node:os';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..'),dir=path.resolve(root,process.env.ASSISTANT_EVALUATION_DIR || '.local-data/assistant-evaluation-20261112');
const runConfig=fs.existsSync(path.join(dir,'config.json'))?JSON.parse(fs.readFileSync(path.join(dir,'config.json'))):{};
const knowledgeDb=variant=>runConfig.knowledgeDatabases?.[variant] ?? 'assistant_eval_'+variant;
const diagnostic=process.argv.includes('--diagnose');
if(!process.argv.includes('--run')&&!process.argv.includes('--index')&&!diagnostic)throw new Error('Explicit --index, --run or --diagnose required');
const env=parseEnv(fs.readFileSync(path.join(root,'core/apps/api/.env'),'utf8'));
for(const [key,value]of Object.entries(env))if(/^(?:SITE_ASSISTANT|DEEPSEEK)/.test(key))process.env[key]=value;
Object.assign(process.env,{DB_HOST:'127.0.0.1',DB_PORT:'55487',DB_USER:'eula',DB_PASS:'',DB_NAME:'assistant_eval_data',SITE_ASSISTANT_KNOWLEDGE_ENABLED:'1',SITE_ASSISTANT_RERANK_ENABLED:'0',SITE_ASSISTANT_WEB_ENABLED:'0'});
const sha=x=>createHash('sha256').update(x).digest('hex');
const build=JSON.parse(fs.readFileSync(path.join(dir,'build-manifest.json')));
for(const variant of ['before','after'])if(sha(fs.readFileSync(path.join(dir,variant+'.mjs')))!==build.variants[variant].bundleSha256)throw new Error('Frozen bundle changed');
if(diagnostic&&sha(fs.readFileSync(path.join(dir,'diagnostic.mjs')))!==JSON.parse(fs.readFileSync(path.join(dir,'diagnostic-manifest.json'))).instrumentedSha256)throw new Error('Diagnostic bundle changed');
const runtime={before:await import(pathToFileURL(path.join(dir,'before.mjs'))),after:await import(pathToFileURL(path.join(dir,diagnostic?'diagnostic.mjs':'after.mjs')))};
const corpus=JSON.parse(fs.readFileSync(path.join(dir,'corpus.json'))),cases=JSON.parse(fs.readFileSync(path.join(dir,'cases.json'))).cases;
const sources=JSON.parse(fs.readFileSync(path.join(dir,'sources.json'))),network=globalThis.fetch;
const canonical=url=>{const u=new URL(String(url));u.searchParams.sort();return u.href;};
const responses=new Map(sources.filter(source=>source.status===200).map(source=>[canonical(source.url),source]));
const budgetPath=path.join(dir,'paid-ledger.json'),ledger=fs.existsSync(budgetPath)?JSON.parse(fs.readFileSync(budgetPath)): {turns:0,providerCalls:0,grossCny:0,knownCachedCny:0,limitTurns:128,limitCny:20,limitProviderCalls:700};
let capture=[],pending=[],reads=[],activeCase,activeVariant;
const persistCall=record=>fs.appendFileSync(path.join(dir,'provider-calls.jsonl'),JSON.stringify({phase:process.argv.includes('--index')?'index':diagnostic?'diagnostic':'answer',variant:activeVariant,caseId:activeCase?.id,...record})+'\n',{mode:0o600});
const saveLedger=()=>fs.writeFileSync(budgetPath,JSON.stringify(ledger,null,2),{mode:0o600});
function usageCost(model,usage){
 const input=usage?.prompt_tokens??usage?.input_tokens??usage?.total_tokens,output=usage?.completion_tokens??usage?.output_tokens??0;
 const cached=usage?.prompt_cache_hit_tokens??usage?.prompt_tokens_details?.cached_tokens;
 const rates=/embedding|rerank/.test(model)?[.5,0]:[2,8];
 return {input,output,cached,grossCny:Number.isFinite(input)?(input*rates[0]+output*rates[1])/1e6:null,cacheAdjustedPeakCny:Number.isFinite(input)&&Number.isFinite(cached)?((input-cached)*rates[0]+cached*.04+output*rates[1])/1e6:null};
}
function parseProvider(text,request){
 let frames=[];try{frames=[JSON.parse(text)];}catch{frames=text.split('\n').filter(line=>line.startsWith('data:')&&!line.includes('[DONE]')).flatMap(line=>{try{return [JSON.parse(line.slice(5))]}catch{return []}});}
 const usage=frames.map(frame=>frame.usage).filter(Boolean).at(-1),model=frames.map(frame=>frame.model).find(Boolean)??request.model;
 const calls=new Map();for(const frame of frames)for(const call of frame.choices?.[0]?.delta?.tool_calls??frame.choices?.[0]?.message?.tool_calls??[]){const key=call.index??call.id??calls.size,prior=calls.get(key)??{name:'',arguments:''};prior.name+=call.function?.name??'';prior.arguments+=call.function?.arguments??'';calls.set(key,prior);}
 return {model,usage,toolCalls:[...calls.values()],...usageCost(model,usage)};
}
globalThis.fetch=async(input,init)=>{
 const url=new URL(String(input));
 const provider=url.origin==='https://api.deepseek.com'||url.origin===new URL(env.SITE_ASSISTANT_BASE_URL).origin;
 if(provider){
  if(ledger.grossCny>=ledger.limitCny||ledger.providerCalls>=ledger.limitProviderCalls)throw new Error('Evaluation provider budget exhausted');
  ledger.providerCalls++;saveLedger();
  const request=JSON.parse(String(init?.body??'{}')),started=performance.now();const record={model:request.model,path:url.pathname,startedAt:new Date().toISOString(),stream:!!request.stream,maxTokens:request.max_tokens??request.max_completion_tokens};capture.push(record);
  let response;try{response=await network(input,{...init,redirect:'error'});}catch(error){Object.assign(record,{error:error.name,durationMs:Math.round(performance.now()-started),usageMissing:true});persistCall(record);throw error;}record.httpStatus=response.status;record.headersMs=Math.round(performance.now()-started);
  pending.push(response.clone().text().then(text=>{Object.assign(record,parseProvider(text,request),{durationMs:Math.round(performance.now()-started)});ledger.grossCny+=record.grossCny??0;ledger.knownCachedCny+=record.cacheAdjustedPeakCny??0;saveLedger();}).catch(()=>{record.usageMissing=true;}).finally(()=>persistCall(record)));
  return response;
 }
 reads.push(url.href);
 if(activeCase?.fault==='forum_503'&&url.pathname==='/v1/forum/search')return new Response('',{status:503});
 if(url.href==='https://next.cuberoot.me/assistant/pages.json')return Response.json(corpus);
 let source=responses.get(canonical(url));
 if(!source&&url.pathname==='/v1/wca/historical-ranks'){
  const size=Number(url.searchParams.get('size')??10),larger=new URL(url);larger.searchParams.set('size','20');
  source=responses.get(canonical(larger));
  if(source&&size<=20){const data=JSON.parse(fs.readFileSync(path.join(dir,source.file)));return Response.json({...data,size,rows:data.rows.slice(0,size)});}
 }
 if(source)return new Response(fs.readFileSync(path.join(dir,source.file)),{status:source.status,headers:{'Content-Type':source.type??'application/json'}});
 // No undisclosed live source reads once the experiment starts.
 return new Response('',{status:404,headers:{'X-Evaluation-Fixture-Miss':'1'}});
};
if(process.argv.includes('--index')){
 const results=[];
 for(const variant of ['before','after']){
  activeVariant=variant;
  process.env.SITE_ASSISTANT_KNOWLEDGE_DB_NAME=knowledgeDb(variant);
  const db=runtime[variant].knowledgeDatabase();
  try{
   await db.unsafe('CREATE EXTENSION IF NOT EXISTS vector');
   await db.unsafe(fs.readFileSync(path.join(root,'core/apps/api/migrations/0270_assistant_knowledge.sql'),'utf8'));
   const [metadata]=await db`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='site_assistant_knowledge_chunks' AND column_name='metadata') AS present`;
   if(variant==='after'&&!metadata.present)await db.unsafe(fs.readFileSync(path.join(root,'core/apps/api/migrations/0324_assistant_knowledge_metadata.sql'),'utf8'));
   // Offline preparation may retry transient embedding failures; query budgets remain unchanged.
   const result=await runtime[variant].indexKnowledge(db,corpus,runtime[variant].assistantEmbeddingConfig().identity,AbortSignal.timeout(600000),(texts,signal)=>runtime[variant].embedKnowledge(texts,signal,globalThis.fetch,{timeoutMs:30000,maxRetries:2}));
   await Promise.all(pending);pending=[];results.push({variant,result,calls:capture});capture=[];
   console.log(JSON.stringify({event:'indexed',variant,...result}));
  }finally{await Promise.all(pending);await db.end({timeout:0});}
 }
 fs.writeFileSync(path.join(dir,'index-results.json'),JSON.stringify(results,null,2));process.exit(0);
}
const rowsPath=path.join(dir,'results.jsonl'),existing=fs.existsSync(rowsPath)?fs.readFileSync(rowsPath,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const completed=new Set(existing.map(row=>`${row.repeat}:${row.variant}:${row.id}`));
const states=new Map();
function historyText(result){return [result.answer,...(result.artifacts??[]).filter(a=>a.kind==='table').map(table=>[table.title,table.columns.join('\t'),...table.rows.map(row=>row.join('\t'))].join('\n'))].join('\n\n').slice(0,12000);}
function updateState(row){if(!row.conversation)return;const key=`${row.repeat}:${row.variant}:${row.conversation}`,state=states.get(key)??{history:[]};if(row.result){state.history.push({role:'user',content:row.question},{role:'assistant',content:historyText(row.result)});state.history=state.history.slice(-10);state.context=row.context;}states.set(key,state);}
for(const row of existing)updateState(row);
if(diagnostic){
 const id=process.argv[process.argv.indexOf('--diagnose')+1],item=cases.find(c=>c.id===id);if(!item)throw new Error('Unknown diagnostic case');
 if(ledger.turns>=ledger.limitTurns||ledger.grossCny>=ledger.limitCny)throw new Error('Evaluation budget exhausted');
 states.clear();for(const row of existing.filter(r=>r.repeat===1&&r.variant==='after'&&r.conversation===item.conversation&&cases.findIndex(c=>c.id===r.id)<cases.indexOf(item)))updateState(row);
 const state=states.get(`1:after:${item.conversation}`)??{history:[]};ledger.turns++;saveLedger();activeCase=item;activeVariant='after';process.env.SITE_ASSISTANT_KNOWLEDGE_DB_NAME='assistant_eval_after';
 const output=await runtime.after.run({...item,history:state.history,context:state.context,viewerWcaId:'2017YANR02'},globalThis.fetch);await Promise.all(pending);
 fs.appendFileSync(path.join(dir,'diagnostic-results.jsonl'),JSON.stringify({id,at:new Date().toISOString(),...output,providerCalls:capture,reads})+'\n',{mode:0o600});
 console.log(JSON.stringify({id,error:output.error,diagnosticStack:output.diagnosticStack,ms:output.durationMs}));process.exit(0);
}
const manifest={createdAt:new Date().toISOString(),model:runtime.before.assistantConfig().model,node:process.version,code:build.variants,corpusSha256:sha(fs.readFileSync(path.join(dir,'corpus.json'))),casesSha256:sha(fs.readFileSync(path.join(dir,'cases.json'))),fixtureSha256:sha(fs.readFileSync(path.join(dir,'sources.json'))),budget:{turns:ledger.limitTurns,cny:ledger.limitCny,providerCalls:ledger.limitProviderCalls},repeats:2,mode:'code',thinking:'auto',hybrid:true,rerank:false,webSearch:false,surface:'in-process actual assistant; real model/embedding; frozen public HTTP data; local PostgreSQL; no public ingress or production auth',cache:'provider cache uncontrolled; report actual cache usage',order:'per question AB/BA alternated; reverse for second repeat',dataScope:'1796 navigation entries, 24 public page bodies, complete histories for four named competitors, frozen competition calendars; no global SQL claims',billingSource:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/'};
if(!fs.existsSync(path.join(dir,'run-manifest.json')))fs.writeFileSync(path.join(dir,'run-manifest.json'),JSON.stringify(manifest,null,2));
for(let repeat=1;repeat<=2;repeat++)for(const [i,item]of cases.entries())for(const variant of (i+repeat)%2?['before','after']:['after','before']){
 if(completed.has(`${repeat}:${variant}:${item.id}`))continue;
 if(os.freemem()<2*1024**3)throw new Error('Evaluation stopped: less than 2 GiB free memory');
 if(ledger.turns>=ledger.limitTurns||ledger.grossCny>=ledger.limitCny)throw new Error('Evaluation turn/cost budget exhausted');
 ledger.turns++;saveLedger();activeCase=item;activeVariant=variant;capture=[];pending=[];reads=[];
 process.env.SITE_ASSISTANT_KNOWLEDGE_DB_NAME=knowledgeDb(variant);
 const state=states.get(`${repeat}:${variant}:${item.conversation}`)??{history:[]};
 const output=await runtime[variant].run({...item,history:state.history,context:state.context,viewerWcaId:'2017YANR02'},globalThis.fetch);
 await Promise.all(pending);
 const row={repeat,variant,...item,at:new Date().toISOString(),...output,providerCalls:capture,reads,grossCny:capture.reduce((n,r)=>n+(r.grossCny??0),0),cacheAdjustedPeakCny:capture.every(r=>r.cacheAdjustedPeakCny!=null)?capture.reduce((n,r)=>n+r.cacheAdjustedPeakCny,0):null,rssMb:Math.round(process.memoryUsage().rss/1048576)};
 fs.appendFileSync(rowsPath,JSON.stringify(row)+'\n',{mode:0o600});updateState(row);
 console.log(JSON.stringify({repeat,variant,id:item.id,ms:row.durationMs,error:row.error,calls:capture.length,cny:row.grossCny,completed:ledger.turns}));
 if(row.rssMb>1200)throw new Error('Evaluation memory limit reached');
}
console.log(JSON.stringify({event:'complete',turns:ledger.turns,providerCalls:ledger.providerCalls,grossCny:ledger.grossCny}));
process.exit(0);
