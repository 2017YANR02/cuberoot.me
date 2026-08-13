#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLandingPastComps, type LandingCompRecord } from '../landing_comps.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../../../');
const pastPath = resolve(repoRoot, 'stats/all_past_comps.json');
const outputPath = resolve(repoRoot, 'stats/recent_past_comps.json');

function readComps(path: string): LandingCompRecord[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${path}: expected a JSON array`);
  return parsed as LandingCompRecord[];
}

const past = readComps(pastPath);
if (past.length === 0) {
  throw new Error('Refusing to replace recent_past_comps.json from an empty competition source');
}
const output = buildLandingPastComps(past);
const json = JSON.stringify(output);
writeFileSync(outputPath, json, 'utf8');
console.log(`Generated ${outputPath}: ${output.length} comps, ${Math.round(Buffer.byteLength(json) / 1024)} KB`);
