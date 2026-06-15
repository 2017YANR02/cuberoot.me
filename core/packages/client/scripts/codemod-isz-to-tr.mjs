#!/usr/bin/env node
// Codemod: bare `isZh ? '中' : 'EN'` ternaries → `tr({ zh: '中', en: 'EN' })`.
//
// CONSERVATIVE & HIGH-PRECISION. Only transforms a conditional when:
//   1. The TEST is unambiguously the global UI language:
//        - i18n.language.startsWith('zh')     (true → zh)
//        - i18n.language === 'zh'  / 'zh' === i18n.language
//        - i18n.language === 'en'  / 'en' === i18n.language  (true → en, swapped)
//        - an identifier `isZh` whose const initializer in THIS file references
//          `.language` (so NOT a function parameter / prop named isZh — those
//          carry an explicit value and must keep their ternary).
//   2. BOTH branches are plain string literals (StringLiteral or a template
//      with NO substitutions). Anything dynamic / JSX / nested is skipped.
//
// Skipped sites stay as ternaries (tracked by the ratchet test) for a later
// manual pass. Correctness over coverage.
//
// Usage:
//   node scripts/codemod-isz-to-tr.mjs --dry [--dir app/[lang]/about]
//   node scripts/codemod-isz-to-tr.mjs        (apply, all scanned dirs)

import { Project, SyntaxKind, Node, QuoteKind } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // client
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
// --broad: accept `isZh` from ANY source (prop / intermediate `lang` var), not
// just a local i18n-derived const. Safe because the app has a single global UI
// language, so a prop/var named isZh always equals it. Restricted to component
// files (app/ + components/ .tsx) — never lib/ pure functions, where isZh is a
// genuine parameter and tr() (singleton-reading) could be wrong.
const BROAD = args.includes('--broad');
const dirArg = args[args.indexOf('--dir') + 1];
const SCAN = dirArg && args.includes('--dir')
  ? [dirArg]
  : BROAD
    ? ['app', 'components']
    : ['app', 'components', 'lib', 'hooks'];

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { allowJs: false },
  manipulationSettings: { quoteKind: QuoteKind.Single },
});
for (const d of SCAN) {
  // Broad mode: component files only (.tsx) — never lib-style .ts logic.
  const globs = BROAD ? [join(ROOT, d, '**/*.tsx')] : [join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')];
  project.addSourceFilesAtPaths(globs);
}

// Does this expression text read the global UI language?
const refsLanguage = (text) => /\.language\b/.test(text)
  // broad: also a local `lang` / `language` var that mirrors the global lang.
  || (BROAD && /^(lang|language|locale)$/.test(text.trim()));

// Is `isZh` (by name) a SAFE i18n-derived const in scope (not a param/prop)?
function isSafeLangIdentifier(idNode) {
  const name = idNode.getText();
  // Walk enclosing functions: a parameter named isZh shadows → unsafe.
  let fn = idNode.getFirstAncestor((a) =>
    Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) ||
    Node.isFunctionExpression(a) || Node.isMethodDeclaration(a));
  while (fn) {
    for (const p of fn.getParameters()) {
      if (p.getName() === name) return false; // it's a parameter
    }
    fn = fn.getFirstAncestor((a) =>
      Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) ||
      Node.isFunctionExpression(a) || Node.isMethodDeclaration(a));
  }
  // Look for `const isZh = <expr referencing .language>` in the same file.
  const sf = idNode.getSourceFile();
  for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    if (vd.getName() !== name) continue;
    const init = vd.getInitializer();
    if (init && refsLanguage(init.getText())) return true;
  }
  return false;
}

// Returns 'zh' | 'en' | null — which branch (whenTrue) is, for a SAFE test.
function senseOfTest(test) {
  // i18n.language.startsWith('zh')
  if (Node.isCallExpression(test)) {
    const e = test.getExpression();
    if (Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith') {
      const arg = test.getArguments()[0];
      if (arg && Node.isStringLiteral(arg) && arg.getLiteralValue() === 'zh'
        && refsLanguage(e.getExpression().getText())) return 'zh';
    }
    return null;
  }
  // X === 'zh' / 'zh' === X  (and 'en')
  if (Node.isBinaryExpression(test)) {
    const op = test.getOperatorToken().getText();
    if (op !== '===' && op !== '==') return null;
    const l = test.getLeft(), r = test.getRight();
    const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null;
    const other = lit === l ? r : l;
    if (!lit) return null;
    const v = lit.getLiteralValue();
    if ((v === 'zh' || v === 'en') && refsLanguage(other.getText())) return v;
    return null;
  }
  // isZh — strict: must be a local i18n-derived const (not a param). broad:
  // accept any `isZh` identifier (prop / intermediate var) in component files.
  if (Node.isIdentifier(test)) {
    if (test.getText() === 'isZh' && (BROAD || isSafeLangIdentifier(test))) return 'zh';
    return null;
  }
  // !isZh
  if (Node.isPrefixUnaryExpression(test) && test.getOperatorToken() === SyntaxKind.ExclamationToken) {
    const operand = test.getOperand();
    if (Node.isIdentifier(operand) && operand.getText() === 'isZh' && (BROAD || isSafeLangIdentifier(operand))) return 'en';
  }
  return null;
}

const HAS_CJK = /[㐀-鿿豈-﫿]/;

// Plain string literal (incl no-substitution template) → returns its source text,
// or null if not a plain string.
function plainStr(node) {
  if (Node.isStringLiteral(node)) return node.getText();
  if (Node.isNoSubstitutionTemplateLiteral(node)) return node.getText();
  return null;
}
function litVal(node) {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralValue();
  return null;
}

let totalChanged = 0;
const perFile = [];

for (const sf of project.getSourceFiles()) {
  const conds = sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression);
  let changed = 0;
  // Transform inner-first so replacements don't invalidate outer node refs.
  for (const ce of conds.reverse()) {
    if (ce.wasForgotten()) continue;
    const sense = senseOfTest(ce.getCondition());
    if (!sense) continue;
    const whenTrue = plainStr(ce.getWhenTrue());
    const whenFalse = plainStr(ce.getWhenFalse());
    if (whenTrue == null || whenFalse == null) continue;
    const zhNode = sense === 'zh' ? ce.getWhenTrue() : ce.getWhenFalse();
    // Only transform real UI text — the zh branch must contain a CJK char.
    // Skips locale codes / classNames / other logic ternaries.
    if (!HAS_CJK.test(litVal(zhNode) ?? '')) continue;
    const zh = sense === 'zh' ? whenTrue : whenFalse;
    const en = sense === 'zh' ? whenFalse : whenTrue;
    ce.replaceWithText(`tr({ zh: ${zh}, en: ${en} })`);
    changed++;
  }
  if (changed > 0) {
    // Ensure `import { tr } from '@/i18n/tr'`.
    const imp = sf.getImportDeclaration((d) => d.getModuleSpecifierValue() === '@/i18n/tr');
    if (imp) {
      if (!imp.getNamedImports().some((n) => n.getName() === 'tr')) imp.addNamedImport('tr');
    } else {
      sf.addImportDeclaration({ moduleSpecifier: '@/i18n/tr', namedImports: ['tr'] });
    }
    perFile.push(`${sf.getFilePath().replace(ROOT + '/', '').replace(ROOT + '\\', '')}: ${changed}`);
    totalChanged += changed;
  }
}

console.log(perFile.sort().join('\n'));
console.log(`\n${DRY ? '[DRY] would change' : 'changed'} ${totalChanged} sites in ${perFile.length} files`);
if (!DRY) await project.save();
