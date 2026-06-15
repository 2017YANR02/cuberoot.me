#!/usr/bin/env node
// One-off: fix s2twp's domain mistranslation in already-baked Traditional output.
// 项目 (a cube EVENT) was rendered 專案 (software project). 專案 only appears in
// generated Traditional text (Simplified source uses 项目), so a blanket swap is
// safe. Keep 開源專案 (the site itself IS an open-source project).
import { Project } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks', 'i18n']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}
let files = 0, hits = 0;
for (const sf of project.getSourceFiles()) {
  const t = sf.getFullText();
  if (!t.includes('專案')) continue;
  const fixed = t.replace(/專案/g, '項目').replace(/開源項目/g, '開源專案');
  if (fixed === t) continue;
  hits += (t.match(/專案/g) || []).length;
  sf.replaceWithText(fixed);
  files++;
}
await project.save();
console.log(`fix-domain-terms: 專案->項目 across ${files} files (~${hits} occurrences)`);
