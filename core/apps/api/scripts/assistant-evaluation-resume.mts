/** Read-only continuation of one stopped evaluation. Never resets old evidence. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { leaseLimits } from './assistant-monitor-lease.mts';

export const resumeHelperSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const key = (row: any) => `${row.repeat}:${row.variant}:${row.id}`;

/** Verify both stopped segments before continuing with the remaining requests. */
function loadChainedContinuation(dir: string, root: string, spec: any) {
  const read = (base: string, name: string) => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
  const lines = (base: string, name: string) => readFileSync(resolve(base, name), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const require = (condition: boolean) => { if (!condition) throw Error('Invalid or changed chained continuation'); };
  const resourceStop = spec.version===3;
  const evidenceRoot = resolve(root, '.local-data') + '/';
  const previous = resolve(root, spec.priorDirectory);
  require(previous.startsWith(evidenceRoot) && previous !== resolve(dir));
  const required = ['build-manifest.json','run-manifest.json','cases.json','results.jsonl','paid-ledger.json','provider-starts.jsonl','provider-calls.jsonl','local-exit.json'];
  function verifyFiles(base: string, files: Record<string,string>, names: string[]) {
    require(names.every(name => Boolean(files?.[name])));
    for (const [name, hash] of Object.entries(files)) {
      const path = resolve(base, name);
      require(path.startsWith(base + '/') && sha(path) === hash);
    }
  }
  verifyFiles(previous,spec.priorFiles,[...required,'resume.json','local-resources.jsonl','worker-monitor-leases.jsonl']);
  if(resourceStop)verifyFiles(previous,spec.priorFiles,['resource-stop.json','assistant-evaluation-resume.mts']);
  const firstSpec = read(previous,'resume.json');
  const original = resolve(root, firstSpec.priorDirectory);
  require(firstSpec.version === 1 && original.startsWith(evidenceRoot) && ![previous,resolve(dir)].includes(original) && !existsSync(resolve(original,'resume.json')));
  verifyFiles(original,firstSpec.priorFiles,[...required,'resource-stop.json']);
  const originalBuild = read(original,'build-manifest.json'), previousBuild = read(previous,'build-manifest.json'), current = read(dir,'build-manifest.json');
  require(previousBuild.resumesBuildSha256 === sha(resolve(original,'build-manifest.json'))
    && current.resumesBuildSha256 === sha(resolve(previous,'build-manifest.json')) && current.resumeHelperSha256 === resumeHelperSha256);
  for (const field of ['base','variants','fixture','sourcesSha256','casesSha256','baselineMemory','lockSha256']) {
    require(JSON.stringify(current[field])===JSON.stringify(previousBuild[field]) && JSON.stringify(current[field])===JSON.stringify(originalBuild[field]));
  }
  for (const variant of ['before','after']) require(sha(resolve(dir,variant+'.mjs'))===originalBuild.variants[variant].bundleSha256);
  const configFingerprint = read(previous,'run-manifest.json').configFingerprint;
  require(configFingerprint === read(original,'run-manifest.json').configFingerprint);

  const first = read(original,'local-exit.json'), last = read(previous,'local-exit.json'), ledger = read(previous,'paid-ledger.json');
  const priorElapsedMs = last.totalElapsedMs;
  require(first.stopped && last.exitCode!==0);
  if(resourceStop){
    const verifiedFirst=loadFirstContinuation(previous,root,firstSpec,sha(resolve(previous,'assistant-evaluation-resume.mts')));
    require(verifiedFirst.ledger.historicalUnknownCalls.length===0 && ledger.historicalStartedRequests===verifiedFirst.ledger.historicalStartedRequests
      && ledger.historicalUnknownCalls?.length===0 && ledger.reservedInput===0 && ledger.reservedOutput===0
      && ledger.missingUsage===0 && last.stopped);
  }else require(!last.stopped && !existsSync(resolve(previous,'resource-stop.json')) && ledger.missingUsage===1);
  require(Number.isSafeInteger(priorElapsedMs) && Number.isSafeInteger(last.elapsedMs) && last.elapsedMs>=0
    && last.priorElapsedMs===first.elapsedMs && priorElapsedMs===first.elapsedMs+last.elapsedMs && priorElapsedMs>=0 && priorElapsedMs<1800000);
  require([first.baseline,last.baseline,last.last].every(s=>s.boot===first.baseline.boot && s.swapouts===first.baseline.swapouts && s.pressure===1));

  const suite = read(original,'cases.json').cases;
  const order = [1,2].flatMap(repeat => suite.flatMap((item:any,index:number) => ((index+repeat)%2?['before','after']:['after','before'])
    .map(variant => key({repeat,variant,id:item.id}))));
  const rows = [...lines(original,'results.jsonl'),...lines(previous,'results.jsonl')];
  const done = rows.map(key);
  require(new Set(order).size===order.length && done.length<order.length && done.every((k,i)=>k===order[i])
    && ledger.answers===done.length+(resourceStop?1:0));
  require(ledger.maxAnswers===order.length && ledger.maxCalls===240 && ledger.maxInput===2250000 && ledger.maxOutput===225000);
  const starts = [...lines(original,'provider-starts.jsonl'),...lines(previous,'provider-starts.jsonl')];
  const calls = [...lines(original,'provider-calls.jsonl'),...lines(previous,'provider-calls.jsonl')];
  require(starts.length===ledger.calls && starts.every((item,i)=>item.call===i+1
    && (done.includes(key(item)) || resourceStop && key(item)===order[done.length])));
  require(new Set(calls.map(c=>c.call)).size===calls.length && calls.every(c=>starts[c.call-1] && key(c)===key(starts[c.call-1])));
  const known = calls.filter(c=>Number.isSafeInteger(c.input) && Number.isSafeInteger(c.output) && c.input>=0 && c.output>=0);
  const unknown = starts.filter(s=>!known.some(c=>c.call===s.call));
  require(known.reduce((n,c)=>n+c.input,0)===ledger.input && known.reduce((n,c)=>n+c.output,0)===ledger.output);
  if(resourceStop){
    const stop=read(previous,'resource-stop.json');
    const samples=lines(previous,'local-resources.jsonl'), leases=lines(previous,'worker-monitor-leases.jsonl');
    const sample=samples.at(-1), beforeStop=samples.at(-2), lease=leases.at(-1);
    const call=unknown[0];
    require(unknown.length===1 && call===starts.at(-1) && key(call)===order[done.length]
      && !calls.some(c=>c.call===call.call) && !existsSync(resolve(previous,'provider-responses',call.call+'.txt')));
    require(stop.reason==='memory_headroom' && stop.inFlightUsageMayBeUnknown===true
      && JSON.stringify(stop.baseline)===JSON.stringify(last.baseline) && JSON.stringify(stop.last)===JSON.stringify(sample)
      && sample.boot===first.baseline.boot && sample.swapouts===first.baseline.swapouts && sample.pressure===1
      && Number.isFinite(sample.free) && sample.free>=0 && sample.free<2*2**30 && sample.rss<=2**30
      && last.baseline.free>=3.5*2**30 && sample.monotonicAtMs<=last.last.monotonicAtMs);
    require(lease?.type==='resource-sample' && lease.sampledMonotonicAtMs===beforeStop?.monotonicAtMs
      && lease.receivedMonotonicAtMs<=call.startedMonotonicAtMs && call.startedMonotonicAtMs<sample.monotonicAtMs
      && sample.monotonicAtMs-lease.sampledMonotonicAtMs<leaseLimits.maximumAgeMs
      && sample.monotonicAtMs<lease.deadlineMonotonicAtMs);
    const reservedInput=1000000, reservedOutput=16384;
    require(JSON.stringify(spec.reviewedReservations)===JSON.stringify([{call:call.call,input:reservedInput,output:reservedOutput}]));
    require(ledger.input+reservedInput<ledger.maxInput && ledger.output+reservedOutput<ledger.maxOutput);
    return {sha256:sha(resolve(dir,'resume.json')),prior:previous,done,priorElapsedMs,boot:first.baseline.boot,swapouts:first.baseline.swapouts,configFingerprint,
      ledger:{...ledger,answers:done.length,missingUsage:0,historicalUnknownCalls:unknown,reservedInput,reservedOutput,historicalStartedRequests:ledger.answers}};
  }
  require(unknown.length===2 && ledger.historicalUnknownCalls?.length===1 && ledger.historicalUnknownCalls[0].call===unknown[0].call
    && firstSpec.reviewedUnknownCalls?.join(',')===String(unknown[0].call) && key(unknown[1])===done.at(-1)
    && Boolean(rows.at(-1).error) && calls.some(c=>c.call===unknown[1].call && c.status===200 && !Number.isFinite(c.input)));

  require(sha(resolve(dir,'request-bound-proof.json'))===spec.requestBoundProofSha256);
  const proof = read(dir,'request-bound-proof.json');
  const request = proof.providerBodyProof?.at(-1);
  require(proof.configFingerprint===configFingerprint && proof.configuredContextWindowTokens===64000 && proof.historicalUsage==='unknown'
    && request?.call===unknown[1].call && request.requestSha256===unknown[1].requestSha256 && request.expectedSha256===request.requestSha256
    && request.matches===true && request.textOnly===true && request.hasTools===false && Number.isSafeInteger(request.requestUtf8Bytes)
    && request.requestUtf8Bytes>0 && request.requestUtf8Bytes<64000 && request.maxTokens>0 && request.maxTokens<=16384);
  const reservations = [{call:unknown[0].call,input:1000000,output:16384},{call:unknown[1].call,input:64000,output:16384}];
  require(JSON.stringify(spec.reviewedReservations)===JSON.stringify(reservations));
  const reservedInput=1064000, reservedOutput=32768;
  require(ledger.input+reservedInput<ledger.maxInput && ledger.output+reservedOutput<ledger.maxOutput);
  return {sha256:sha(resolve(dir,'resume.json')),prior:previous,done,priorElapsedMs,boot:first.baseline.boot,swapouts:first.baseline.swapouts,configFingerprint,
    ledger:{...ledger,missingUsage:0,historicalUnknownCalls:unknown,reservedInput,reservedOutput,historicalStartedRequests:done.length+1}};
}

export function loadEvaluationResume(dir: string, root: string) {
  const file = resolve(dir, 'resume.json');
  if (!existsSync(file)) return undefined;
  const spec=JSON.parse(readFileSync(file,'utf8'));
  if(spec.version===2 || spec.version===3)return loadChainedContinuation(dir,root,spec);
  return loadFirstContinuation(dir,root,spec,resumeHelperSha256);
}

function loadFirstContinuation(dir: string, root: string, spec: any, helperSha256: string) {
  const read = (base: string, name: string) => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
  const lines = (base: string, name: string) => readFileSync(resolve(base, name), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const prior = resolve(root, spec.priorDirectory);
  const fail = () => { throw Error('Invalid or changed evaluation continuation'); };
  if (spec.version !== 1 || prior === resolve(dir) || !prior.startsWith(resolve(root, '.local-data') + '/') || existsSync(resolve(prior, 'resume.json'))) fail();
  for (const name of ['build-manifest.json', 'run-manifest.json', 'cases.json', 'results.jsonl', 'paid-ledger.json', 'provider-starts.jsonl', 'provider-calls.jsonl', 'resource-stop.json', 'local-exit.json']) {
    if (!spec.priorFiles?.[name]) fail();
  }
  for (const [name, hash] of Object.entries(spec.priorFiles)) {
    if (!resolve(prior, name).startsWith(prior + '/') || sha(resolve(prior, name)) !== hash) fail();
  }
  const old = read(prior, 'build-manifest.json'), current = read(dir, 'build-manifest.json');
  if (current.resumesBuildSha256 !== sha(resolve(prior, 'build-manifest.json')) || current.resumeHelperSha256 !== helperSha256) fail();
  // Only harness metadata changes. Model input, fixture and executable bytes do not.
  for (const field of ['variants', 'fixture', 'sourcesSha256', 'casesSha256', 'baselineMemory', 'lockSha256']) {
    if (JSON.stringify(current[field]) !== JSON.stringify(old[field])) fail();
  }
  for (const variant of ['before', 'after']) {
    if (sha(resolve(dir, variant + '.mjs')) !== old.variants[variant].bundleSha256) fail();
  }
  const suite = read(prior, 'cases.json').cases;
  const order = [1,2].flatMap(repeat => suite.flatMap((item:any,index:number) => ((index+repeat)%2?['before','after']:['after','before'])
    .map(variant => key({repeat,variant,id:item.id}))));
  const expected = new Set<string>(order);
  if (expected.size !== suite.length * 4) fail();
  const rows = lines(prior, 'results.jsonl'), starts = lines(prior, 'provider-starts.jsonl'), calls = lines(prior, 'provider-calls.jsonl');
  const done = rows.map(key);
  if (done.length >= expected.size || done.some((k,i) => k !== order[i])) fail();
  const ledger = read(prior, 'paid-ledger.json'), exit = read(prior, 'local-exit.json'), stop = read(prior, 'resource-stop.json');
  if (!exit.stopped || !Number.isSafeInteger(exit.elapsedMs) || exit.elapsedMs < 0 || exit.elapsedMs >= 1800000) fail();
  if (exit.baseline.boot !== exit.last.boot || exit.baseline.swapouts !== exit.last.swapouts || exit.last.pressure !== 1) fail();
  if (ledger.calls !== starts.length || ledger.maxAnswers !== expected.size || ledger.maxCalls !== 240 || ledger.maxInput !== 2250000 || ledger.maxOutput !== 225000) fail();
  if (starts.some((s, i) => s.call !== i + 1 || !expected.has(key(s))) || new Set(calls.map(c => c.call)).size !== calls.length) fail();
  if (calls.some(c => !starts.some(s => s.call === c.call && key(s) === key(c)))) fail();
  const unknown = starts.filter(s => !calls.some(c => c.call === s.call && Number.isFinite(c.input) && Number.isFinite(c.output)));
  const interrupted = order[done.length];
  if (unknown.length > 1 || starts.some(s => !done.includes(key(s)) && key(s)!==interrupted)
    || unknown.some(c => key(c)!==interrupted) || ledger.answers !== rows.length + 1
    || spec.reviewedUnknownCalls?.join(',') !== unknown.map(c => c.call).join(',')) fail();
  if (calls.some(c => !Number.isSafeInteger(c.input) || c.input<0 || !Number.isSafeInteger(c.output) || c.output<0)
    || calls.reduce((n,c)=>n+c.input,0) !== ledger.input || calls.reduce((n,c)=>n+c.output,0) !== ledger.output) fail();
  // The worker checks free memory before writing a row, between supervisor
  // samples. Its legacy stop record carries free/RSS but no reason field.
  const memoryFloor=2*2**30;
  const workerMemoryStop=stop.reason===undefined && Number.isSafeInteger(stop.free) && stop.free>=0 && stop.free<memoryFloor;
  if(workerMemoryStop){
    if(unknown.length || exit.exitCode!==1 || !Number.isSafeInteger(stop.rss) || stop.rss<=0 || stop.rss>2**30
      || !Number.isFinite(exit.last.free) || exit.last.free>=memoryFloor
      || !['local-resources.jsonl','worker-monitor-leases.jsonl','real-model.log'].every(name=>spec.priorFiles?.[name]))fail();
    const sample=lines(prior,'local-resources.jsonl').at(-1), lease=lines(prior,'worker-monitor-leases.jsonl').at(-1);
    const at=Date.parse(stop.at), lag=at-Date.parse(sample?.at), exitLag=Date.parse(exit.last.at)-at;
    if(!(lag>=0 && lag<leaseLimits.maximumAgeMs && exitLag>=0 && exitLag<leaseLimits.maximumAgeMs)
      || sample?.boot!==exit.baseline.boot || sample?.swapouts!==exit.baseline.swapouts || sample?.pressure!==1
      || lease?.type!=='resource-sample' || lease.sampledAt!==Date.parse(sample.at) || lease.sampledMonotonicAtMs!==sample.monotonicAtMs
      || !Number.isFinite(sample.monotonicAtMs) || !Number.isFinite(lease.deadlineMonotonicAtMs)
      || !Number.isFinite(exit.last.monotonicAtMs) || lease.deadlineMonotonicAtMs<=exit.last.monotonicAtMs
      || !/\bError: Evaluation resource guard stopped\s+at check \(/.test(readFileSync(resolve(prior,'real-model.log'),'utf8')))fail();
  }
  if (!unknown.length) {
    // The provider can finish before the final resource check prevents writing
    // the answer. Preserve this measured usage even though the answer is pending.
    const supervisorMemoryStop=stop.reason==='memory_headroom' && Number.isFinite(stop.last?.free) && stop.last.free<memoryFloor
      && stop.last?.boot===exit.baseline.boot && stop.last?.swapouts===exit.baseline.swapouts && stop.last?.pressure===1;
    if ((!supervisorMemoryStop && !workerMemoryStop) || ledger.missingUsage!==0
      || calls.some(c => key(c)===interrupted && (c.responseFile!=='provider-responses/'+c.call+'.txt' || !spec.priorFiles?.[c.responseFile]))) fail();
  }
  if (stop.reason !== 'memory_headroom' && !workerMemoryStop) {
    // Only the old wall-clock implementation can produce an already accepted
    // sample dated just after the stop. A genuine heartbeat gap stays blocked.
    if (stop.reason !== 'monitor_lease_expired' || !['local-resources.jsonl','worker-monitor-leases.jsonl','worker-monitor-stop.json']
      .every(name=>spec.priorFiles?.[name])) fail();
    if (sha(resolve(prior,'resource-stop.json')) !== sha(resolve(prior,'worker-monitor-stop.json'))
      || stop.unknownProviderCalls?.join(',') !== unknown.map(c=>c.call).join(',')) fail();
    const samples=lines(prior,'local-resources.jsonl'), leases=lines(prior,'worker-monitor-leases.jsonl');
    const ageAtStop=Date.parse(stop.at)-leases.at(-1)?.sampledAt;
    if (!(ageAtStop < 0 && ageAtStop > -leaseLimits.maximumAgeMs) || samples.length !== leases.length) fail();
    const resourceValid=(sample:any)=>sample.boot===exit.baseline.boot && sample.swapouts===exit.baseline.swapouts
      && sample.pressure===1 && sample.free>=2*2**30 && sample.rss<=2**30;
    if (![exit.baseline,...samples,exit.last].every(resourceValid) || exit.baseline.free<3.5*2**30) fail();
    if (leases.some((lease,i)=>{
      const preceding=i===0?Date.parse(exit.baseline.at):leases[i-1].sampledAt;
      const interval=lease.sampledAt-preceding, arrival=lease.receivedAt-lease.sampledAt;
      return lease.type!=='resource-sample' || lease.parent!==leases[0].parent || lease.deadline!==leases[0].deadline
        || lease.sequence!==i+1 || lease.sampledMonotonicAtMs!==undefined || lease.sampledAt!==Date.parse(samples[i].at)
        || !(interval>=0 && interval<leaseLimits.maximumAgeMs) || !(arrival>=0 && arrival<leaseLimits.maximumAgeMs);
    })) fail();
  }
  // Reserve the historical unknown at supported maximum context/output bounds,
  // separately from measured usage. A new unknown still fails closed as before.
  const reservedInput = unknown.length ? 1000000 : 0, reservedOutput = unknown.length ? 16384 : 0;
  if (ledger.input + reservedInput >= ledger.maxInput || ledger.output + reservedOutput >= ledger.maxOutput) fail();
  return {
    sha256: sha(resolve(dir,'resume.json')), prior, done, priorElapsedMs: exit.elapsedMs,
    boot: exit.baseline.boot, swapouts: exit.baseline.swapouts,
    configFingerprint: read(prior, 'run-manifest.json').configFingerprint,
    ledger: { ...ledger, answers: rows.length, missingUsage: 0, historicalUnknownCalls: unknown, reservedInput, reservedOutput, historicalStartedRequests: ledger.answers },
  };
}
