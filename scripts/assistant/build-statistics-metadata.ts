/** Repository build-time inventory. Only reads small sources; never imports jobs. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { definitions, coverage } from './statistics-metadata-definitions.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = resolve(root, 'core/apps/api/src/generated/statistics-metadata.json');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const registryPath = 'docs/data/artifacts/generated-artifacts.json';
const registry = JSON.parse(read(registryPath)).artifacts;
const workflow = read('.github/workflows/stats.yml');
// Narrow extraction fails closed when the executable configuration shape changes.
const schedule = workflow.match(/^  schedule:\s*\n((?:    .*\n)+)/m)?.[1];
const cron = [...(schedule ?? '').matchAll(/^    - cron: ['"]([^'"]+)['"]/gm)].map(m => m[1]);
const jobs = Object.fromEntries([...workflow.matchAll(/^  ([\w-]+):\n    if: ([^\n]+)/gm)].map(m => [m[1], m[2]]));
if (!cron.length || !jobs['syntax-check'] || !jobs.build || !/^  workflow_dispatch:/m.test(workflow)) throw new Error('Review stats workflow trigger structure');
const heavyBlock = read('core/jobs/stats-build/src/bin/compute_all.ts').match(/const HEAVY_STATS = new Set\(\[([\s\S]*?)\]\)/)?.[1];
const heavyStatIds = [...(heavyBlock ?? '').replace(/\/\/[^\n]*/g, '').matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);
if (!heavyStatIds.length) throw new Error('Missing HEAVY_STATS');
const commands = JSON.parse(read('core/package.json')).scripts;
const sourcePaths = [...new Set([registryPath, 'scripts/assistant/statistics-metadata-definitions.ts', ...definitions.flatMap(d => d.sources)])].sort();
const provenance = sourcePaths.map(path => ({ path, sha256: sha(read(path)), href: 'https://github.com/2017YANR02/cuberoot.me/blob/main/' + path }));
const entries = definitions.map(entry => ({
  ...entry,
  artifacts: entry.artifacts.map(id => {
    const artifact = registry.find((item: { id: string }) => item.id === id);
    if (!artifact) throw new Error(`Unknown artifact ${id}`);
    return { id, owner: artifact.owner, command: artifact.command, outputs: artifact.outputs ?? [] };
  }),
  ...(entry.update.trigger === 'workflow' ? { workflow: { path: '.github/workflows/stats.yml', cron, timeZone: 'UTC', manual: true, jobConditions: jobs } } : {}),
  ...(entry.id === 'wca-heavy' ? { heavyStatIds } : {}),
  ...(entry.id === 'scramble' ? { commands: Object.fromEntries(['stats:scramble', 'stats:scramble:local'].map(key => {
    if (!commands[key]) throw new Error(`Missing command ${key}`);
    return [key, commands[key]];
  })) } : {})
}));
const catalog = { schemaVersion: 1, version: sha(JSON.stringify({ entries, coverage, provenance })), coverage, provenance, entries };
const bytes = JSON.stringify(catalog, null, 2) + '\n';
if (process.argv.includes('--write')) {
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, bytes);
  console.log(`Generated ${entries.length} metadata families; no computation or network`);
} else {
  if (readFileSync(output, 'utf8') !== bytes) throw new Error('Metadata drift: run node scripts/assistant/build-statistics-metadata.ts --write and review source/semantics changes');
  console.log(`Metadata matches ${provenance.length} source files`);
}
