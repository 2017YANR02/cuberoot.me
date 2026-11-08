/** Export the frozen report for /timer/accuracy; no benchmark or network runs here.
 * From core: pnpm --filter @cuberoot/client exec node --import tsx scripts/smart-cube-timing/export-page.mts [--write]
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../..', import.meta.url));
const client = resolve(root, 'core/packages/client');
const reportPath = 'docs/benchmarks/smart-cube-timing-cold-start-2026-11-06.json';
const bytes = readFileSync(resolve(root, reportPath));
const sha256 = createHash('sha256').update(bytes).digest('hex');
const report = JSON.parse(bytes.toString()) as {
  metadata: { generatedAt: string; corpusSha256: string; cstimerCommit: string; cuberootCommit: string };
  overall: Record<string, { cases: number; casesWithin10Ms: number; p95AbsoluteErrorMs: number; maxAbsoluteErrorMs: number }>;
  groups: Record<string, unknown>;
  comparisons: Record<string, { improved: number; regressed: number; similar: number; toleranceMs: number }>;
  cases: Array<{ id: string; durationMs: number; beforeMs: number; previousMs: number; currentMs: number; cstimerMs: number;
    currentErrorMs: number; cstimerErrorMs: number; savedMoveEndMs: number; inSolveReanchors: number }>;
};
assert.equal(new Set(report.cases.map(c => c.id)).size, 441);
for (const key of ['current', 'cstimer'] as const) {
  const errors = report.cases.map(c => Math.abs(c[`${key}ErrorMs`])).sort((a, b) => a - b);
  assert.equal(report.overall[key].cases, errors.length);
  assert.equal(report.overall[key].casesWithin10Ms, errors.filter(e => e <= 10).length);
  assert.equal(report.overall[key].p95AbsoluteErrorMs, errors[Math.ceil(errors.length * .95) - 1]);
  assert.equal(report.overall[key].maxAbsoluteErrorMs, errors.at(-1));
}
assert.equal(report.comparisons.cstimer.improved + report.comparisons.cstimer.regressed + report.comparisons.cstimer.similar, 441);
const selectedIds = ['constant/-0.007/10000/1', 'batch-four/0/10000/1', 'latency-ramp/0/10000/1'];
const examples = selectedIds.map(id => {
  const row = report.cases.find(c => c.id === id);
  assert.ok(row, `Missing example ${id}`);
  const { durationMs, beforeMs, previousMs, currentMs, cstimerMs } = row;
  return { id, durationMs, beforeMs, previousMs, currentMs, cstimerMs };
});
const asset = `/_assets/benchmarks/smart-cube-timing-${sha256.slice(0, 12)}`;
const csv = readFileSync(resolve(root, reportPath.replace('.json', '.csv')));
// The frozen exporter uses JSON strings and numbers without embedded commas.
const [csvHeader, ...csvRows] = csv.toString().trim().split('\n').map(line => line.split(','));
assert.equal(csvRows.length, report.cases.length);
for (const [index, columns] of csvRows.entries()) {
  for (const key of ['id', 'durationMs', 'beforeMs', 'previousMs', 'currentMs', 'cstimerMs'] as const) {
    assert.equal(JSON.parse(columns[csvHeader.indexOf(key)]), report.cases[index][key], `CSV differs: row ${index}, ${key}`);
  }
}
const summary = {
  source: reportPath, sha256,
  measuredAt: report.metadata.generatedAt,
  implementationCommit: 'b70c96fe02', // Commit containing the tested worktree; runtime hashes remain in the full report.
  benchmarkHead: report.metadata.cuberootCommit,
  cstimerCommit: report.metadata.cstimerCommit,
  corpusSha256: report.metadata.corpusSha256,
  downloads: { json: `${asset}.json`, csv: `${asset}.csv` },
  overall: report.overall, groups: report.groups, comparisons: report.comparisons, examples,
  consistentMoveEnds: report.cases.filter(c => Math.abs(c.savedMoveEndMs - c.currentMs) < .001).length,
  inSolveReanchors: report.cases.reduce((sum, c) => sum + c.inSolveReanchors, 0),
};
const outputs = new Map<string, Buffer>([
  ['app/[lang]/timer/accuracy/benchmark.generated.json', Buffer.from(`${JSON.stringify(summary, null, 2)}\n`)],
  [`public${asset}.json`, bytes], [`public${asset}.csv`, csv],
]);
const write = process.argv.includes('--write');
for (const [path, content] of outputs) {
  const destination = resolve(client, path);
  if (write) { mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, content); }
  else assert.ok(readFileSync(destination).equals(content), `Stale generated file: ${path}`);
}
console.log(`${write ? 'Exported' : 'Verified'} frozen 441-case report, page summary and both downloads (${sha256.slice(0, 12)}).`);
