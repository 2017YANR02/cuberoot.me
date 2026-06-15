#!/usr/bin/env node
// Burn-down codemod (TYPE-AWARE): convert remaining global-UI-language TEXT
// ternaries (what tests/i18n-no-isz-text-ternary.test.ts counts) to canonical forms.
//
//   cond ? base.zh : base.en  (same base)                          [--member]
//        base.{zh,en}: string   →  tr(base)
//        base.{zh,en}: ReactNode, in JSX child  →  <T zh={base.zh} en={base.en} />
//        result further accessed (.title) / other non-string  →  SKIP
//   cond ? <zhJsx> : <enJsx>   (jsx branch)  →  <T zh={…} en={…} />  [--jsx]
//   cond ? '中' : 'EN'         (cjk literal) →  tr({ zh:'中', en:'EN' }) [--literal]
//
// `cond` must be unambiguously the global UI language (i18n.language.* / a local
// const isZh from .language). A function PARAMETER / prop isZh is never touched.
// tr(base) ≡ cond ? base.zh : base.en (same singleton, base evaluated once).
//
// Usage: node scripts/codemod-isz-burndown.mjs [--dry] [--member|--jsx|--literal] [--dir d]
import { Project, SyntaxKind, Node, QuoteKind } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const onlyMember = args.includes('--member'), onlyJsx = args.includes('--jsx'), onlyLiteral = args.includes('--literal');
const ALL = !onlyMember && !onlyJsx && !onlyLiteral;
const doMember = ALL || onlyMember, doJsx = ALL || onlyJsx, doLiteral = ALL || onlyLiteral;
const dirArg = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : null;

const project = new Project({
  tsConfigFilePath: join(ROOT, 'tsconfig.json'),
  manipulationSettings: { quoteKind: QuoteKind.Single },
});
const files = dirArg
  ? project.getSourceFiles().filter((f) => f.getFilePath().replace(/\\/g, '/').includes(`/${dirArg}/`))
  : project.getSourceFiles().filter((f) => /client-next[\\/](app|components|lib|hooks)[\\/]/.test(f.getFilePath()));

const HAS_CJK = /[㐀-鿿豈-﫿]/;
const refsLanguage = (t) => /\.language\b/.test(t);

function isGlobalLangIdent(id) {
  const name = id.getText();
  let fn = id.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a));
  while (fn) { for (const p of fn.getParameters()) if (p.getName() === name) return false; fn = fn.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a)); }
  for (const vd of id.getSourceFile().getDescendantsOfKind(SyntaxKind.VariableDeclaration)) { if (vd.getName() === name) { const i = vd.getInitializer(); if (i && refsLanguage(i.getText())) return true; } }
  return false;
}
function senseOfTest(test) {
  if (Node.isCallExpression(test)) { const e = test.getExpression(); return Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith' && refsLanguage(e.getExpression().getText()) ? 'zh' : null; }
  if (Node.isBinaryExpression(test)) { const op = test.getOperatorToken().getText(); if (op !== '===' && op !== '==') return null; const l = test.getLeft(), r = test.getRight(); const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null; if (!lit) return null; const o = lit === l ? r : l; const v = lit.getLiteralValue(); if (!refsLanguage(o.getText())) return null; return v === 'zh' ? 'zh' : v === 'en' ? 'en' : null; }
  if (Node.isIdentifier(test) && test.getText() === 'isZh') return isGlobalLangIdent(test) ? 'zh' : null;
  if (Node.isPrefixUnaryExpression(test) && test.getOperatorToken() === SyntaxKind.ExclamationToken) { const o = test.getOperand(); return Node.isIdentifier(o) && o.getText() === 'isZh' && isGlobalLangIdent(o) ? 'en' : null; }
  return null;
}

const isStr = (n) => Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n);
const isJsx = (n) => Node.isJsxElement(n) || Node.isJsxFragment(n) || Node.isJsxSelfClosingElement(n) || (Node.isParenthesizedExpression(n) && /^[\s(]*</.test(n.getText()));
const endsWith = (n, k) => Node.isPropertyAccessExpression(n) && n.getName() === k;
function unwrapParent(ce) { let p = ce.getParent(); while (p && Node.isParenthesizedExpression(p)) p = p.getParent(); return p; }
function resultIsAccessed(ce) { const p = unwrapParent(ce); return !!p && (Node.isPropertyAccessExpression(p) || Node.isElementAccessExpression(p) || Node.isCallExpression(p)); }

const need = { tr: new Set(), T: new Set() };
let changed = 0; const perFile = {};
const bump = (sf) => { const f = sf.getFilePath().replace(/.*client-next[\\/]/, ''); perFile[f] = (perFile[f] || 0) + 1; changed++; };

for (const sf of files) {
  for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression).reverse()) {
    if (ce.wasForgotten()) continue;
    const sense = senseOfTest(ce.getCondition());
    if (!sense) continue;
    const a = ce.getWhenTrue(), b = ce.getWhenFalse();
    const zh = sense === 'zh' ? a : b, en = sense === 'zh' ? b : a;

    if (isStr(a) && isStr(b)) {
      const v = zh.getLiteralValue?.() ?? '';
      if (!HAS_CJK.test(v) || !doLiteral) continue;
      ce.replaceWithText(`tr({ zh: ${zh.getText()}, en: ${en.getText()} })`); need.tr.add(sf); bump(sf); continue;
    }
    if (isJsx(a) || isJsx(b)) {
      if (!doJsx || resultIsAccessed(ce)) continue;
      ce.replaceWithText(`<T zh={${zh.getText()}} en={${en.getText()}} />`); need.T.add(sf); bump(sf); continue;
    }
    if (doMember && endsWith(zh, 'zh') && endsWith(en, 'en')) {
      const baseZh = zh.getExpression().getText(), baseEn = en.getExpression().getText();
      if (baseZh !== baseEn) continue; // a.zh : b.en — different base, leave
      // generic tr<T>(base) selects the localized value of any type; valid in any
      // position incl. `tr(base).title` (parses as (tr(base)).title).
      ce.replaceWithText(`tr(${baseZh})`); need.tr.add(sf); bump(sf); continue;
    }
  }
}

const ensure = (sf, names) => {
  const imp = sf.getImportDeclaration((d) => d.getModuleSpecifierValue() === '@/i18n/tr');
  if (imp) { for (const n of names) if (!imp.getNamedImports().some((x) => x.getName() === n)) imp.addNamedImport(n); }
  else sf.addImportDeclaration({ moduleSpecifier: '@/i18n/tr', namedImports: [...names] });
};
for (const sf of new Set([...need.tr, ...need.T])) { const names = []; if (need.tr.has(sf)) names.push('tr'); if (need.T.has(sf)) names.push('T'); ensure(sf, names); }

console.log(Object.entries(perFile).sort().map(([f, n]) => `${n}\t${f}`).join('\n'));
console.log(`\n${DRY ? '[DRY] would change' : 'changed'} ${changed} sites in ${Object.keys(perFile).length} files`);
if (!DRY) await project.save();
