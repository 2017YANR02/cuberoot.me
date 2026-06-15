#!/usr/bin/env node
// Local-const field-pick closer — for `COND ? X.<field> : <enExpr>` where X is an
// iteration/element of a const whose element type is INFERRED (untyped const) or an
// inline TypeLiteral (anon `{zh,en}[]`), i.e. NOT a named interface (those go through
// fieldpick/objpick). Injection is SCOPED to the single owning const (located via the
// field's declaration -> enclosing VariableDeclaration), so there is zero cross-file /
// same-name contamination. Inline type literals get the Hant field added too.
//   -> i18n.language === 'zh-Hant' ? (X.<field>Hant ?? X.<field>) : (orig)
// Deep-convert = OpenCC the field initializer's full source text (string/array/object
// leaves convert, ASCII keys/numbers untouched). Consts with no CJK-divergent value
// are skipped (not a real gap).
import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = OpenCC.Converter({ from: 'cn', to: 'twp' });
const conv = (s) => raw(s).replace(/專案/g, '項目').replace(/開源項目/g, '開源專案');
const HAS_CJK = /[㐀-鿿豈-﫿]/;
const DIR = (process.argv[2] || '').replace(/\\/g, '/');
const project = new Project({ tsConfigFilePath: join(ROOT, 'tsconfig.json') });
const inDir = (sf) => { const f = sf.getFilePath().replace(/.*client[\\/]/, '').replace(/\\/g, '/'); return !DIR || f.startsWith(DIR); };
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
function unwrap(n) { while (n && (Node.isNonNullExpression(n) || Node.isParenthesizedExpression(n))) n = n.getExpression(); return n; }
// OpenCC the full source text of an initializer; null if no CJK-divergent change
function convText(node) {
  const t = node.getText();
  if (!HAS_CJK.test(t)) return null;
  const c = conv(t);
  return c === t ? null : c;
}

// group rewrite targets by owning const VariableDeclaration
const byConst = new Map();   // varDecl -> { field, hantField, typeLiteralProp?: PropertySignature|null, elementOwner }
const targets = [];
for (const sf of project.getSourceFiles()) {
  if (!inDir(sf)) continue;
  for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    if (ce.wasForgotten()) continue;
    const s = sense(ce.getCondition());
    if (!s || s === 'param' || covered(ce)) continue;
    const zh = unwrap(s === 'zh' ? ce.getWhenTrue() : ce.getWhenFalse());
    if (!Node.isPropertyAccessExpression(zh)) continue;
    const fieldName = zh.getName();
    const objExpr = zh.getExpression();
    let propSym; try { propSym = objExpr.getType().getNonNullableType().getProperty(fieldName); } catch { continue; }
    if (!propSym) continue;
    const decl = propSym.getDeclarations()[0];
    if (!decl) continue;
    const par = decl.getParent();
    // inferred (PropertyAssignment in an object literal) OR anon TypeLiteral — NOT named interface
    let typeLiteral = null;
    if (Node.isPropertySignature(decl) && Node.isTypeLiteral(par)) typeLiteral = par;
    else if (!Node.isPropertyAssignment(decl)) continue;        // named iface / other -> skip
    const varDecl = decl.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (!varDecl || !inDir(varDecl.getSourceFile())) continue;
    const vinit = varDecl.getInitializer();
    if (vinit && Node.isAsExpression(vinit) && vinit.getTypeNode()?.getText() === 'const') continue; // `as const` literal tuples -> handle by hand
    const hantField = fieldName + 'Hant';
    if (!byConst.has(varDecl)) byConst.set(varDecl, new Map());
    if (!byConst.get(varDecl).has(fieldName)) byConst.get(varDecl).set(fieldName, { hantField, typeLiteral });
    targets.push({ ce, objText: objExpr.getText(), zhText: zh.getText(), hantField, origText: ce.getText(), varDecl, fieldName });
  }
}

// inject into each owning const (scoped), add Hant to inline type literal, validate divergence
let injected = 0, constsTouched = 0; const liveConsts = new Set();
for (const [varDecl, fields] of byConst) {
  if (varDecl.wasForgotten()) continue;
  const init = varDecl.getInitializer();
  if (!init) continue;
  const objs = init.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
  for (const [fieldName, info] of fields) {
    // gather element objects that own this field as a direct property
    const owners = objs.filter((o) => { const p = o.getProperty(fieldName); return p && Node.isPropertyAssignment(p); });
    if (!owners.length) continue;
    // need at least one CJK-divergent value, else not a real gap
    const anyDiverge = owners.some((o) => convText(o.getProperty(fieldName).getInitializer()) !== null);
    if (!anyDiverge) continue;
    // add Hant to inline type literal (so element type stays known)
    if (info.typeLiteral && !info.typeLiteral.getProperty(info.hantField)) {
      const orig = info.typeLiteral.getProperty(fieldName);
      const tn = orig && Node.isPropertySignature(orig) ? orig.getTypeNode()?.getText() : null;
      info.typeLiteral.addProperty({ name: info.hantField, type: tn || 'string', hasQuestionToken: true });
    }
    for (const o of owners) {
      if (o.getProperty(info.hantField)) continue;
      const zhInit = o.getProperty(fieldName).getInitializer();
      const c = convText(zhInit);
      o.addPropertyAssignment({ name: info.hantField, initializer: c ?? zhInit.getText() }); // identity where homoglyph (type uniformity)
      injected++;
    }
    liveConsts.add(`${varDecl.getName()}.${fieldName}`);
  }
  constsTouched++;
}

// rewrite picks whose const+field actually got injected
let rewritten = 0; const touched = new Set();
targets.sort((a, b) => b.ce.getStart() - a.ce.getStart());
for (const t of targets) {
  if (t.ce.wasForgotten()) continue;
  if (!liveConsts.has(`${t.varDecl.getName()}.${t.fieldName}`)) continue;
  touched.add(t.ce.getSourceFile());
  t.ce.replaceWithText(`i18n.language === 'zh-Hant' ? (${t.objText}.${t.hantField} ?? ${t.zhText}) : (${t.origText})`);
  rewritten++;
}
for (const sf of touched) { const has = sf.getImportDeclarations().some((d) => d.getModuleSpecifierValue() === '@/i18n/i18n-client' && d.getDefaultImport()); if (!has) sf.addImportDeclaration({ moduleSpecifier: '@/i18n/i18n-client', defaultImport: 'i18n' }); }
await project.save();
console.log(`localconst-3way [${DIR || 'ALL'}]: ${rewritten} picks rewritten, ${injected} values injected, ${touched.size} files`);
