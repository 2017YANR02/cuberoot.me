#!/usr/bin/env node
// Type-gated 3-way for dataPick ternaries `COND ? X.zh : X.en` ->
//   i18n.language === 'zh-Hant' ? (X.zhHant ?? X.zh) : (COND ? X.zh : X.en)
// Loads the real tsconfig so it ONLY fires when X.zh / X.en are genuinely
// `string` AND X's type carries a `zhHant` member (added by
// add-zhhant-interface.mjs). This avoids the earlier nested-object false
// positives (where X.zh was itself an object). The zhHant VALUE is filled by
// inject-zhhant.mjs. Pure static, hydration-clean.
//
// Pipeline: add-zhhant-interface -> inject-zhhant -> THIS.
// Run: node scripts/codemod-datapick-3way.mjs
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const project = new Project({ tsConfigFilePath: join(ROOT, 'tsconfig.json') });

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

let changed = 0; const touched = new Set(); let skipNoType = 0;
for (const sf of project.getSourceFiles()) {
  if (!/[\\/](app|components|lib|hooks)[\\/]/.test(sf.getFilePath())) continue;
  for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression).reverse()) {
    if (ce.wasForgotten()) continue;
    const s = sense(ce.getCondition());
    if (!s || covered(ce)) continue;
    const a = ce.getWhenTrue(), b = ce.getWhenFalse();
    const zhN = s === 'zh' ? a : b, enN = s === 'zh' ? b : a;
    if (!Node.isPropertyAccessExpression(zhN) || !Node.isPropertyAccessExpression(enN)) continue;
    if (zhN.getName() !== 'zh' || enN.getName() !== 'en') continue;
    const base = zhN.getExpression();
    if (enN.getExpression().getText() !== base.getText()) continue;
    if (!isPureBase(base)) continue;                       // avoid double-eval of side effects
    try {
      if (!zhN.getType().isString() || !enN.getType().isString()) continue;
      if (!base.getType().getProperty('zhHant')) { skipNoType++; continue; }
    } catch { continue; }
    const orig = ce.getText();
    ce.replaceWithText(`i18n.language === 'zh-Hant' ? (${base.getText()}.zhHant ?? ${zhN.getText()}) : (${orig})`);
    changed++; touched.add(sf);
  }
}
for (const sf of touched) {
  const has = sf.getImportDeclarations().some((d) => d.getModuleSpecifierValue() === '@/i18n/i18n-client' && d.getDefaultImport());
  if (!has) sf.addImportDeclaration({ moduleSpecifier: '@/i18n/i18n-client', defaultImport: 'i18n' });
}
await project.save();
console.log(`datapick-3way: rewrote ${changed} ternaries across ${touched.size} files (skipped ${skipNoType} with no zhHant type)`);
