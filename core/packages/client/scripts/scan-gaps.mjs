#!/usr/bin/env node
// Precise residual-gap scanner: lists i18n-sense conditionals that are NOT yet
// wrapped in a `i18n.language === 'zh-Hant' ? ... : (orig)` 3-way (and not inside
// a (zh,en,zhHant?) helper arrow). These are the real Simplified-on-zh-Hant gaps.
// Excludes `param` isZh (function-local prop, handled at call site) and string
// pairs whose zh side is 简繁同形 (OpenCC no-op).
import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = OpenCC.Converter({ from: 'cn', to: 'twp' });
const conv = (s) => raw(s).replace(/專案/g, '項目').replace(/開源項目/g, '開源專案');
const HAS_CJK = /[㐀-鿿豈-﫿]/;
const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}
const refsLang = (t) => /\.language\b/.test(t);
function isSafeLangIdent(id) {
  const name = id.getText();
  let fn = id.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a));
  while (fn) { for (const p of fn.getParameters()) { const t = p.getNameNode(); if (Node.isObjectBindingPattern(t)) { if (t.getElements().some((e) => e.getName() === name)) return false; } else if (p.getName() === name) return false; } fn = fn.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a)); }
  for (const vd of id.getSourceFile().getDescendantsOfKind(SyntaxKind.VariableDeclaration)) { if (vd.getName() === name) { const i = vd.getInitializer(); if (i && refsLang(i.getText())) return true; } }
  return false;
}
function sense(test) {
  if (Node.isCallExpression(test)) { const e = test.getExpression(); if (Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith' && refsLang(e.getExpression().getText())) return 'zh'; return null; }
  if (Node.isBinaryExpression(test)) { const op = test.getOperatorToken().getText(); if (op !== '===' && op !== '==') return null; const l = test.getLeft(), r = test.getRight(); const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null; if (!lit) return null; const o = lit === l ? r : l; const v = lit.getLiteralValue(); if ((v === 'zh' || v === 'en') && refsLang(o.getText())) return v; return null; }
  if (Node.isIdentifier(test) && test.getText() === 'isZh') return isSafeLangIdent(test) ? 'zh' : 'param';
  if (Node.isPrefixUnaryExpression(test) && test.getOperatorToken() === SyntaxKind.ExclamationToken) { const o = test.getOperand(); if (Node.isIdentifier(o) && o.getText() === 'isZh') return isSafeLangIdent(o) ? 'en' : 'param'; }
  return null;
}
function covered(ce) {
  let up = ce.getParent();
  while (up && Node.isParenthesizedExpression(up)) up = up.getParent();
  if (up && Node.isConditionalExpression(up) && /zh-Hant/.test(up.getCondition().getText())) return true;
  let fn = ce.getFirstAncestor((a) => Node.isArrowFunction(a) || Node.isFunctionDeclaration(a) || Node.isFunctionExpression(a));
  while (fn) { if (fn.getParameters().some((p) => p.getName() === 'zhHant')) return true; fn = fn.getFirstAncestor((a) => Node.isArrowFunction(a) || Node.isFunctionDeclaration(a) || Node.isFunctionExpression(a)); }
  return false;
}
// extract CJK-bearing literal text from a branch (string / template), '' if none
function litText(n) {
  if (Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n)) return n.getLiteralValue();
  if (Node.isTemplateExpression(n)) {
    let t = n.getHead().getLiteralText();
    for (const sp of n.getTemplateSpans()) t += sp.getLiteral().getLiteralText();
    return t;
  }
  return null;
}
function category(ce, s) {
  const a = ce.getWhenTrue(), b = ce.getWhenFalse();
  const zh = s === 'zh' ? a : b;
  const isJsx = (n) => Node.isJsxElement(n) || Node.isJsxFragment(n) || Node.isJsxSelfClosingElement(n) || (Node.isParenthesizedExpression(n) && /^[\s(]*</.test(n.getText()));
  const lt = litText(zh);
  if (lt !== null) { if (!HAS_CJK.test(lt) || conv(lt) === lt) return null; return 'string'; }
  if (isJsx(a) || isJsx(b)) return 'jsx';
  return 'datapick';
}
const byFile = {};
const catTotals = {};
for (const sf of project.getSourceFiles()) {
  for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    const s = sense(ce.getCondition());
    if (!s || s === 'param') continue;
    if (covered(ce)) continue;
    const cat = category(ce, s);
    if (!cat) continue;
    const f = sf.getFilePath().replace(/.*client[\\/]/, '').replace(/\\/g, '/');
    byFile[f] ||= { jsx: 0, datapick: 0, string: 0, lines: [] };
    byFile[f][cat]++;
    byFile[f].lines.push(`${ce.getStartLineNumber()} [${cat}] ${ce.getText().slice(0, 70).replace(/\s+/g, ' ')}`);
    catTotals[cat] = (catTotals[cat] || 0) + 1;
  }
}
const files = Object.entries(byFile).sort((x, y) => (y[1].jsx + y[1].datapick + y[1].string) - (x[1].jsx + x[1].datapick + x[1].string));
let total = 0;
for (const [f, v] of files) { const n = v.jsx + v.datapick + v.string; total += n; console.log(`${String(n).padStart(3)}  ${f}  (jsx:${v.jsx} data:${v.datapick} str:${v.string})`); }
console.log(`\n=== ${total} real gaps across ${files.length} files ===`);
console.log(catTotals);
