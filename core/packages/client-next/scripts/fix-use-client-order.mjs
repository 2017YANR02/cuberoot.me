#!/usr/bin/env node
// Fix: the codemod's addImportDeclaration inserted `import { tr }` ABOVE the
// file's `'use client'` directive. The directive MUST be the first statement, so
// Next/SWC errors out. This moves a misplaced 'use client' / "use client" line
// back to line 1. Idempotent; only touches files where the directive isn't first.
import { readFileSync, writeFileSync } from 'node:fs';
import { Project } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

const DIRECTIVE = /^\s*(['"])use client\1\s*;?\s*$/;
let fixed = 0;
const files = [];
for (const sf of project.getSourceFiles()) {
  const fp = sf.getFilePath();
  const lines = readFileSync(fp, 'utf8').split('\n');
  const idx = lines.findIndex((l) => DIRECTIVE.test(l));
  if (idx <= 0) continue; // not present, or already first line
  // Is there any import/code (non-comment, non-blank) before it? If so it's broken.
  const before = lines.slice(0, idx).some((l) => {
    const t = l.trim();
    return t && !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
  });
  if (!before) continue;
  lines.splice(idx, 1); // remove the misplaced directive
  lines.unshift("'use client';", '');
  writeFileSync(fp, lines.join('\n'));
  files.push(fp.replace(/.*client-next[\\/]/, ''));
  fixed++;
}
console.log(files.sort().join('\n'));
console.log(`\nfixed 'use client' placement in ${fixed} files`);
