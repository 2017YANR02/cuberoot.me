#!/usr/bin/env node
// Final robust closer for dataPick `COND ? X.<p>Zh : X.<p>En` that the
// type-gated pass couldn't reach (explicit interfaces it missed, imported /
// API-sourced types). Uses an inline structural cast so it needs NO type
// reachability:
//   i18n.language === 'zh-Hant'
//     ? ((X as { <p>ZhHant?: string }).<p>ZhHant ?? X.<p>Zh)
//     : (COND ? X.<p>Zh : X.<p>En)
// The Traditional VALUE was already injected into the data literals by
// generic-zhhant-data.mjs; the cast just exposes it to the type system. For
// runtime-only data with no injected field (e.g. API responses), `<p>ZhHant`
// is undefined and it falls back to Simplified — safe, no error.
//
// Run AFTER generic-zhhant-data.mjs. Run: node scripts/codemod-datapick-cast.mjs
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Type info needed: only fire when X.<p>Zh / X.<p>En are genuinely `string`
// (skips nested-object .zh/.en). The cast is just to expose the injected hant
// field regardless of interface reachability.
const project = new Project({ tsConfigFilePath: join(ROOT, 'tsconfig.json') });

const isZhField = (n) => n === 'zh' || (n.endsWith('Zh') && n.length > 2);
const enSibling = (n) => (n === 'zh' ? 'en' : n.slice(0, -2) + 'En');
const hantField = (n) => n + 'Hant';
const refsLang = (t) => /\.language\b/.test(t);
function sense(t) {
  if (Node.isCallExpression(t)) { const e = t.getExpression(); return (Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith' && refsLang(e.getExpression().getText())) ? 'zh' : null; }
  if (Node.isIdentifier(t) && t.getText() === 'isZh') return 'zh';
  if (Node.isPrefixUnaryExpression(t) && t.getOperatorToken() === SyntaxKind.ExclamationToken) { const o = t.getOperand(); if (Node.isIdentifier(o) && o.getText() === 'isZh') return 'en'; }
  if (Node.isBinaryExpression(t)) { const op = t.getOperatorToken().getText(); if (op !== '===' && op !== '==') return null; const l = t.getLeft(), r = t.getRight(); const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null; if (!lit) return null; const o = lit === l ? r : l; if (!refsLang(o.getText())) return null; const v = lit.getLiteralValue(); return v === 'zh' ? 'zh' : v === 'en' ? 'en' : null; }
  return null;
}
function covered(ce) { let up = ce.getParent(); while (up && Node.isParenthesizedExpression(up)) up = up.getParent(); if (up && Node.isConditionalExpression(up) && /zh-Hant/.test(up.getCondition().getText())) return true; let par = ce.getParent(); if (Node.isParenthesizedExpression(par)) par = par.getParent(); if (Node.isArrowFunction(par) && par.getParameters().some((x) => x.getName() === 'zhHant')) return true; return false; }
const isPureBase = (n) => Node.isPropertyAccessExpression(n) || Node.isElementAccessExpression(n) || Node.isIdentifier(n);

let changed = 0; const touched = new Set();
for (const sf of project.getSourceFiles()) {
  if (!/[\\/](app|components|lib|hooks)[\\/]/.test(sf.getFilePath())) continue;
  for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression).reverse()) {
    if (ce.wasForgotten()) continue;
    const s = sense(ce.getCondition());
    if (!s || covered(ce)) continue;
    const a = ce.getWhenTrue(), b = ce.getWhenFalse();
    const zhN = s === 'zh' ? a : b, enN = s === 'zh' ? b : a;
    if (!Node.isPropertyAccessExpression(zhN) || !Node.isPropertyAccessExpression(enN)) continue;
    const zf = zhN.getName(), ef = enN.getName();
    if (!isZhField(zf) || ef !== enSibling(zf)) continue;
    const base = zhN.getExpression();
    if (enN.getExpression().getText() !== base.getText() || !isPureBase(base)) continue;
    try { if (!zhN.getType().isString() || !enN.getType().isString()) continue; } catch { continue; }
    const hn = hantField(zf);
    const orig = ce.getText();
    ce.replaceWithText(`i18n.language === 'zh-Hant' ? ((${base.getText()} as { ${hn}?: string }).${hn} ?? ${zhN.getText()}) : (${orig})`);
    changed++; touched.add(sf);
  }
}
for (const sf of touched) {
  const has = sf.getImportDeclarations().some((d) => d.getModuleSpecifierValue() === '@/i18n/i18n-client' && d.getDefaultImport());
  if (!has) sf.addImportDeclaration({ moduleSpecifier: '@/i18n/i18n-client', defaultImport: 'i18n' });
}
await project.save();
console.log(`datapick-cast: rewrote ${changed} ternaries across ${touched.size} files`);
