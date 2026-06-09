#!/usr/bin/env node
// Object-valued field-pick closer (sibling of fieldpick, for X.<field> whose type
// is an OBJECT, e.g. card.zh = { title, desc }).
//   COND ? X.<field> : <enExpr>   ->   i18n.language==='zh-Hant' ? (X.<field>Hant ?? X.<field>) : (orig)
// Adds `<field>Hant?: <objType>` to the field's NAMED interface FIRST (no TS2353),
// then injects `<field>Hant: <deep-OpenCC of the object literal>` into every instance
// contextually typed as that interface. Deep-convert = OpenCC the object literal text
// (string leaves convert, ASCII keys/numbers untouched). 简繁同形 instances skipped.
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
const inDir = (sf) => { const f = sf.getFilePath().replace(/.*client-next[\\/]/, '').replace(/\\/g, '/'); return !DIR || f.startsWith(DIR); };
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

const targets = [];
const ifaceFields = new Map();
const ifaceZhHant = new Map();   // interfaceDecl NODE -> Map(zhField -> hantField)
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
    let ty; try { ty = zh.getType().getNonNullableType(); } catch { continue; }
    if (!ty.isObject() || ty.isArray()) continue;               // OBJECT-valued only (fieldpick handles string/array)
    if (ty.getProperties().length === 0) continue;
    const propSym = objExpr.getType().getNonNullableType().getProperty(fieldName);
    if (!propSym) continue;
    const decl = propSym.getDeclarations()[0];
    if (!decl || !Node.isPropertySignature(decl)) continue;
    const ifaceDecl = decl.getParent();
    if (!Node.isInterfaceDeclaration(ifaceDecl)) continue;
    if (!inDir(ifaceDecl.getSourceFile())) continue;
    const tn = decl.getTypeNode(); if (!tn) continue;
    const typeText = tn.getText().replace(/\s*\|\s*undefined/g, '');
    const hantField = fieldName + 'Hant';
    if (!ifaceFields.has(ifaceDecl)) ifaceFields.set(ifaceDecl, new Map());
    ifaceFields.get(ifaceDecl).set(hantField, typeText);
    if (!ifaceZhHant.has(ifaceDecl)) ifaceZhHant.set(ifaceDecl, new Map());
    ifaceZhHant.get(ifaceDecl).set(fieldName, hantField);
    targets.push({ ce, objText: objExpr.getText(), zhText: zh.getText(), hantField, origText: ce.getText() });
  }
}
let ifaceAdded = 0;
for (const [ifaceDecl, fields] of ifaceFields) for (const [name, typeText] of fields) { if (ifaceDecl.getProperty(name)) continue; ifaceDecl.addProperty({ name, type: typeText, hasQuestionToken: true }); ifaceAdded++; }

let injected = 0;
for (const sf of project.getSourceFiles()) {
  if (!inDir(sf)) continue;
  for (const ol of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    if (ol.wasForgotten()) continue;
    let ifaceDecl = null; try { ifaceDecl = (ol.getContextualType()?.getNonNullableType()?.getSymbol()?.getDeclarations() || []).find((d) => Node.isInterfaceDeclaration(d)) || null; } catch { ifaceDecl = null; }
    const fieldMap = ifaceDecl && ifaceZhHant.get(ifaceDecl);
    if (!fieldMap) continue;
    for (const [zhName, hantName] of fieldMap) {
      const zhp = ol.getProperty(zhName);
      if (!zhp || !Node.isPropertyAssignment(zhp)) continue;
      if (ol.getProperty(hantName)) continue;
      const init = zhp.getInitializer();
      if (!init || !Node.isObjectLiteralExpression(init)) continue;
      const txt = init.getText();
      if (!HAS_CJK.test(txt)) continue;
      const trad = conv(txt);
      if (trad === txt) continue;
      ol.addPropertyAssignment({ name: hantName, initializer: trad });
      injected++;
    }
  }
}
let rewritten = 0; const touched = new Set();
targets.sort((a, b) => b.ce.getStart() - a.ce.getStart());
for (const t of targets) { if (t.ce.wasForgotten()) continue; touched.add(t.ce.getSourceFile()); t.ce.replaceWithText(`i18n.language === 'zh-Hant' ? (${t.objText}.${t.hantField} ?? ${t.zhText}) : (${t.origText})`); rewritten++; }
for (const sf of touched) { const has = sf.getImportDeclarations().some((d) => d.getModuleSpecifierValue() === '@/i18n/i18n-client' && d.getDefaultImport()); if (!has) sf.addImportDeclaration({ moduleSpecifier: '@/i18n/i18n-client', defaultImport: 'i18n' }); }
await project.save();
console.log(`objpick-3way [${DIR || 'ALL'}]: ${rewritten} picks rewritten, ${ifaceAdded} iface fields added, ${injected} objects injected, ${touched.size} files`);
