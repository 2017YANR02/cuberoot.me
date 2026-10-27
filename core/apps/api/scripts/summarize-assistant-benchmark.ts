/** Summarize isolated JSONL runs; semantic verdicts still require source review. */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEvaluationCases, evaluateStructure, compareBenchmarkMetadata } from './assistant-evaluation.js';
const value = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const casesPath = value('cases'), baseline = value('baseline'), candidate = value('candidate'), output = value('output');
if (!casesPath || !baseline || !output) throw new Error('Required: --cases=cases.json --baseline=run.jsonl --output=report.json [--candidate=run.jsonl]');
const cases = parseEvaluationCases(JSON.parse(readFileSync(casesPath, 'utf8')));
function load(file: string) {
  const records = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const meta = records.find(r => r.benchmarkRun);
  const rows = records.filter(r => r.benchmark);
  if (!meta || !rows.length || new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('Expected a single run with unique case IDs');
  return { meta, rows, complete: records.some(r => r.benchmarkEnd) && rows.length === meta.cases };
}
function summarize(run: ReturnType<typeof load>, ids?: Set<string>) {
  const rows = run.rows.filter(r => !ids || ids.has(r.id));
  const times = rows.map(r => r.durationMs).sort((a,b) => a-b);
  const perCase = rows.map(r => {
    const item = cases.find(c => c.id === r.id);
    if (!item) throw new Error('Result references an unknown case');
    return { id: r.id, status: r.status, durationMs: r.durationMs, tools: r.metrics?.tools ?? {},
      reranks: r.metrics?.reranks ?? [], cost: r.metrics?.cost ?? null,
      ...evaluateStructure(item, r.status, r.result, Object.keys(r.metrics?.tools ?? {})) };
  });
  return { count: rows.length, httpSuccess: rows.filter(r => r.status === 200).length,
    latencyMs: { p50: times[Math.ceil(times.length*.5)-1] ?? null, p95: times[Math.ceil(times.length*.95)-1] ?? null },
    knownGrossCny: rows.reduce((n,r) => n+(r.metrics?.cost?.grossCny ?? 0),0),
    unpricedCalls: rows.reduce((n,r) => n+(r.metrics?.cost?.unpricedCalls ?? 0),0),
    missingCostRecords: rows.filter(r => !r.metrics?.cost).length,
    perCase };
}
const a = load(baseline), b = candidate ? load(candidate) : undefined;
const comparison = b ? compareBenchmarkMetadata(a.meta, b.meta) : undefined;
const comparable = comparison?.comparable ?? null;
const pairedIds = b ? new Set(a.rows.filter(r => b.rows.some(s => s.id === r.id)).map(r => r.id)) : undefined;
writeFileSync(output, JSON.stringify({
  boundary: 'Structural checks are not answer-accuracy scores. Small-sample latency is descriptive, not an SLO. Provider cache, model aliases and changing external data are uncontrolled.',
  baseline: { meta: a.meta, complete: a.complete, ...summarize(a) },
  ...(b ? { candidate: { meta:b.meta, complete:b.complete, ...summarize(b) }, comparison: { comparable, pairedCases:pairedIds!.size,
    ...(comparable ? { baseline:summarize(a,pairedIds), candidate:summarize(b,pairedIds) } : { mismatches: comparison?.mismatches, reason:'Code, cases, runtime configuration or sources differ or lack fingerprints; do not attribute the difference to retrieval policy.' }) } } : {}),
},null,2)+'\n');
console.log(JSON.stringify({ output, baselineCases:a.rows.length, candidateCases:b?.rows.length, comparable }));
