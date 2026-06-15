#!/usr/bin/env node
// Classify remaining `isZh ? : ` / i18n-language ternaries to plan the rest.
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}
const HAS_CJK = /[㐀-鿿豈-﫿]/;

const refsLanguage = (t) => /\.language\b/.test(t);
function isSafeLangIdent(id) {
  const name = id.getText();
  let fn = id.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a));
  while (fn) { for (const p of fn.getParameters()) if (p.getName() === name) return false; fn = fn.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a)); }
  for (const vd of id.getSourceFile().getDescendantsOfKind(SyntaxKind.VariableDeclaration)) { if (vd.getName() === name) { const i = vd.getInitializer(); if (i && refsLanguage(i.getText())) return true; } }
  return false;
}
function sense(test) {
  if (Node.isCallExpression(test)) { const e = test.getExpression(); if (Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith' && refsLanguage(e.getExpression().getText())) return 'zh'; return null; }
  if (Node.isBinaryExpression(test)) { const op = test.getOperatorToken().getText(); if (op !== '===' && op !== '==') return null; const l = test.getLeft(), r = test.getRight(); const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null; if (!lit) return null; const o = lit === l ? r : l; const v = lit.getLiteralValue(); if ((v === 'zh' || v === 'en') && refsLanguage(o.getText())) return v; return null; }
  if (Node.isIdentifier(test) && test.getText() === 'isZh') return isSafeLangIdent(test) ? 'zh' : 'param';
  if (Node.isPrefixUnaryExpression(test) && test.getOperatorToken() === SyntaxKind.ExclamationToken) { const o = test.getOperand(); if (Node.isIdentifier(o) && o.getText() === 'isZh') return isSafeLangIdent(o) ? 'en' : 'param'; }
  return null;
}
function branchKind(ce) {
  const a = ce.getWhenTrue(), b = ce.getWhenFalse();
  const isStr = (n) => Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n);
  const isJsx = (n) => Node.isJsxElement(n) || Node.isJsxFragment(n) || Node.isJsxSelfClosingElement(n) || Node.isParenthesizedExpression(n) && /^[\s(]*</.test(n.getText());
  if (isStr(a) && isStr(b)) {
    const zh = (ce.__sense === 'zh' ? a : b);
    return HAS_CJK.test((Node.isStringLiteral(zh) || Node.isNoSubstitutionTemplateLiteral(zh)) ? zh.getLiteralValue() : '') ? 'both-string-cjk' : 'both-string-nocjk';
  }
  if (isJsx(a) || isJsx(b)) return 'has-jsx';
  return 'dynamic';
}

const cats = {};
const samples = {};
for (const sf of project.getSourceFiles()) {
  for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    const s = sense(ce.getCondition());
    if (!s) continue;
    ce.__sense = s === 'en' ? 'en' : 'zh';
    const tk = s === 'param' ? 'param' : 'i18n';
    const bk = s === 'param' ? '-' : branchKind(ce);
    const key = `${tk} / ${bk}`;
    cats[key] = (cats[key] || 0) + 1;
    if (tk === 'i18n' && (bk === 'has-jsx' || bk === 'dynamic' || bk === 'both-string-cjk')) {
      (samples[key] ||= []).push(`${sf.getFilePath().replace(/.*client[\\/]/, '')}:${ce.getStartLineNumber()}  ${ce.getText().slice(0, 80).replace(/\s+/g, ' ')}`);
    }
  }
}
console.log('=== counts ===');
for (const [k, v] of Object.entries(cats).sort()) console.log(`${v}\t${k}`);
console.log('\n=== samples (actionable i18n cases) ===');
for (const [k, arr] of Object.entries(samples)) { console.log(`\n--- ${k} (${arr.length}) ---`); console.log(arr.slice(0, 12).join('\n')); }
