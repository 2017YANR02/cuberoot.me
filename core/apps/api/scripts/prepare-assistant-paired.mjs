/** Freeze a local before/after assessment from preserved source exports. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const previous=path.join(root,'.local-data/assistant-optimization-20261112');
const out=path.resolve(root,process.env.ASSISTANT_EVALUATION_DIR || '.local-data/assistant-evaluation-20261112');
const previousEvaluation=process.env.ASSISTANT_EVALUATION_BASE ? path.resolve(root,process.env.ASSISTANT_EVALUATION_BASE) : undefined;
const sha=value=>createHash('sha256').update(value).digest('hex');
const baseline=JSON.parse(fs.readFileSync(path.join(previous,'plan.json'),'utf8'));
const cache=new Map(),manifests={};
fs.mkdirSync(out,{recursive:true});
for(const variant of ['before','after']) {
  if(previousEvaluation && variant==='before') {
    const prior=JSON.parse(fs.readFileSync(path.join(previousEvaluation,'build-manifest.json')));
    const bytes=fs.readFileSync(path.join(previousEvaluation,'after.mjs'));
    if(sha(bytes)!==prior.variants.after.bundleSha256)throw new Error('Prior candidate bundle changed');
    fs.writeFileSync(path.join(out,'before.mjs'),bytes);
    manifests.before={...prior.variants.after,origin:'previous-frozen-candidate',directory:previousEvaluation};continue;
  }
  const inputs=[];
  const entry=`export {assistantConfig} from './src/utils/site_assistant.ts';
import {answerSiteQuestion,assistantConfig} from './src/utils/site_assistant.ts';
import {startAssistantMonitor} from './src/utils/site_assistant_monitor.ts';
${variant==='after'?"import {assistantAnswerContext} from './src/utils/site_assistant_context.ts';":"const assistantAnswerContext=()=>undefined;"}
${variant==='after'?"import {AssistantOutputError} from './src/utils/site_assistant_model.ts';export function verifyAdapter(){return new AssistantOutputError('invalid_json').repairInstruction();}":""}
export {indexKnowledge,knowledgeDatabase} from './src/utils/site_assistant_knowledge_db.ts';
export {assistantEmbeddingConfig,embedKnowledge} from './src/utils/site_assistant_embedding.ts';
export {knowledgeGeneration,chunkKnowledge,KNOWLEDGE_VERSION} from './src/utils/site_assistant_knowledge.ts';
export async function run(input,fetcher){
 let metrics,firstAnswerMs=null;const started=performance.now();
 const monitor=await startAssistantMonitor({uid:null,question:input.question,lang:input.lang??'zh',model:assistantConfig().model,streaming:true,imageCount:0,historyCount:input.history.length,thinking:'auto'},async(sql,params)=>{if(sql.startsWith('UPDATE'))metrics=params[7];return [];});
 const statuses=[];const emit=async event=>{if(event.type==='status')statuses.push(event.status);if(event.type==='answer'&&event.answer){firstAnswerMs??=performance.now()-started;monitor.text(event.answer);}};
 try{const result=await monitor.run(()=>answerSiteQuestion(input.question,input.lang??'zh',assistantConfig(),AbortSignal.timeout(65000),fetcher,input.history,input.viewerWcaId,emit,'Asia/Shanghai',[],'auto',{},input.context));await monitor.finish('success',undefined,result);return {result,context:assistantAnswerContext(result),metrics,statuses,firstAnswerMs:Math.round(firstAnswerMs??performance.now()-started),durationMs:Math.round(performance.now()-started)};}
 catch(error){await monitor.finish('error',error.code??error.name);return {error:error.code??error.name,metrics,statuses,firstAnswerMs,durationMs:Math.round(performance.now()-started)};}
}`;
  await build({stdin:{contents:entry,resolveDir:path.join(root,'core/apps/api'),sourcefile:`paired-${variant}.ts`,loader:'ts'},bundle:true,platform:'node',target:'node24',format:'esm',outfile:path.join(out,`${variant}.mjs`),logLevel:'warning',loader:{'.ttf':'dataurl','.webp':'dataurl','.woff2':'dataurl'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},plugins:[{name:'frozen-source',setup(api){
    api.onLoad({filter:/\.(?:[cm]?[jt]sx?|json)$/},args=>{
      if(!args.path.startsWith(root+'/core/')||args.path.includes('/node_modules/'))return;
      const relative=path.relative(root,args.path);let bytes,origin;
      if(previousEvaluation) {
        const prior=path.join(previousEvaluation,'source/after',relative),override=path.join(out,'candidate-overrides',relative);
        const input=fs.existsSync(override)?override:prior;
        if(!fs.existsSync(input))throw new Error('Unfrozen evaluation input: '+relative);
        bytes=fs.readFileSync(input);origin=fs.existsSync(override)?'local-regression-fix':'previous-frozen-candidate';
        const destination=path.join(out,'source',variant,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
        inputs.push({path:relative,origin,sha256:sha(bytes)});
        const ext=path.extname(args.path);return {contents:bytes,loader:ext==='.json'?'json':/tsx|jsx/.test(ext)?'tsx':/ts/.test(ext)?'ts':'js',resolveDir:path.dirname(args.path)};
      }
      const before=path.join(previous,'baseline',relative),after=path.join(previous,'verified-source',relative),common=path.join(out,'common-source',relative);
      if(variant==='after'&&fs.existsSync(after)){bytes=fs.readFileSync(after);origin='verified-candidate';}
      else if(fs.existsSync(before)){bytes=fs.readFileSync(before);origin='preserved-baseline';}
      else {if(!cache.has(relative))cache.set(relative,{bytes:fs.readFileSync(fs.existsSync(common)?common:args.path),origin:fs.existsSync(common)?baseline.head:'shared-generated-dependency'});({bytes,origin}=cache.get(relative));}
      // Concurrent formula-card work is not the RAG treatment variable.
      if(variant==='after'&&relative==='core/apps/api/src/utils/site_assistant_tools.ts'){bytes=fs.readFileSync(path.join(previous,'merge',relative));origin='reviewed-rag-merge-without-concurrent-formula-cards';}
      if(variant==='after'&&relative==='core/apps/api/src/utils/site_assistant.ts'){
        const old=fs.readFileSync(path.join(previous,'merge',relative),'utf8').split('\n').find(line=>line.startsWith('algorithms {'));
        bytes=Buffer.from(bytes.toString().split('\n').map(line=>line.startsWith('algorithms {')?old:line).join('\n'));
      }
      const corrected=path.join(out,'candidate-overrides',relative);
      if(variant==='after'&&fs.existsSync(corrected)){bytes=fs.readFileSync(corrected);origin='pre-evaluation-index-compatibility-fix';}
      const destination=path.join(out,'source',variant,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
      inputs.push({path:relative,origin,sha256:sha(bytes)});
      const extension=path.extname(args.path);return {contents:bytes,loader:extension==='.json'?'json':/tsx|jsx/.test(extension)?'tsx':/ts/.test(extension)?'ts':'js',resolveDir:path.dirname(args.path)};
    });
  }}]});
  manifests[variant]={bundleSha256:sha(fs.readFileSync(path.join(out,`${variant}.mjs`))),inputs:inputs.sort((a,b)=>a.path.localeCompare(b.path))};
}
fs.writeFileSync(path.join(out,'build-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),head:baseline.head,node:process.version,lockSha256:sha(fs.readFileSync(path.join(root,'core/pnpm-lock.yaml'))),variants:manifests},null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(manifests).map(([variant,value])=>[variant,{sha256:value.bundleSha256,files:value.inputs.length}]))));
