#!/usr/bin/env node
// Revert codemod-data-pick: tr(X) where X is NOT an object literal was created by
// data-pick from `cond ? X.zh : X.en`. Without static type info it also caught
// cases where X.zh/X.en aren't strings (nested objects), breaking tr()'s Msg
// type. Roll them all back to a plain language ternary on the data object's
// .zh/.en (Simplified on zh-Hant — an accepted gap for dynamic data).
import { Project, SyntaxKind, Node, QuoteKind } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const project = new Project({
  skipAddingFilesFromTsConfig: true,
  manipulationSettings: { quoteKind: QuoteKind.Single },
});
for (const d of ['app', 'components']) project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx')]);

let reverted = 0;
const touched = new Set();
for (const sf of project.getSourceFiles()) {
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression).reverse()) {
    if (call.wasForgotten() || call.getExpression().getText() !== 'tr') continue;
    const args = call.getArguments();
    if (args.length !== 1) continue;
    const arg = args[0];
    if (Node.isObjectLiteralExpression(arg)) continue; // genuine tr({zh,en}) — keep
    const base = arg.getText();
    call.replaceWithText(`(i18n.language.startsWith('zh') ? ${base}.zh : ${base}.en)`);
    reverted++;
    touched.add(sf);
  }
}
for (const sf of touched) {
  const cli = sf.getImportDeclaration((d) => d.getModuleSpecifierValue() === '@/i18n/i18n-client');
  if (cli) {
    if (!cli.getDefaultImport()) cli.setDefaultImport('i18n');
  } else {
    sf.addImportDeclaration({ moduleSpecifier: '@/i18n/i18n-client', defaultImport: 'i18n' });
  }
  // Drop now-unused tr import if no tr() calls remain.
  const stillTr = sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => !c.wasForgotten() && c.getExpression().getText() === 'tr');
  if (!stillTr) {
    const imp = sf.getImportDeclaration((d) => d.getModuleSpecifierValue() === '@/i18n/tr');
    if (imp) {
      const n = imp.getNamedImports().find((x) => x.getName() === 'tr');
      if (n) n.remove();
      if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) imp.remove();
    }
  }
}
await project.save();
console.log(`reverted ${reverted} data-pick tr(X) calls across ${touched.size} files`);
