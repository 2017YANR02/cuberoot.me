#!/usr/bin/env node
// Close whole-const / parallel-map language pickers:
//   isZh ? X_ZH : X_EN          (X_ZH a const array/object of Chinese strings)
//   X_ZH[k] : X_EN[k]           (parallel maps)
// For each, generate a Traditional sibling `const X_ZH__Hant = <OpenCC(X_ZH)>`
// next to X_ZH (same file only — imported consts are skipped) and rewrite the
// pick to a 3-way:
//   i18n.language === 'zh-Hant' ? X_ZH__Hant      : (orig)
//   i18n.language === 'zh-Hant' ? X_ZH__Hant[k]   : (orig)
//
// Run: node scripts/codemod-constmap-3way.mjs
import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const conv = OpenCC.Converter({ from: 'cn', to: 'twp' });
const HAS_CJK = /[㐀-鿿豈-﫿]/;
const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

const refsLang = (t) => /\.language\b/.test(t);
function sense(t) {
  if (Node.isCallExpression(t)) { const e = t.getExpression(); return (Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith' && refsLang(e.getExpression().getText())) ? 'zh' : null; }
  if (Node.isIdentifier(t) && t.getText() === 'isZh') return 'zh';
  if (Node.isPrefixUnaryExpression(t) && t.getOperatorToken() === SyntaxKind.ExclamationToken) { const o = t.getOperand(); if (Node.isIdentifier(o) && o.getText() === 'isZh') return 'en'; }
  if (Node.isBinaryExpression(t)) { const op = t.getOperatorToken().getText(); if (op !== '===' && op !== '==') return null; const l = t.getLeft(), r = t.getRight(); const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null; if (!lit) return null; const o = lit === l ? r : l; if (!refsLang(o.getText())) return null; const v = lit.getLiteralValue(); return v === 'zh' ? 'zh' : v === 'en' ? 'en' : null; }
  return null;
}
function covered(ce) { let up = ce.getParent(); while (up && Node.isParenthesizedExpression(up)) up = up.getParent(); if (up && Node.isConditionalExpression(up) && /zh-Hant/.test(up.getCondition().getText())) return true; let par = ce.getParent(); if (Node.isParenthesizedExpression(par)) par = par.getParent(); if (Node.isArrowFunction(par) && par.getParameters().some((x) => x.getName() === 'zhHant')) return true; return false; }

// returns the zh-side identifier node + index suffix text ('' or '[k]') if this
// is a whole-const or parallel-map picker, else null
function pickerParts(ce, s) {
  const zhB = s === 'zh' ? ce.getWhenTrue() : ce.getWhenFalse();
  const enB = s === 'zh' ? ce.getWhenFalse() : ce.getWhenTrue();
  if (Node.isIdentifier(zhB) && Node.isIdentifier(enB)) return { id: zhB, suffix: '' };
  if (Node.isElementAccessExpression(zhB) && Node.isElementAccessExpression(enB)) {
    const ze = zhB.getExpression(), ee = enB.getExpression();
    if (Node.isIdentifier(ze) && Node.isIdentifier(ee) && zhB.getArgumentExpression()?.getText() === enB.getArgumentExpression()?.getText()) {
      return { id: ze, suffix: `[${zhB.getArgumentExpression().getText()}]` };
    }
  }
  return null;
}

let changed = 0, gen = 0; const touched = new Set();
for (const sf of project.getSourceFiles()) {
  const edits = [];
  for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    if (ce.wasForgotten()) continue;
    const s = sense(ce.getCondition());
    if (!s || covered(ce)) continue;
    const parts = pickerParts(ce, s);
    if (!parts) continue;
    const decl = sf.getVariableDeclaration(parts.id.getText());   // same-file only
    if (!decl) continue;
    let init = decl.getInitializer();
    while (init && Node.isAsExpression(init)) init = init.getExpression(); // unwrap `as const`
    if (!init || !(Node.isArrayLiteralExpression(init) || Node.isObjectLiteralExpression(init))) continue;
    init = decl.getInitializer(); // keep the full text (incl. `as const`) for the clone
    const initText = init.getText();
    if (!HAS_CJK.test(initText)) continue;
    const hantInit = conv(initText);
    if (hantInit === initText) continue;
    const hantName = parts.id.getText() + '__Hant';
    edits.push({ ce, hantName, suffix: parts.suffix, declName: parts.id.getText(), hantInit });
  }
  if (!edits.length) continue;
  // generate the __Hant consts once per distinct name
  const seen = new Set();
  for (const e of edits) {
    if (seen.has(e.hantName)) continue;
    seen.add(e.hantName);
    if (sf.getVariableDeclaration(e.hantName)) continue;
    const decl = sf.getVariableDeclaration(e.declName);
    const stmt = decl.getVariableStatement();
    const typeNode = decl.getTypeNode();                          // preserve index signature etc.
    const ann = typeNode ? `: ${typeNode.getText()}` : '';
    stmt.replaceWithText(stmt.getText() + `\nconst ${e.hantName}${ann} = ${e.hantInit};`);
    gen++;
  }
  for (const e of edits) {
    if (e.ce.wasForgotten()) continue;
    const orig = e.ce.getText();
    e.ce.replaceWithText(`i18n.language === 'zh-Hant' ? ${e.hantName}${e.suffix} : (${orig})`);
    changed++;
  }
  touched.add(sf);
}
for (const sf of touched) {
  const has = sf.getImportDeclarations().some((d) => d.getModuleSpecifierValue() === '@/i18n/i18n-client' && d.getDefaultImport());
  if (!has) sf.addImportDeclaration({ moduleSpecifier: '@/i18n/i18n-client', defaultImport: 'i18n' });
}
await project.save();
console.log(`constmap-3way: ${changed} picks rewritten, ${gen} __Hant consts generated, ${touched.size} files`);
