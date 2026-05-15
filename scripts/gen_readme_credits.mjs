#!/usr/bin/env node
// 单一数据源 credits_data.json → 替换 README.md 的 <!-- credits:start --><!-- credits:end --> 块
// 用法: node scripts/gen_readme_credits.mjs (或 pnpm gen-credits 在 core/ 内)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const dataPath = resolve(repoRoot, 'core/packages/client/src/pages/credits_data.json');
const readmePath = resolve(repoRoot, 'README.md');

const credits = JSON.parse(readFileSync(dataPath, 'utf8'));
const readme = readFileSync(readmePath, 'utf8');

const startMarker = '<!-- credits:start -->';
const endMarker = '<!-- credits:end -->';

const startIdx = readme.indexOf(startMarker);
const endIdx = readme.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
  console.error(`README missing ${startMarker} / ${endMarker} markers`);
  process.exit(1);
}

const bullets = credits
  .map(c => `- [**${c.name}**](${c.url}) — ${c.long_en || c.en}`)
  .join('\n');

const block = `${startMarker}\n${bullets}\n${endMarker}`;
const next = readme.slice(0, startIdx) + block + readme.slice(endIdx + endMarker.length);

if (next === readme) {
  console.log('README credits already up to date');
} else {
  writeFileSync(readmePath, next);
  console.log(`README credits updated (${credits.length} entries)`);
}
