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
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const dir = path.resolve(root, process.argv.find(value => value.startsWith('--out='))?.slice(6) ?? '.local-data/assistant-context-evaluation-20261115');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const save = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2), { mode: 0o600 });

if (process.argv.includes('--prepare')) {
  if (fs.existsSync(path.join(dir, 'build-manifest.json'))) throw new Error('Use a new directory; frozen builds are immutable');
  const baseline = read('baseline.json'), common = new Map(), variants = {};
  for (const variant of ['before', 'after']) {
    const inputs = [];
    const withMemory = variant === 'after' || baseline.memory === true;
    const entry = `import {answerSiteQuestion,assistantConfig} from './src/utils/site_assistant.ts';
import {startAssistantMonitor} from './src/utils/site_assistant_monitor.ts';
import {assistantAnswerContext${withMemory ? ',rememberAssistantConversation' : ''}} from './src/utils/site_assistant_context.ts';
import {boundAssistantHistory} from '@cuberoot/shared/site-assistant';
export {assistantConfig};
export async function run(input,fetcher){
 const all=input.history;let prior;
 ${withMemory ? "for(let i=0;i<all.length;i+=2){const answer=rememberAssistantConversation({answer:all[i+1].content,sources:[]},all[i].content,[],prior);prior=assistantAnswerContext(answer);}" : ''}
 const history=boundAssistantHistory(all);let metrics,firstAnswerMs=null;
 const config=assistantConfig(),started=performance.now();
 const monitor=await startAssistantMonitor({uid:null,question:input.question,lang:'zh',model:config.model,streaming:true,imageCount:0,historyCount:history.length,thinking:'auto'},async(sql,params)=>{if(sql.startsWith('UPDATE'))metrics=params[7];return [];});
 const emit=async event=>{if(event.type==='answer'&&event.answer){firstAnswerMs??=performance.now()-started;monitor.text(event.answer);}};
 try{const result=await monitor.run(()=>answerSiteQuestion(input.question,'zh',config,input.signal,fetcher,history,undefined,emit,'America/Los_Angeles',[],'auto',{},prior));await monitor.finish('success',undefined,result);const durationMs=performance.now()-started;return {result,metrics,durationMs,firstAnswerMs,firstVisibleMs:firstAnswerMs??durationMs,streamed:firstAnswerMs!==null};}
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
        const bytes = variant === 'before' && baseline.files.includes(relative) ? fs.readFileSync(path.join(dir, 'baseline', relative)) : common.get(relative);
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
    lockSha256: sha(fs.readFileSync(path.join(root, 'core/pnpm-lock.yaml'))), variants, fixture, casesSha256: sha(fs.readFileSync(path.join(dir, 'cases.json'))) });
  console.log(JSON.stringify({ prepared: dir, base: baseline.base, cases: read('cases.json').cases.length }));
} else if (process.argv.includes('--run')) {
  const env = parseEnv(fs.readFileSync(path.join(root, 'core/apps/api/.env'), 'utf8'));
  for (const [key, value] of Object.entries(env)) if (/^(SITE_ASSISTANT|DEEPSEEK)/.test(key)) process.env[key] = value;
  Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '1', DB_NAME: 'context_evaluation_disabled', SITE_ASSISTANT_KNOWLEDGE_ENABLED: '0', SITE_ASSISTANT_RERANK_ENABLED: '0', SITE_ASSISTANT_WEB_ENABLED: '0' });
  const manifest = read('build-manifest.json'), suite = read('cases.json').cases;
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
  if (!config || config.model !== runtime.after.assistantConfig()?.model) throw new Error('Missing or mismatched configured models');
  const providerOrigin = new URL(config.baseUrl).origin, nativeFetch = globalThis.fetch;
  const ledger = fs.existsSync(path.join(dir, 'paid-ledger.json')) ? read('paid-ledger.json') : { answers: 0, calls: 0, input: 0, output: 0, missingUsage: 0, maxAnswers: suite.length * 4, maxCalls: 240, maxInput: 2_250_000, maxOutput: 225_000 };
  const configFingerprint = sha(JSON.stringify({ model: config.model, providerOrigin, thinking: 'auto', contextWindow: process.env.SITE_ASSISTANT_CONTEXT_WINDOW_TOKENS ?? '64000', sources, web: false }));
  if (fs.existsSync(path.join(dir, 'run-manifest.json')) && read('run-manifest.json').configFingerprint !== configFingerprint) throw new Error('Configuration changed during resume');
  if (!fs.existsSync(path.join(dir, 'run-manifest.json'))) save('run-manifest.json', { createdAt: new Date().toISOString(), model: config.model, providerOrigin, configFingerprint,
    repeats: 2, order: 'AB/BA alternated per case and reversed on repeat 2', surface: 'actual in-process agent, real model, fixed synthetic histories, frozen public fixtures, no production writes, no browser or DB latency',
    sources, runnerSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
    cache: 'provider cache uncontrolled; actual cached tokens reported separately', historicalState: manifest.baselineMemory ? 'both graphs constructed from the same full fixture transcript before timing' : 'candidate graph constructed from the same full fixture transcript before timing; baseline retains its original recent-message policy', limits: ledger });
  const resultsFile = path.join(dir, 'results.jsonl');
  const existing = fs.existsSync(resultsFile) ? fs.readFileSync(resultsFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const done = new Set(existing.map(row => `${row.repeat}:${row.variant}:${row.id}`));
  if (fs.existsSync(path.join(dir, 'resource-stop.json'))) throw new Error('Resource stop requires review; no automatic restart');
  const check = () => {
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
    if (ledger.calls >= ledger.maxCalls || ledger.input >= ledger.maxInput || ledger.output >= ledger.maxOutput || ledger.missingUsage) throw new Error('Paid evaluation budget reached');
    ledger.calls++; save('paid-ledger.json', ledger);
    const request = JSON.parse(String(init?.body)), start = performance.now();
    const record = { ...active, call: ledger.calls, model: request.model, startedAt: new Date().toISOString(), requestSha256: sha(String(init?.body)) };
    calls.push(record);
    let response;
    try { response = await nativeFetch(input, { ...init, redirect: 'error' }); }
    catch (error) { record.error = error.name; ledger.missingUsage++; save('paid-ledger.json', ledger); throw error; }
    record.status = response.status; record.headersMs = performance.now() - start;
    pending.push(response.clone().text().then(text => {
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
      save('paid-ledger.json', ledger); fs.appendFileSync(path.join(dir, 'provider-calls.jsonl'), JSON.stringify(record) + '\n', { mode: 0o600 });
    }));
    return response;
  };
  for (let repeat = 1; repeat <= 2; repeat++) for (const [index, item] of suite.entries()) for (const variant of (index + repeat) % 2 ? ['before', 'after'] : ['after', 'before']) {
    if (done.has(`${repeat}:${variant}:${item.id}`)) continue;
    check(); if (ledger.answers >= ledger.maxAnswers || ledger.missingUsage) throw new Error('Evaluation stopped at budget or unknown usage');
    ledger.answers++; save('paid-ledger.json', ledger); active = { repeat, variant, id: item.id }; calls = []; pending = []; reads = []; fixtureMisses = [];
    const abort = new AbortController(); const timer = setInterval(() => { try { check(); } catch (error) { abort.abort(error); } }, 5000);
    let result;
    try { result = await runtime[variant].run({ ...item, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(65_000)]) }, globalThis.fetch); }
    finally { clearInterval(timer); await Promise.all(pending); }
    const row = { ...active, category: item.category, at: new Date().toISOString(), ...result, providerCalls: calls, reads, fixtureMisses, rssMb: Math.round(process.memoryUsage().rss / 1048576) };
    fs.appendFileSync(resultsFile, JSON.stringify(row) + '\n', { mode: 0o600 });
    console.log(JSON.stringify({ ...active, ms: Math.round(result.durationMs), error: result.error, calls: calls.length, input: calls.reduce((sum, call) => sum + (call.input ?? 0), 0), completed: ledger.answers }));
  }
  console.log(JSON.stringify({ complete: true, ledger })); process.exit(0);
} else throw new Error('Explicit --prepare or --run required; --run uses the configured paid provider');
