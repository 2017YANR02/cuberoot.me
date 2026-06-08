#!/usr/bin/env node
// Build-time 3-way for has-jsx i18n ternaries (math/prediction explainer pages).
//     COND ? (<>中文 <TeX/> 文字</>) : (<>english</>)
// becomes
//     i18n.language === 'zh-Hant' ? (<>繁體 <TeX/> 文字</>) : (COND ? (<>中文…</>) : (<>english</>))
// OpenCC(s2twp) only ever rewrites CJK glyphs -> CJK glyphs; it never touches
// ASCII (< > / { } = " tag names, TeX src, ${} exprs), so JSX structure is
// preserved while every visible JsxText / CJK attr is converted. Pure static,
// hydration-clean. The zh subtree is duplicated (zh + zh-Hant) — accepted cost
// for static content pages.
//
// Run: node scripts/codemod-jsx-3way.mjs [pathSubstr ...]
import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const conv = OpenCC.Converter({ from: 'cn', to: 'twp' });
const HAS_CJK = /[㐀-鿿豈-﫿]/;
const filters = process.argv.slice(2);

const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components']) project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx')]);

const refsLang = (t) => /\.language\b/.test(t);
function isSafeLangIdent(id) {
  const name = id.getText();
  let fn = id.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a));
  while (fn) { for (const p of fn.getParameters()) if (p.getName() === name) return false; fn = fn.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a)); }
  for (const vd of id.getSourceFile().getDescendantsOfKind(SyntaxKind.VariableDeclaration)) { if (vd.getName() === name) { const i = vd.getInitializer(); if (i && refsLang(i.getText())) return true; } }
  return false;
}
function sense(test) {
  if (Node.isCallExpression(test)) { const e = test.getExpression(); if (Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith' && refsLang(e.getExpression().getText())) return 'zh'; return null; }
  if (Node.isBinaryExpression(test)) { const op = test.getOperatorToken().getText(); if (op !== '===' && op !== '==') return null; const l = test.getLeft(), r = test.getRight(); const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null; if (!lit) return null; const o = lit === l ? r : l; const v = lit.getLiteralValue(); if (!refsLang(o.getText())) return null; if (v === 'zh') return 'zh'; if (v === 'en') return 'en'; return null; }
  // isZh always means "is Chinese language"; the 3-way branch reads the GLOBAL
  // i18n.language, so it's correct whether isZh is a local or a param/prop.
  if (Node.isIdentifier(test) && test.getText() === 'isZh') return 'zh';
  if (Node.isPrefixUnaryExpression(test) && test.getOperatorToken() === SyntaxKind.ExclamationToken) { const o = test.getOperand(); if (Node.isIdentifier(o) && o.getText() === 'isZh') return 'en'; }
  return null;
}
const isJsx = (n) => Node.isJsxElement(n) || Node.isJsxFragment(n) || Node.isJsxSelfClosingElement(n) || (Node.isParenthesizedExpression(n) && /^[\s(]*</.test(n.getText()));

let changed = 0; const touched = new Set();
for (const sf of project.getSourceFiles()) {
  if (filters.length && !filters.some((f) => sf.getFilePath().includes(f))) continue;
  for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression).reverse()) {
    if (ce.wasForgotten()) continue;
    // idempotency: skip ternaries already nested inside an `=== 'zh-Hant' ?` 3-way
    let up = ce.getParent();
    while (up && Node.isParenthesizedExpression(up)) up = up.getParent();
    if (up && Node.isConditionalExpression(up) && /['"]zh-Hant['"]/.test(up.getCondition().getText())) continue;
    const s = sense(ce.getCondition());
    if (!s) continue;
    if (!(isJsx(ce.getWhenTrue()) || isJsx(ce.getWhenFalse()))) continue;
    const zhBranch = s === 'zh' ? ce.getWhenTrue() : ce.getWhenFalse();
    const zhText = zhBranch.getText();
    if (!HAS_CJK.test(zhText)) continue;
    const hant = conv(zhText);
    if (hant === zhText) continue;
    const orig = ce.getText();
    ce.replaceWithText(`i18n.language === 'zh-Hant' ? (${hant}) : (${orig})`);
    changed++; touched.add(sf);
  }
}
for (const sf of touched) {
  const has = sf.getImportDeclarations().some((d) => d.getModuleSpecifierValue() === '@/i18n/i18n-client' && d.getDefaultImport());
  if (!has) sf.addImportDeclaration({ moduleSpecifier: '@/i18n/i18n-client', defaultImport: 'i18n' });
}
await project.save();
console.log(`jsx-3way: rewrote ${changed} ternaries across ${touched.size} files`);
