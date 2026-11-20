/** Read-only continuation of one stopped evaluation. Never resets old evidence. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { leaseLimits } from './assistant-monitor-lease.mts';

export const resumeHelperSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const key = (row: any) => `${row.repeat}:${row.variant}:${row.id}`;

/** Continue a completed response with unknown usage after an earlier, separately
 * accounted interruption. Only the reviewed second call can use a lower reserve. */
function loadBudgetStopContinuation(dir: string, root: string, spec: any) {
  const read = (base: string, name: string) => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
  const lines = (base: string, name: string) => readFileSync(resolve(base, name), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const require = (condition: boolean) => { if (!condition) throw Error('Invalid or changed budget-stop continuation'); };
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
  require(first.stopped && last.exitCode!==0 && !last.stopped && !existsSync(resolve(previous,'resource-stop.json')) && ledger.missingUsage===1);
  require(Number.isSafeInteger(priorElapsedMs) && Number.isSafeInteger(last.elapsedMs) && last.elapsedMs>=0
    && last.priorElapsedMs===first.elapsedMs && priorElapsedMs===first.elapsedMs+last.elapsedMs && priorElapsedMs>=0 && priorElapsedMs<1800000);
  require([first.baseline,last.baseline,last.last].every(s=>s.boot===first.baseline.boot && s.swapouts===first.baseline.swapouts && s.pressure===1));

  const suite = read(original,'cases.json').cases;
  const order = [1,2].flatMap(repeat => suite.flatMap((item:any,index:number) => ((index+repeat)%2?['before','after']:['after','before'])
    .map(variant => key({repeat,variant,id:item.id}))));
  const rows = [...lines(original,'results.jsonl'),...lines(previous,'results.jsonl')];
  const done = rows.map(key);
  require(new Set(order).size===order.length && done.length<order.length && done.every((k,i)=>k===order[i]) && ledger.answers===done.length);
  require(ledger.maxAnswers===order.length && ledger.maxCalls===240 && ledger.maxInput===2250000 && ledger.maxOutput===225000);
  const starts = [...lines(original,'provider-starts.jsonl'),...lines(previous,'provider-starts.jsonl')];
  const calls = [...lines(original,'provider-calls.jsonl'),...lines(previous,'provider-calls.jsonl')];
  require(starts.length===ledger.calls && starts.every((item,i)=>item.call===i+1 && done.includes(key(item))));
  require(new Set(calls.map(c=>c.call)).size===calls.length && calls.every(c=>starts[c.call-1] && key(c)===key(starts[c.call-1])));
  const known = calls.filter(c=>Number.isSafeInteger(c.input) && Number.isSafeInteger(c.output) && c.input>=0 && c.output>=0);
  const unknown = starts.filter(s=>!known.some(c=>c.call===s.call));
  require(known.reduce((n,c)=>n+c.input,0)===ledger.input && known.reduce((n,c)=>n+c.output,0)===ledger.output);
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
  const read = (base: string, name: string) => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
  const lines = (base: string, name: string) => readFileSync(resolve(base, name), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const spec = read(dir, 'resume.json');
  if (spec.version===2) return loadBudgetStopContinuation(dir,root,spec);
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
  if (current.resumesBuildSha256 !== sha(resolve(prior, 'build-manifest.json')) || current.resumeHelperSha256 !== resumeHelperSha256) fail();
  // Only harness metadata changes. Model input, fixture and executable bytes do not.
  for (const field of ['variants', 'fixture', 'sourcesSha256', 'casesSha256', 'baselineMemory', 'lockSha256']) {
    if (JSON.stringify(current[field]) !== JSON.stringify(old[field])) fail();
  }
  for (const variant of ['before', 'after']) {
    if (sha(resolve(dir, variant + '.mjs')) !== old.variants[variant].bundleSha256) fail();
  }
  const suite = read(prior, 'cases.json').cases;
  const expected = new Set<string>();
  for (let repeat = 1; repeat <= 2; repeat++) for (const item of suite) for (const variant of ['before', 'after']) expected.add(key({ repeat, variant, id: item.id }));
  if (expected.size !== suite.length * 4) fail();
  const rows = lines(prior, 'results.jsonl'), starts = lines(prior, 'provider-starts.jsonl'), calls = lines(prior, 'provider-calls.jsonl');
  const done = rows.map(key);
  if (new Set(done).size !== done.length || done.some(k => !expected.has(k)) || done.length >= expected.size) fail();
  const ledger = read(prior, 'paid-ledger.json'), exit = read(prior, 'local-exit.json'), stop = read(prior, 'resource-stop.json');
  if (!exit.stopped || !Number.isSafeInteger(exit.elapsedMs) || exit.elapsedMs < 0 || exit.elapsedMs >= 1800000) fail();
  if (exit.baseline.boot !== exit.last.boot || exit.baseline.swapouts !== exit.last.swapouts || exit.last.pressure !== 1) fail();
  if (ledger.calls !== starts.length || ledger.maxAnswers !== expected.size || ledger.maxCalls !== 240 || ledger.maxInput !== 2250000 || ledger.maxOutput !== 225000) fail();
  if (starts.some((s, i) => s.call !== i + 1 || !expected.has(key(s))) || new Set(calls.map(c => c.call)).size !== calls.length) fail();
  if (calls.some(c => !starts.some(s => s.call === c.call && key(s) === key(c)))) fail();
  const unknown = starts.filter(s => !calls.some(c => c.call === s.call && Number.isFinite(c.input) && Number.isFinite(c.output)));
  if (unknown.length !== 1 || done.includes(key(unknown[0])) || ledger.answers !== rows.length + 1 || spec.reviewedUnknownCalls?.join(',') !== unknown.map(c => c.call).join(',')) fail();
  if (calls.some(c => !Number.isFinite(c.input) || !Number.isFinite(c.output)) || calls.reduce((n,c)=>n+c.input,0) !== ledger.input || calls.reduce((n,c)=>n+c.output,0) !== ledger.output) fail();
  if (stop.reason !== 'memory_headroom') {
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
  const reservedInput = 1000000, reservedOutput = 16384;
  if (ledger.input + reservedInput >= ledger.maxInput || ledger.output + reservedOutput >= ledger.maxOutput) fail();
  return {
    sha256: sha(file), prior, done, priorElapsedMs: exit.elapsedMs,
    boot: exit.baseline.boot, swapouts: exit.baseline.swapouts,
    configFingerprint: read(prior, 'run-manifest.json').configFingerprint,
    ledger: { ...ledger, answers: rows.length, missingUsage: 0, historicalUnknownCalls: unknown, reservedInput, reservedOutput, historicalStartedRequests: ledger.answers },
  };
}
