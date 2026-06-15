#!/usr/bin/env node
// Convert the data-object language pick `cond ? X.zh : X.en` → `tr(X)`, where
// cond is the UI language (isZh / lang==='zh' / i18n.language...). tr(X) reads
// X.zhHant ?? X.zh on zh-Hant, so once inject-zhhant has added zhHant to the
// {zh,en} data objects, these render Traditional too — and the bare isZh ternary
// is gone. Component files only (.tsx). Typecheck gates any non-{zh,en} object.
//
// Run AFTER inject-zhhant (so the data objects already carry zhHant).

import { Project, SyntaxKind, Node, QuoteKind } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const project = new Project({
  skipAddingFilesFromTsConfig: true,
  manipulationSettings: { quoteKind: QuoteKind.Single },
});
for (const d of ['app', 'components']) project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx')]);

const langRef = (t) => /\.language\b/.test(t) || /^(isZh|lang|language|locale)$/.test(t.trim());
// Returns 'zh' | 'en' | null — which branch is the Chinese one.
function sense(test) {
  if (Node.isIdentifier(test) && test.getText() === 'isZh') return 'zh';
  if (Node.isPrefixUnaryExpression(test) && test.getOperatorToken() === SyntaxKind.ExclamationToken
    && test.getOperand().getText() === 'isZh') return 'en';
  if (Node.isCallExpression(test)) {
    const e = test.getExpression();
    if (Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith' && langRef(e.getExpression().getText())) return 'zh';
  }
  if (Node.isBinaryExpression(test)) {
    const op = test.getOperatorToken().getText();
    if (op !== '===' && op !== '==') return null;
    const l = test.getLeft(), r = test.getRight();
    const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null;
    if (!lit) return null;
    const other = lit === l ? r : l;
    const v = lit.getLiteralValue();
    if ((v === 'zh' || v === 'en') && langRef(other.getText())) return v;
  }
  return null;
}

let changed = 0;
const files = [];
for (const sf of project.getSourceFiles()) {
  let n = 0;
  for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression).reverse()) {
    if (ce.wasForgotten()) continue;
    const s = sense(ce.getCondition());
    if (!s) continue;
    const a = ce.getWhenTrue(), b = ce.getWhenFalse();
    const zhSide = s === 'zh' ? a : b;
    const enSide = s === 'zh' ? b : a;
    if (!Node.isPropertyAccessExpression(zhSide) || !Node.isPropertyAccessExpression(enSide)) continue;
    if (zhSide.getName() !== 'zh' || enSide.getName() !== 'en') continue;
    const base = zhSide.getExpression().getText();
    if (base !== enSide.getExpression().getText()) continue;
    ce.replaceWithText(`tr(${base})`);
    n++;
  }
  if (n > 0) {
    const imp = sf.getImportDeclaration((d) => d.getModuleSpecifierValue() === '@/i18n/tr');
    if (imp) {
      if (!imp.getNamedImports().some((x) => x.getName() === 'tr')) imp.addNamedImport('tr');
    } else {
      sf.addImportDeclaration({ moduleSpecifier: '@/i18n/tr', namedImports: ['tr'] });
    }
    files.push(sf.getFilePath().replace(/.*client[\\/]/, '') + `: ${n}`);
    changed += n;
  }
}
console.log(files.sort().join('\n'));
console.log(`\n${DRY ? '[DRY] ' : ''}${changed} data-pick ternaries → tr(X) in ${files.length} files`);
if (!DRY) await project.save();
