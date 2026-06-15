#!/usr/bin/env node
// Undo codemod-datapick-cast: revert
//   i18n.language === 'zh-Hant' ? ((X as { h?: string }).h ?? X.zf) : (ORIG)
// back to ORIG. Identified by the cast signature ` as { ...?: string })` in the
// whenTrue branch, so it never touches the other (cast-free) 3-way conversions.
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}
let reverted = 0; const touched = new Set();
for (const sf of project.getSourceFiles()) {
  for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression).reverse()) {
    if (ce.wasForgotten()) continue;
    if (ce.getCondition().getText() !== "i18n.language === 'zh-Hant'") continue;
    const wt = ce.getWhenTrue().getText();
    if (!/ as \{ \w+\?: string \}\)\./.test(wt)) continue;     // cast signature only
    let wf = ce.getWhenFalse();
    if (Node.isParenthesizedExpression(wf)) wf = wf.getExpression();
    ce.replaceWithText(wf.getText());
    reverted++; touched.add(sf);
  }
}
await project.save();
console.log(`revert-datapick-cast: reverted ${reverted} across ${touched.size} files`);
