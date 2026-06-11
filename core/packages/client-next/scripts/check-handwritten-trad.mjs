#!/usr/bin/env node
// CI scanner: verifies Traditional baked into INLINE 3-way ternaries against its
// Simplified sibling — the one Traditional location no other --check covers.
//
// Coverage map of source Traditional:
//   • zhHant fields in tr() args / objects with zhHant  → inject-zhhant --check
//   • i18n/zh-Hant.json (t() catalog)                   → gen-zh-hant --check
//   • i18n.language==='zh-Hant' ? (繁) : (isZh?简:en)    → HERE
//
// Core rule lives in scripts/lib/trad-ternary-check.mjs (shared with the
// write-time PreToolUse hook so both enforce the identical check).
//
// Run:  node scripts/check-handwritten-trad.mjs            (report; exit 1 on any)
//       node scripts/check-handwritten-trad.mjs --check     (CI gate alias)

import { Project } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { collectViolations } from './lib/trad-ternary-check.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const project = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { jsx: 4 } });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

const violations = [];
let files = 0;
for (const sf of project.getSourceFiles()) {
  if (/\.test\.tsx?$/.test(sf.getFilePath())) continue;
  files++;
  const rel = relative(ROOT, sf.getFilePath()).replace(/\\/g, '/');
  for (const v of collectViolations(sf)) violations.push({ file: rel, ...v });
}

for (const v of violations) {
  console.error(`⛔ ${v.file}:${v.line}`);
  console.error(`   got:      ${JSON.stringify(v.got)}`);
  console.error(`   expected: ${JSON.stringify(v.expected)}`);
}
console.error(`\n扫描 ${files} 个文件的内联三路;违规 ${violations.length} 处。`);
if (violations.length) {
  console.error('站点繁体一律由 OpenCC 生成,禁手敲。修复:繁体分支用 `node scripts/conv.mjs "简体"` 重新取值替换。');
  process.exit(1);
}
console.log('OK — 每个内联三路的繁体分支都等于 conv(简体兄弟)。');
process.exit(0);
