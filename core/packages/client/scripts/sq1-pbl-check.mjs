#!/usr/bin/env node
// SQ1 PBL Google Sheet full-XLSX drift detector (zero npm dependencies).
// Exit: 0 = in sync/editorial-only, 3 = material drift, 2 = no baseline, 1 = fetch/parse error.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyDrift, renderReport } from './sq1-pbl/check-lib.mjs';

export const DOC_ID = '1VQNYNwdOLqqBkacHcfYtEBst22FOVhH9EAhTOYOZTgo';
export const DOC_URL = `https://docs.google.com/spreadsheets/d/${DOC_ID}/edit`;
export const XLSX_URL = `https://docs.google.com/spreadsheets/d/${DOC_ID}/export?format=xlsx`;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NORMALIZER = path.join(HERE, 'sq1-pbl', 'normalize.py');
const DEFAULT_BASELINE = path.join(HERE, 'sq1-pbl', 'source.snapshot.json');
const DEFAULT_CASES_OUTPUT = path.resolve(HERE, '..', 'data', 'sq1-pbl', 'cases.json');
const DEFAULT_FINDER_DEFAULTS = path.resolve(HERE, '..', 'data', 'sq1-pbl', 'finder-defaults.json');
const DEFAULT_PUBLIC_FINDER_DEFAULTS = path.resolve(
  HERE,
  '..',
  'public',
  'data',
  'sq1-pbl',
  'finder-defaults.json',
);
const args = process.argv.slice(2);

function option(name, fallback = null) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1]) throw new Error(`${name} requires a value`);
  return args[index + 1];
}

function pythonCandidates() {
  if (process.env.SQ1_PBL_PYTHON) return [[process.env.SQ1_PBL_PYTHON, []]];
  return process.platform === 'win32'
    ? [['uv', ['run', 'python']], ['python', []], ['py', ['-3']]]
    : [['python3', []], ['python', []]];
}

function normalize(source, casesOutput = null) {
  let missing = [];
  for (const [command, prefix] of pythonCandidates()) {
    const normalizerArgs = [...prefix, NORMALIZER, source];
    if (casesOutput) normalizerArgs.push('--cases-output', casesOutput);
    const result = spawnSync(command, normalizerArgs, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    });
    if (result.error?.code === 'ENOENT') {
      missing.push(command);
      continue;
    }
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr.trim() || `normalizer exited ${result.status}`);
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw new Error(`normalizer returned invalid JSON: ${result.stdout.slice(0, 200)}`);
    }
  }
  throw new Error(`Python not found (tried ${missing.join(', ')})`);
}

function atomicWrite(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, data);
  fs.renameSync(temporaryPath, filePath);
}

function syncFinderDefaults(sourcePath, destinationPath) {
  const raw = fs.readFileSync(sourcePath);
  JSON.parse(raw.toString('utf8'));
  atomicWrite(destinationPath, raw);
}

try {
  if (args.includes('--public-write') || args.includes('--public-dir')) {
    throw new Error('workbook-page export is retired; use --write for cases, finder defaults, and baseline only');
  }
  const source = option('--source', XLSX_URL);
  const baselinePath = path.resolve(option('--baseline', DEFAULT_BASELINE));
  const reportPath = option('--report');
  const write = args.includes('--write');
  const casesOutput = write ? path.resolve(option('--cases-output', DEFAULT_CASES_OUTPUT)) : null;
  const finderDefaults = write ? path.resolve(option('--finder-defaults', DEFAULT_FINDER_DEFAULTS)) : null;
  const publicFinderDefaults = write
    ? path.resolve(option('--public-finder-defaults', DEFAULT_PUBLIC_FINDER_DEFAULTS))
    : null;
  const live = normalize(source, casesOutput);

  if (write) {
    syncFinderDefaults(finderDefaults, publicFinderDefaults);
    const snapshot = { ...live, fetchedAt: new Date().toISOString() };
    atomicWrite(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`[sq1-pbl-check] cases written: ${casesOutput}`);
    console.log(`[sq1-pbl-check] finder defaults synced: ${publicFinderDefaults}`);
    console.log(`[sq1-pbl-check] baseline written: ${live.totals.sheets} sheets from ${live.source}`);
    process.exitCode = 0;
  } else if (!fs.existsSync(baselinePath)) {
    console.error(`[sq1-pbl-check] no baseline at ${baselinePath}; run with --write`);
    process.exitCode = 2;
  } else {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    if (baseline.schemaVersion !== live.schemaVersion) {
      throw new Error(`snapshot schema mismatch: ${baseline.schemaVersion} != ${live.schemaVersion}`);
    }
    const result = classifyDrift(baseline, live);
    const report = renderReport(baseline, live, result, DOC_URL);
    console.log(report);
    if (reportPath) fs.writeFileSync(reportPath, `${report}\n`);
    process.exitCode = result.material ? 3 : 0;
  }
} catch (error) {
  console.error(`[sq1-pbl-check] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
