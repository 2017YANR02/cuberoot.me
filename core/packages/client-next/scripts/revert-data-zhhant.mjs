#!/usr/bin/env node
// Undo zhHant injected into standalone {zh,en} DATA objects (kept only on tr()
// call args). Injecting zhHant into typed data objects breaks their interfaces
// (`zhHant does not exist in type X`). Data objects rendered via tr(X) simply
// fall back to Simplified `zh` on zh-Hant — an accepted gap.
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

let removed = 0;
const files = new Set();
for (const sf of project.getSourceFiles()) {
  for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    const zhHant = obj.getProperty('zhHant');
    if (!zhHant) continue;
    // Keep zhHant ONLY when this object is the sole argument of a tr(...) call.
    const parent = obj.getParent();
    const isTrArg = parent && Node.isCallExpression(parent) && parent.getExpression().getText() === 'tr';
    if (isTrArg) continue;
    zhHant.remove();
    removed++;
    files.add(sf.getFilePath());
  }
}
await project.save();
console.log(`removed zhHant from ${removed} data objects across ${files.size} files`);
