#!/usr/bin/env node
// Build-time 3-way for DYNAMIC i18n ternaries whose zh branch carries STATIC CJK
// in the code (template literals like `已选 ${n} 项`, nested string-literal
// ternaries, stray string-literal pairs). Rewrites
//     COND ? ZH : EN
// into
//     i18n.language === 'zh-Hant' ? (ZH_HANT) : (COND ? ZH : EN)
// where ZH_HANT is ZH with its CJK OpenCC(s2twp)-converted. CJK only ever lives
// inside string/template literals here (identifiers/keywords are ASCII), so a
// whole-branch convert touches only the visible text; ${...} interpolations and
// .length etc. are untouched. Pure static -> SSR/client render identical
// Traditional, no runtime OpenCC, no hydration gap.
//
// Auto-skips branches with no CJK or where conversion is a no-op (简繁同形 like
// 移除), so dataPick (X.zh:X.en) and strVar (isZh?zh:en) fall through untouched —
// they're handled by their own waves.
//
// Run: node scripts/codemod-dynamic-3way.mjs [pathSubstr ...]
import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const conv = OpenCC.Converter({ from: 'cn', to: 'twp' });
const HAS_CJK = /[㐀-鿿豈-﫿]/;
const filters = process.argv.slice(2);

const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

const refsLang = (t) => /\.language\b/.test(t);
function isSafeLangIdent(id) {
  const name = id.getText();
  let fn = id.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a));
  while (fn) { for (const p of fn.getParameters()) if (p.getName() === name) return false; fn = fn.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a)); }
  for (const vd of id.getSourceFile().getDescendantsOfKind(SyntaxKind.VariableDeclaration)) { if (vd.getName() === name) { const i = vd.getInitializer(); if (i && refsLang(i.getText())) return true; } }
  return false;
}
// which branch (true/false) is Chinese: 'zh' = whenTrue, 'en' = whenFalse, null = not i18n
function sense(test) {
  if (Node.isCallExpression(test)) { const e = test.getExpression(); if (Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith' && refsLang(e.getExpression().getText())) return 'zh'; return null; }
  if (Node.isBinaryExpression(test)) { const op = test.getOperatorToken().getText(); if (op !== '===' && op !== '==') return null; const l = test.getLeft(), r = test.getRight(); const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null; if (!lit) return null; const o = lit === l ? r : l; const v = lit.getLiteralValue(); if (!refsLang(o.getText())) return null; if (v === 'zh') return 'zh'; if (v === 'en') return 'en'; return null; }
  // isZh always means "is Chinese language" by convention; the 3-way branch reads
  // the GLOBAL i18n.language, so it's correct whether isZh is a local or a param/prop.
  if (Node.isIdentifier(test) && test.getText() === 'isZh') return 'zh';
  if (Node.isPrefixUnaryExpression(test) && test.getOperatorToken() === SyntaxKind.ExclamationToken) { const o = test.getOperand(); if (Node.isIdentifier(o) && o.getText() === 'isZh') return 'en'; }
  return null;
}
const isJsx = (n) => Node.isJsxElement(n) || Node.isJsxFragment(n) || Node.isJsxSelfClosingElement(n) || (Node.isParenthesizedExpression(n) && /^[\s(]*</.test(n.getText()));

let changed = 0; const touched = new Set();
for (const sf of project.getSourceFiles()) {
  if (filters.length && !filters.some((f) => sf.getFilePath().includes(f))) continue;
  // process deepest-first so nested rewrites don't invalidate outer text
  const ces = sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression).reverse();
  for (const ce of ces) {
    if (ce.wasForgotten()) continue;
    // idempotency: skip ternaries already nested inside an `=== 'zh-Hant' ?` 3-way
    let up = ce.getParent();
    while (up && Node.isParenthesizedExpression(up)) up = up.getParent();
    if (up && Node.isConditionalExpression(up) && /['"]zh-Hant['"]/.test(up.getCondition().getText())) continue;
    const s = sense(ce.getCondition());
    if (!s) continue;
    const zhBranch = s === 'zh' ? ce.getWhenTrue() : ce.getWhenFalse();
    if (isJsx(ce.getWhenTrue()) || isJsx(ce.getWhenFalse())) continue;
    const zhText = zhBranch.getText();
    if (!HAS_CJK.test(zhText)) continue;            // dataPick / strVar / no-text
    const hant = conv(zhText);
    if (hant === zhText) continue;                  // 简繁同形 -> zhHant ?? zh ok
    const orig = ce.getText();
    ce.replaceWithText(`i18n.language === 'zh-Hant' ? (${hant}) : (${orig})`);
    changed++; touched.add(sf);
  }
}
// ensure module-level `import i18n from '@/i18n/i18n-client'` in every touched file
for (const sf of touched) {
  const has = sf.getImportDeclarations().some((d) => d.getModuleSpecifierValue() === '@/i18n/i18n-client' && d.getDefaultImport());
  if (!has) sf.addImportDeclaration({ moduleSpecifier: '@/i18n/i18n-client', defaultImport: 'i18n' });
}
await project.save();
console.log(`dynamic-3way: rewrote ${changed} ternaries across ${touched.size} files`);
