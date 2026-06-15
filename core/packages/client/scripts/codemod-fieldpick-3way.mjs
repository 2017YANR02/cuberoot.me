#!/usr/bin/env node
// Type-aware field-pick 3-way closer.
// Rewrites `COND ? X.<zhField> : <enExpr>` (zh side a string|string[] property) to
//   i18n.language === 'zh-Hant' ? (X.<zhField>Hant ?? X.<zhField>) : (orig)
// adding `<zhField>Hant?: <T>` to the FIELD'S declared interface/type FIRST (so no
// TS2353 excess-property landmine), then injecting OpenCC values into every object
// literal contextually typed as that interface. 简繁同形 fields are skipped.
// Restrict scope with a dir prefix arg:  node scripts/codemod-fieldpick-3way.mjs "app/[lang]/wca/prediction"
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
// unwrap X! / (X) to the inner PropertyAccess/ElementAccess
function unwrapAccess(n) {
  while (n && (Node.isNonNullExpression(n) || Node.isParenthesizedExpression(n))) n = n.getExpression();
  return n;
}
// OpenCC a string|array-of-strings initializer -> replacement source text, or null if no real change
function convInitText(node) {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    const v = node.getLiteralValue(); if (!HAS_CJK.test(v)) return null; const t = conv(v); if (t === v) return null; return JSON.stringify(t);
  }
  if (Node.isArrayLiteralExpression(node)) {
    const els = node.getElements(); if (!els.length) return null;
    if (!els.every((e) => Node.isStringLiteral(e) || Node.isNoSubstitutionTemplateLiteral(e))) return null;
    let any = false; const parts = els.map((e) => { const v = e.getLiteralValue(); const t = HAS_CJK.test(v) ? conv(v) : v; if (t !== v) any = true; return JSON.stringify(t); });
    if (!any) return null; return '[' + parts.join(', ') + ']';
  }
  return null;
}
const isStringy = (ty) => { if (ty.isString() || ty.isStringLiteral()) return true; if (ty.isArray()) { const e = ty.getArrayElementType(); return !!e && (e.isString() || e.isStringLiteral()); } if (ty.isUnion()) return ty.getUnionTypes().every((u) => u.isString() || u.isStringLiteral() || u.isUndefined() || (u.isArray() && (u.getArrayElementType()?.isString() || u.getArrayElementType()?.isStringLiteral()))); return false; };

// Pass 1: collect rewrite targets + the interfaces/fields needing a Hant sibling
const targets = [];                 // {ce, objText, zhText, hantField, origText}
const ifaceFields = new Map();      // interfaceDecl -> Map(hantField -> typeText)
const ifaceZhHant = new Map();      // interfaceDecl NODE -> Map(zhField -> hantField) — identity match, no same-name collision
for (const sf of project.getSourceFiles()) {
  if (!inDir(sf)) continue;
  for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    if (ce.wasForgotten()) continue;
    const s = sense(ce.getCondition());
    if (!s || s === 'param' || covered(ce)) continue;
    const zhRaw = s === 'zh' ? ce.getWhenTrue() : ce.getWhenFalse();
    const zh = unwrapAccess(zhRaw);
    if (!(Node.isPropertyAccessExpression(zh))) continue;        // only clean X.field
    const fieldName = zh.getName();
    const objExpr = zh.getExpression();
    let ty; try { ty = zh.getType(); } catch { continue; }
    if (!isStringy(ty)) continue;
    const objTy = objExpr.getType();
    const propSym = objTy.getProperty(fieldName) || objTy.getNonNullableType().getProperty(fieldName);
    if (!propSym) continue;
    const decl = propSym.getDeclarations()[0];
    if (!decl || !(Node.isPropertySignature(decl) || Node.isPropertyAssignment(decl))) continue;
    const ifaceDecl = decl.getParent();
    if (!Node.isInterfaceDeclaration(ifaceDecl)) continue;        // NAMED interfaces only (anon __type cross-contaminates)
    if (!inDir(ifaceDecl.getSourceFile())) continue;             // don't touch out-of-scope types
    const hantField = fieldName + 'Hant';
    let typeText = 'string';
    if (Node.isPropertySignature(decl)) { const tn = decl.getTypeNode(); if (tn) typeText = tn.getText().replace(/\s*\|\s*undefined/g, ''); }
    if (!ifaceFields.has(ifaceDecl)) ifaceFields.set(ifaceDecl, new Map());
    ifaceFields.get(ifaceDecl).set(hantField, typeText);
    if (!ifaceZhHant.has(ifaceDecl)) ifaceZhHant.set(ifaceDecl, new Map());
    ifaceZhHant.get(ifaceDecl).set(fieldName, hantField);
    targets.push({ ce, objText: objExpr.getText(), zhText: zh.getText(), hantField, origText: ce.getText() });
  }
}

// Pass 2: add Hant fields to interfaces
let ifaceAdded = 0;
for (const [ifaceDecl, fields] of ifaceFields) {
  for (const [name, typeText] of fields) {
    if (ifaceDecl.getProperty && ifaceDecl.getProperty(name)) continue;
    ifaceDecl.addProperty({ name, type: typeText, hasQuestionToken: true });
    ifaceAdded++;
  }
}

// Pass 3: inject OpenCC values into object literals contextually typed as those interfaces
let injected = 0;
for (const sf of project.getSourceFiles()) {
  if (!inDir(sf)) continue;
  for (const ol of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    if (ol.wasForgotten()) continue;
    let ifaceDecl = null;
    try { ifaceDecl = (ol.getContextualType()?.getNonNullableType()?.getSymbol()?.getDeclarations() || []).find((d) => Node.isInterfaceDeclaration(d)) || null; } catch { ifaceDecl = null; }
    const fieldMap = ifaceDecl && ifaceZhHant.get(ifaceDecl);
    if (!fieldMap) continue;
    for (const [zhName, hantName] of fieldMap) {
      const zhp = ol.getProperty(zhName);
      if (!zhp || !Node.isPropertyAssignment(zhp)) continue;
      if (ol.getProperty(hantName)) continue;
      const repl = convInitText(zhp.getInitializer());
      if (repl === null) continue;
      ol.addPropertyAssignment({ name: hantName, initializer: repl });
      injected++;
    }
  }
}

// Pass 4: rewrite the picks (deepest-first so nested nodes don't invalidate)
let rewritten = 0; const touched = new Set();
targets.sort((a, b) => b.ce.getStart() - a.ce.getStart());
for (const t of targets) {
  if (t.ce.wasForgotten()) continue;
  touched.add(t.ce.getSourceFile());
  t.ce.replaceWithText(`i18n.language === 'zh-Hant' ? (${t.objText}.${t.hantField} ?? ${t.zhText}) : (${t.origText})`);
  rewritten++;
}
for (const sf of touched) {
  const has = sf.getImportDeclarations().some((d) => d.getModuleSpecifierValue() === '@/i18n/i18n-client' && d.getDefaultImport());
  if (!has) sf.addImportDeclaration({ moduleSpecifier: '@/i18n/i18n-client', defaultImport: 'i18n' });
}
await project.save();
console.log(`fieldpick-3way [${DIR || 'ALL'}]: ${rewritten} picks rewritten, ${ifaceAdded} iface fields added, ${injected} values injected, ${touched.size} files`);
