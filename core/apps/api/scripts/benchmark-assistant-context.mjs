/** Frozen paired evaluation; explicit --run calls the configured paid provider.
 * Input directory contains baseline.json, baseline/<repo paths>, cases.json,
 * glossary.json and fixture.json. Export Git sources before --prepare; this CLI
 * never changes checkouts or accesses a production database. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { monitorClockMs, requireResourceMonitor } from './assistant-monitor-lease.mts';
import { assistantPrice } from '../src/utils/site_assistant_pricing.ts';
import { evaluationRepeats, loadEvaluationResume, resumeHelperSha256 } from './assistant-evaluation-resume.mts';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const dir = path.resolve(root, process.argv.find(value => value.startsWith('--out='))?.slice(6) ?? '.local-data/assistant-context-evaluation-20261115');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const save = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2), { mode: 0o600 });
const monitorSha256=sha(fs.readFileSync(new URL('./assistant-monitor-lease.mts',import.meta.url)));
const runnerSha256=sha(fs.readFileSync(fileURLToPath(import.meta.url)));

if (process.argv.includes('--prepare')) {
  if (fs.existsSync(path.join(dir, 'build-manifest.json'))) throw new Error('Use a new directory; frozen builds are immutable');
  const baseline = read('baseline.json'), common = new Map(), variants = {};
  for(const entry of baseline.hashes ?? [])if(sha(fs.readFileSync(path.join(dir,'baseline',entry.path)))!==entry.sha256)throw new Error('Baseline source changed: '+entry.path);
  for (const variant of ['before', 'after']) {
    const inputs = [];
    const withMemory = variant === 'after' || baseline.memory === true;
    const entry = `import {answerSiteQuestion,assistantConfig} from './src/utils/site_assistant.ts';
import {startAssistantMonitor} from './src/utils/site_assistant_monitor.ts';
import {assistantAnswerContext${withMemory ? ',rememberAssistantConversation' : ''}} from './src/utils/site_assistant_context.ts';
import {boundAssistantHistory} from '@cuberoot/shared/site-assistant';
export {assistantConfig};
export async function run(input,fetcher){
 const all=input.history ?? [];let prior;
 ${withMemory ? "for(let i=0;i<all.length;i+=2){const answer=rememberAssistantConversation({answer:all[i+1].content,sources:[]},all[i].content,[],prior);prior=assistantAnswerContext(answer);}" : ''}
 const history=boundAssistantHistory(all);let metrics,firstAnswerMs=null;
 const config=assistantConfig(),started=performance.now(),lang=input.lang ?? 'zh',thinking=input.thinking ?? 'auto';
 const monitor=await startAssistantMonitor({uid:input.viewerUserId ?? null,question:input.question,lang,model:config.model,streaming:true,imageCount:0,historyCount:history.length,thinking},async(sql,params)=>{if(sql.startsWith('UPDATE'))metrics=params[7];return [];});
 const emit=async event=>{if(event.type==='answer'&&event.answer){firstAnswerMs??=performance.now()-started;monitor.text(event.answer);}};
 try{const result=await monitor.run(()=>answerSiteQuestion(input.question,lang,config,input.signal,fetcher,history,input.viewerWcaId,emit,'America/Los_Angeles',[],thinking,{viewerUserId:input.viewerUserId},prior));await monitor.finish('success',undefined,result);const durationMs=performance.now()-started;return {result,metrics,durationMs,firstAnswerMs,firstVisibleMs:firstAnswerMs??durationMs,streamed:firstAnswerMs!==null};}
 catch(error){await monitor.finish('error',error.code??error.name);return {error:error.code??error.name,metrics,durationMs:performance.now()-started,firstAnswerMs};}
}`;
    await build({ stdin: { contents: entry, resolveDir: path.join(root, 'core/apps/api'), sourcefile: `context-${variant}.ts`, loader: 'ts' },
      bundle: true, platform: 'node', target: 'node24', format: 'esm', outfile: path.join(dir, variant + '.mjs'), logLevel: 'warning',
      loader: { '.ttf': 'dataurl', '.webp': 'dataurl', '.woff2': 'dataurl' },
      banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" },
      plugins: [{ name: 'freeze-source', setup(api) { api.onLoad({ filter: /\.(?:[cm]?[jt]sx?|json)$/ }, args => {
        if (!args.path.startsWith(root + '/core/') || args.path.includes('/node_modules/')) return;
        const relative = path.relative(root, args.path);
        if (!common.has(relative)) common.set(relative, fs.readFileSync(args.path));
        const frozen=baseline.files.includes(relative) && (variant==='before' || baseline.candidateFiles && !baseline.candidateFiles.includes(relative));
        const bytes = frozen ? fs.readFileSync(path.join(dir, 'baseline', relative)) : common.get(relative);
        const destination = path.join(dir, 'source', variant, relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes);
        inputs.push({ path: relative, sha256: sha(bytes) });
        const ext = path.extname(args.path);
        return { contents: bytes, resolveDir: path.dirname(args.path), loader: ext === '.json' ? 'json' : /tsx|jsx/.test(ext) ? 'tsx' : /ts/.test(ext) ? 'ts' : 'js' };
      }); } }] });
    variants[variant] = { bundleSha256: sha(fs.readFileSync(path.join(dir, variant + '.mjs'))), inputs };
  }
  const fixture = read('fixture.json');
  if (sha(fs.readFileSync(path.join(dir, 'glossary.json'))) !== fixture.sha256) throw new Error('Fixture checksum mismatch');
  save('build-manifest.json', { base: baseline.base, baselineLabel: baseline.label, baselineMemory: baseline.memory === true, createdAt: new Date().toISOString(), node: process.version,
    monitorSha256, resumeHelperSha256, lockSha256: sha(fs.readFileSync(path.join(root, 'core/pnpm-lock.yaml'))), runnerSha256, variants, fixture,
    sourcesSha256:fs.existsSync(path.join(dir,'sources.json'))?sha(fs.readFileSync(path.join(dir,'sources.json'))):null,
    casesSha256: sha(fs.readFileSync(path.join(dir, 'cases.json'))) });
  console.log(JSON.stringify({ prepared: dir, base: baseline.base, cases: read('cases.json').cases.length }));
} else if (process.argv.includes('--run') || process.argv.includes('--replay')) {
  const replay=process.argv.includes('--replay');
  const inFlight = new Set();
  const checkMonitor = replay ? () => {} : await requireResourceMonitor(reason => {
    const evidence = { reason, at: new Date().toISOString(), pid: process.pid, unknownProviderCalls: [...inFlight], inFlightUsageMayBeUnknown: inFlight.size > 0 };
    try {
      fs.writeFileSync(path.join(dir,'resource-stop.json'),JSON.stringify(evidence,null,2),{flag:'wx',mode:0o600});
    } catch { /* Preserve an earlier stop; termination must not depend on disk writes. */ }
    try { fs.writeFileSync(path.join(dir,'worker-monitor-stop.json'),JSON.stringify(evidence,null,2),{flag:'wx',mode:0o600}); } catch {}
    // The supervisor launched this worker as process-group leader. Kill all its
    // descendants too, even while an HTTP body is pending or the parent is gone.
    try { process.kill(-process.pid,'SIGKILL'); } finally { process.exit(1); }
  }, lease => fs.appendFileSync(path.join(dir,'worker-monitor-leases.jsonl'),JSON.stringify({...lease,receivedAt:Date.now(),receivedMonotonicAtMs:monitorClockMs()})+'\n',{mode:0o600}));
  const envPath=process.argv.find(arg=>arg.startsWith('--env-file='))?.slice(11) ?? path.join(root,'core/apps/api/.env');
  const env = !replay && fs.existsSync(envPath)?parseEnv(fs.readFileSync(envPath,'utf8')):{};
  for (const [key, value] of Object.entries(env)) if (/^(SITE_ASSISTANT|DEEPSEEK)/.test(key)) process.env[key] = value;
  if(replay)Object.assign(process.env,{SITE_ASSISTANT_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'offline-fixture',DEEPSEEK_MODEL:'deepseek-flash'});
  Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '1', DB_NAME: 'context_evaluation_disabled', SITE_ASSISTANT_KNOWLEDGE_ENABLED: '0', SITE_ASSISTANT_RERANK_ENABLED: '0', SITE_ASSISTANT_WEB_ENABLED: '0' });
  process.env.SITE_ASSISTANT_OUTBOX_DIR=path.join(dir,replay?'replay-outbox':'outbox');
  const manifest = read('build-manifest.json'), suite = read('cases.json').cases;
  if(manifest.monitorSha256!==monitorSha256)throw new Error('Resource monitor changed since freeze');
  if(manifest.resumeHelperSha256!==resumeHelperSha256)throw new Error('Continuation verifier changed since freeze');
  if(manifest.runnerSha256!==runnerSha256)throw new Error('Evaluation runner changed since freeze; use a new evidence directory');
  const sourceManifest=fs.existsSync(path.join(dir,'sources.json'))?sha(fs.readFileSync(path.join(dir,'sources.json'))):null;
  if(sourceManifest!==manifest.sourcesSha256)throw new Error('Frozen source mapping changed');
  const sources = fs.existsSync(path.join(dir, 'sources.json')) ? read('sources.json') : [{ ...manifest.fixture, file: 'glossary.json', type: 'application/json' }];
  for (const source of sources) if (sha(fs.readFileSync(path.join(dir, source.file))) !== source.sha256) throw new Error('Frozen source changed');
  const sourceMap = new Map(sources.map(source => [source.url, source]));
  if (sha(fs.readFileSync(path.join(dir, 'cases.json'))) !== manifest.casesSha256 || sha(fs.readFileSync(path.join(dir, 'glossary.json'))) !== manifest.fixture.sha256) throw new Error('Frozen inputs changed');
  const runtime = {};
  for (const variant of ['before', 'after']) {
    if (sha(fs.readFileSync(path.join(dir, variant + '.mjs'))) !== manifest.variants[variant].bundleSha256) throw new Error('Frozen runtime changed');
    runtime[variant] = await import(pathToFileURL(path.join(dir, variant + '.mjs')));
  }
  const config = runtime.before.assistantConfig();
  const candidateConfig=runtime.after.assistantConfig();
  if (!config || config.model !== candidateConfig?.model || config.baseUrl!==candidateConfig.baseUrl) throw new Error('Missing or mismatched configured models; supply --env-file or provider environment variables');
  if(replay) {
    const replayFile=path.join(dir,'replay-results.json');
    if(fs.existsSync(replayFile))throw new Error('Replay evidence already exists; preserve it');
    const rows=[];
    const cases=suite.filter(item=>item.replay);
    if(!cases.length)throw new Error('No frozen replay fixtures');
    for(const item of cases)for(const variant of ['before','after']) {
      let calls=0;const reads=[];
      const fetcher=async(input,init)=>{
        const url=new URL(String(input));
        if(url.origin!==new URL(config.baseUrl).origin) {
          reads.push(url.href);const source=sourceMap.get(url.href);
          if(!source)throw new Error('Missing frozen replay source');
          return new Response(fs.readFileSync(path.join(dir,source.file)),{status:source.status,headers:{'Content-Type':source.type}});
        }
        if(calls>=6)throw new Error('Replay call limit');
        const value=item.replay.replies[Math.min(calls++,item.replay.replies.length-1)];
        const request=JSON.parse(String(init.body));
        if(request.stream)return new Response('data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',created:1,model:'fixture',choices:[{index:0,delta:{role:'assistant',content:JSON.stringify(value)},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
        return Response.json({id:'fixture',created:1,model:'fixture',choices:[{index:0,message:{role:'assistant',content:JSON.stringify(value)},finish_reason:'stop'}]});
      };
      globalThis.fetch=fetcher; // No network fallback, including SDK default fetch.
      const result=await runtime[variant].run({...item,signal:AbortSignal.timeout(5000)},fetcher);
      const answer=result.result?.answer ?? '',expected=item.replay.expect;
      const passed=(expected.error?result.error===expected.error:!result.error)
        && (expected.includes ?? []).every(text=>answer.includes(text))
        && (expected.excludes ?? []).every(text=>!answer.includes(text));
      rows.push({id:item.id,variant,passed,result:result.result,error:result.error,calls,reads});
    }
    save('replay-results.json',{surface:'Deterministic wire replay; no real model, no latency or token comparison',runnerSha256,rows});
    console.log(JSON.stringify({replay:true,cases:cases.length,before:rows.filter(r=>r.variant==='before'&&r.passed).length,after:rows.filter(r=>r.variant==='after'&&r.passed).length}));
    process.exit(0);
  }
  const providerOrigin = new URL(config.baseUrl).origin, nativeFetch = globalThis.fetch;
  const spec=read('cases.json'), repeats=evaluationRepeats(spec);
  const singleVariant=spec.onlyVariant;
  if (singleVariant!==undefined && (!['before','after'].includes(singleVariant) || suite.length!==1 || repeats.length!==1))
    throw Error('Single-arm recovery requires exactly one named evaluation position');
  const costLimit=spec.maxGrossCny;
  if(costLimit!==undefined && (!Number.isFinite(costLimit) || costLimit<=0 || config.model!=='deepseek-flash' || providerOrigin!=='https://api.deepseek.com'))throw Error('Invalid evaluation cost limit or unknown provider');
  const resume = loadEvaluationResume(dir,root);
  const ledger = fs.existsSync(path.join(dir, 'paid-ledger.json')) ? read('paid-ledger.json') : resume?.ledger ?? { answers: 0, calls: 0, input: 0, output: 0, missingUsage: 0, maxAnswers: suite.length * (singleVariant ? 1 : 2) * repeats.length, maxCalls: 240, maxInput: 2_250_000, maxOutput: 225_000 };
  const thinking = suite.some(item=>item.thinking && item.thinking!=='auto') ? 'per-case' : 'auto';
  const configFingerprint = sha(JSON.stringify({ model: config.model, providerOrigin, thinking, contextWindow: process.env.SITE_ASSISTANT_CONTEXT_WINDOW_TOKENS ?? '64000', sources, web: false }));
  if(resume && resume.configFingerprint!==configFingerprint)throw new Error('Configuration changed from stopped evaluation');
  if (fs.existsSync(path.join(dir, 'run-manifest.json')) && read('run-manifest.json').configFingerprint !== configFingerprint) throw new Error('Configuration changed during resume');
  if (!fs.existsSync(path.join(dir, 'run-manifest.json'))) save('run-manifest.json', { createdAt: new Date().toISOString(), model: config.model, providerOrigin, configFingerprint,
    repeats: repeats.length, maxGrossCny: costLimit, order: singleVariant ?? 'AB/BA alternated per case and reversed on repeat 2', surface: 'actual in-process agent, real model, fixed synthetic histories, frozen public fixtures, no production writes, no browser or DB latency',
    sources, runnerSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
    cache: 'provider cache uncontrolled; actual cached tokens reported separately', historicalState: manifest.baselineMemory ? 'both graphs constructed from the same full fixture transcript before timing' : 'candidate graph constructed from the same full fixture transcript before timing; baseline retains its original recent-message policy', limits: ledger });
  const resultsFile = path.join(dir, 'results.jsonl');
  const existing = fs.existsSync(resultsFile) ? fs.readFileSync(resultsFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const done = new Set([...(resume?.done ?? []),...existing.map(row => `${row.repeat}:${row.variant}:${row.id}`)]);
  if (fs.existsSync(path.join(dir, 'resource-stop.json'))) throw new Error('Resource stop requires review; no automatic restart');
  const check = () => {
    checkMonitor();
    if (fs.existsSync(path.join(dir, 'resource-stop.json'))) throw new Error('Resource stop requires review; no automatic restart');
    if (os.freemem() < 2 * 1024 ** 3 || process.memoryUsage().rss > 1024 ** 3) {
      save('resource-stop.json', { at: new Date().toISOString(), free: os.freemem(), rss: process.memoryUsage().rss }); throw new Error('Evaluation resource guard stopped');
    }
  };
  let calls = [], pending = [], reads = [], fixtureMisses = [], active;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== providerOrigin) {
      reads.push(url.href);
      const source = sourceMap.get(url.href);
      if (source) return new Response(fs.readFileSync(path.join(dir, source.file)), { status: source.status, headers: { 'Content-Type': source.type } });
      fixtureMisses.push(url.href);
      return new Response('', { status: 404, headers: { 'X-Evaluation-Fixture-Miss': '1' } });
    }
    check();
    if (ledger.calls >= ledger.maxCalls || ledger.input + (ledger.reservedInput ?? 0) >= ledger.maxInput || ledger.output + (ledger.reservedOutput ?? 0) >= ledger.maxOutput || ledger.missingUsage) throw new Error('Paid evaluation budget reached');
    if(costLimit!==undefined) {
      // Settle previous streaming usage, then reserve a full 1M-token context
      // and the actual requested output at the uncached peak tariff.
      await Promise.all(pending);
      const request=JSON.parse(String(init?.body)), output=request.max_tokens ?? request.max_completion_tokens;
      const gross=assistantPrice(config.model,providerOrigin,ledger.input+(ledger.reservedInput??0)+1_048_576,ledger.output+(ledger.reservedOutput??0)+output).grossCny;
      if(inFlight.size || ledger.missingUsage || request.model!==config.model || !Number.isSafeInteger(output) || output<=0 || gross===null || gross>costLimit)throw Error('Cannot reserve next call within the authorized cost');
    }
    ledger.calls++; save('paid-ledger.json', ledger);
    const request = JSON.parse(String(init?.body)), start = performance.now();
    const record = { ...active, call: ledger.calls, model: request.model, startedAt: new Date().toISOString(), startedMonotonicAtMs: monitorClockMs(), requestSha256: sha(String(init?.body)) };
    calls.push(record);
    inFlight.add(record.call);
    fs.appendFileSync(path.join(dir,'provider-starts.jsonl'),JSON.stringify(record)+'\n',{mode:0o600});
    let response;
    try { response = await nativeFetch(input, { ...init, redirect: 'error' }); }
    catch (error) { record.error = error.name; ledger.missingUsage++; save('paid-ledger.json', ledger); inFlight.delete(record.call); fs.appendFileSync(path.join(dir,'provider-calls.jsonl'),JSON.stringify(record)+'\n',{mode:0o600}); throw error; }
    record.status = response.status; record.headersMs = performance.now() - start;
    pending.push(response.clone().text().then(text => {
      // Local synthetic evaluation evidence, never production monitoring. Keep
      // rejected drafts too; do not persist request headers or API credentials.
      fs.mkdirSync(path.join(dir,'provider-responses'),{recursive:true,mode:0o700});
      record.responseFile=`provider-responses/${record.call}.txt`;
      fs.writeFileSync(path.join(dir,record.responseFile),text,{flag:'wx',mode:0o600});
      let frames;
      try { frames = [JSON.parse(text)]; } catch { frames = text.split('\n').filter(line => line.startsWith('data:') && !line.includes('[DONE]')).flatMap(line => { try { return [JSON.parse(line.slice(5))]; } catch { return []; } }); }
      const usage = frames.map(frame => frame.usage).filter(Boolean).at(-1);
      record.input = usage?.prompt_tokens ?? usage?.input_tokens; record.output = usage?.completion_tokens ?? usage?.output_tokens;
      record.cached = usage?.prompt_cache_hit_tokens ?? usage?.prompt_tokens_details?.cached_tokens ?? null;
      record.reasoning = usage?.completion_tokens_details?.reasoning_tokens ?? null;
      record.durationMs = performance.now() - start;
      if (Number.isFinite(record.input) && Number.isFinite(record.output)) { ledger.input += record.input; ledger.output += record.output; }
      else ledger.missingUsage++;
    }).catch(() => { ledger.missingUsage++; }).finally(() => {
      save('paid-ledger.json', ledger); inFlight.delete(record.call); fs.appendFileSync(path.join(dir, 'provider-calls.jsonl'), JSON.stringify(record) + '\n', { mode: 0o600 });
    }));
    return response;
  };
  for (const repeat of repeats) for (const [index, item] of suite.entries()) for (const variant of singleVariant ? [singleVariant] : (index + repeat) % 2 ? ['before', 'after'] : ['after', 'before']) {
    if (done.has(`${repeat}:${variant}:${item.id}`)) continue;
    check(); if (ledger.answers >= ledger.maxAnswers || ledger.missingUsage) throw new Error('Evaluation stopped at budget or unknown usage');
    ledger.answers++; save('paid-ledger.json', ledger); active = { repeat, variant, id: item.id }; calls = []; pending = []; reads = []; fixtureMisses = [];
    const abort = new AbortController(); const timer = setInterval(() => { try { check(); } catch (error) { abort.abort(error); } }, 5000);
    let result;
    try { result = await runtime[variant].run({ ...item, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(65_000)]) }, globalThis.fetch); }
    finally { clearInterval(timer); await Promise.all(pending); }
    check();
    const row = { ...active, category: item.category, at: new Date().toISOString(), ...result, providerCalls: calls, reads, fixtureMisses, rssMb: Math.round(process.memoryUsage().rss / 1048576) };
    fs.appendFileSync(resultsFile, JSON.stringify(row) + '\n', { mode: 0o600 });
    console.log(JSON.stringify({ ...active, ms: Math.round(result.durationMs), error: result.error, calls: calls.length, input: calls.reduce((sum, call) => sum + (call.input ?? 0), 0), completed: ledger.answers }));
  }
  console.log(JSON.stringify({ complete: true, ledger })); process.exit(0);
} else throw new Error('Explicit --prepare, --replay or --run required; only --run uses a paid provider');
