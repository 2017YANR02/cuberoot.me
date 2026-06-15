#!/usr/bin/env node
// Post-burndown cleanup: after migrating UI-language text ternaries to tr()/<T>,
// a file's `const isZh = i18n.language.startsWith('zh')` can become dead. Remove
// such a statement when `isZh` has no remaining usage in the file.
//
// PURELY SYNTACTIC per file (no language service — findReferences proved flaky
// when mutating mid-scan). Counts Identifier nodes named `isZh` that are not the
// declaration's own name and not a property-access name. Conservative: if ANY
// other isZh identifier remains (incl. a param named isZh elsewhere in the file),
// the const is kept. Only touches a `const isZh = <…​.language…>` (global UI lang),
// never a prop/param, and only when the file has exactly one such const.
//
// Usage: node scripts/cleanup-orphan-isz.mjs [--dry]
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);

const refsLanguage = (t) => /\.language\b/.test(t);
const isPropName = (id) => { const p = id.getParent(); return Node.isPropertyAccessExpression(p) && p.getNameNode() === id; };

const usageCount = (sf, name) => sf.getDescendantsOfKind(SyntaxKind.Identifier).filter((id) => id.getText() === name && !isPropName(id)).length;

let removed = 0; const touched = [];
for (const sf of project.getSourceFiles()) {
  // candidate global-lang isZh consts (single-declaration statements)
  const decls = sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration).filter((vd) => {
    if (vd.getName() !== 'isZh') return false;
    const init = vd.getInitializer();
    return !!init && refsLanguage(init.getText());
  });
  if (decls.length !== 1) continue; // 0 or ambiguous → skip
  const decl = decls[0];
  const declName = decl.getNameNode();
  const usages = sf.getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((id) => id.getText() === 'isZh' && id !== declName && !isPropName(id));
  if (usages.length > 0) continue; // still used somewhere → keep
  const stmt = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  if (stmt && stmt.getDeclarations().length === 1) { stmt.remove(); removed++; touched.push(sf.getFilePath().replace(/.*client-next[\\/]/, '')); }
}

// Phase 2: orphaned `i18n` from `const { …, i18n } = useTranslation()` (now unused
// after isZh removal). `i18n` is a specific name (no false-positive collisions);
// `t` is left untouched (common identifier). If the destructure empties out, drop
// the statement and the now-unused useTranslation import.
let i18nRemoved = 0;
for (const sf of project.getSourceFiles()) {
  if (usageCount(sf, 'i18n') > 1) continue; // i18n still used → skip file
  for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const init = vd.getInitializer();
    if (!init || !/useTranslation\(/.test(init.getText())) continue;
    const nb = vd.getNameNode();
    if (!Node.isObjectBindingPattern(nb)) continue;
    const els = nb.getElements();
    if (!els.some((e) => e.getName() === 'i18n')) continue;
    const kept = els.filter((e) => e.getName() !== 'i18n');
    if (kept.length === 0) {
      const stmt = vd.getFirstAncestorByKind(SyntaxKind.VariableStatement);
      if (stmt && stmt.getDeclarations().length === 1) { stmt.remove(); i18nRemoved++; }
    } else {
      nb.replaceWithText(`{ ${kept.map((e) => e.getText()).join(', ')} }`);
      i18nRemoved++;
    }
  }
  // drop now-unused `useTranslation` import
  if (usageCount(sf, 'useTranslation') <= 1) {
    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getNamedImports().find((n) => n.getName() === 'useTranslation');
      if (!spec) continue;
      spec.remove();
      if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) imp.remove();
    }
  }
}

// Phase 3: strip redundant parens left by the migration —
//   around `tr(...)` calls:  `(((tr(c)))).title` → `tr(c).title`, `return (tr(o))` → `return tr(o)`
//   around JSX in `{}`:       `{(<T .../>)}` → `{<T .../>}`, `zh={(<>…</>)}` → `zh={<>…</>}`
// Both are always safe: a call / a JSX element inside a JsxExpression never needs wrapping parens.
const unwrapAll = (n) => { let x = n; while (Node.isParenthesizedExpression(x)) x = x.getExpression(); return x; };
const isJsxNode = (n) => Node.isJsxElement(n) || Node.isJsxSelfClosingElement(n) || Node.isJsxFragment(n);
let parens = 0;
for (const sf of project.getSourceFiles()) {
  for (const par of sf.getDescendantsOfKind(SyntaxKind.ParenthesizedExpression).reverse()) {
    if (par.wasForgotten()) continue;
    if (Node.isParenthesizedExpression(par.getParent())) continue; // let the outermost handle nesting
    const inner = unwrapAll(par);
    if (Node.isCallExpression(inner) && inner.getExpression().getText() === 'tr') { par.replaceWithText(inner.getText()); parens++; }
    else if (isJsxNode(inner) && Node.isJsxExpression(par.getParent())) { par.replaceWithText(inner.getText()); parens++; }
  }
}

console.log(`orphaned isZh consts removed: ${removed} in ${touched.length} files; orphaned i18n bindings removed: ${i18nRemoved}; redundant tr() parens stripped: ${parens}`);
console.log(touched.sort().join('\n'));
if (!DRY) await project.save();
