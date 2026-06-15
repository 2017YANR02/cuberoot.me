#!/usr/bin/env node
// Reverse-fix: the forward codemod over-eagerly turned LOGIC ternaries whose
// branches are locale codes / classNames (no CJK in the zh branch) into
// tr({ zh, en }). tr() returns `string`, which breaks narrowly-typed sinks
// (e.g. setLang('zh'|'en')) and is semantically wrong (those aren't UI text).
//
// This reverts ONLY tr({ zh: X, en: Y }) calls whose zh literal has NO CJK,
// back to `(i18n.language.startsWith('zh') ? X : Y)` — the original semantics.
// CJK tr() calls (real UI text) are left untouched. Imports are fixed up.

import { Project, SyntaxKind, Node, QuoteKind } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const project = new Project({
  skipAddingFilesFromTsConfig: true,
  manipulationSettings: { quoteKind: QuoteKind.Single },
});
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

const HAS_CJK = /[㐀-鿿豈-﫿]/;

function litValue(node) {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralValue();
  return null; // dynamic — don't touch
}

let total = 0;
const files = [];

for (const sf of project.getSourceFiles()) {
  const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
  let reverted = 0;
  for (const call of calls.reverse()) {
    if (call.wasForgotten()) continue;
    if (call.getExpression().getText() !== 'tr') continue;
    const args = call.getArguments();
    if (args.length !== 1 || !Node.isObjectLiteralExpression(args[0])) continue;
    const obj = args[0];
    const zhp = obj.getProperty('zh');
    const enp = obj.getProperty('en');
    if (!zhp || !enp || !Node.isPropertyAssignment(zhp) || !Node.isPropertyAssignment(enp)) continue;
    const zhInit = zhp.getInitializer();
    const enInit = enp.getInitializer();
    const zhVal = litValue(zhInit);
    if (zhVal == null) continue;        // dynamic zh — leave as tr()
    if (HAS_CJK.test(zhVal)) continue;  // real UI text — keep
    // Non-CJK → logic value, revert to ternary.
    call.replaceWithText(`(i18n.language.startsWith('zh') ? ${zhInit.getText()} : ${enInit.getText()})`);
    reverted++;
  }
  if (reverted === 0) continue;

  // Ensure default `i18n` import from '@/i18n/i18n-client'.
  const cli = sf.getImportDeclaration((d) => d.getModuleSpecifierValue() === '@/i18n/i18n-client');
  if (cli) {
    if (!cli.getDefaultImport()) cli.setDefaultImport('i18n');
  } else {
    sf.addImportDeclaration({ moduleSpecifier: '@/i18n/i18n-client', defaultImport: 'i18n' });
  }

  // Drop the now-possibly-unused `tr` import if no tr() calls remain.
  const stillUsesTr = sf
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((c) => !c.wasForgotten() && c.getExpression().getText() === 'tr');
  if (!stillUsesTr) {
    const trImp = sf.getImportDeclaration((d) => d.getModuleSpecifierValue() === '@/i18n/tr');
    if (trImp) {
      const named = trImp.getNamedImports().find((n) => n.getName() === 'tr');
      if (named) named.remove();
      if (trImp.getNamedImports().length === 0 && !trImp.getDefaultImport() && !trImp.getNamespaceImport()) {
        trImp.remove();
      }
    }
  }

  files.push(sf.getFilePath().replace(/.*client[\\/]/, '') + `: ${reverted}`);
  total += reverted;
}

console.log(files.sort().join('\n'));
console.log(`\nreverted ${total} non-CJK tr() calls in ${files.length} files`);
await project.save();
