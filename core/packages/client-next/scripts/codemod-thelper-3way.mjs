#!/usr/bin/env node
// Upgrade per-file string helpers `const t = (zh, en) => isZh ? zh : en` to be
// zh-Hant aware WITHOUT touching their ergonomics:
//   const t = (zh, en, zhHant) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en)
// and at every call `t('已选', 'done')` inject the Traditional 3rd arg
//   t('已选', 'done', '已選')   (OpenCC s2twp of the zh-side literal/template).
// Pure static -> hydration-clean. Non-literal zh args keep Simplified (gap).
// Matches helpers STRUCTURALLY (arrow, 2 params, body is an i18n ternary over
// those two params), so the i18next `const { t } = useTranslation()` is never hit.
//
// Run: node scripts/codemod-thelper-3way.mjs [pathSubstr ...]
import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const conv = OpenCC.Converter({ from: 'cn', to: 'twp' });
const HAS_CJK = /[㐀-鿿豈-﫿]/;
const filters = process.argv.slice(2);

const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

const refsLang = (t) => /\.language\b/.test(t);
function isSafe(id) {
  const n = id.getText();
  for (const vd of id.getSourceFile().getDescendantsOfKind(SyntaxKind.VariableDeclaration)) { if (vd.getName() === n) { const i = vd.getInitializer(); if (i && refsLang(i.getText())) return true; } }
  return false;
}
// returns 'zh' if whenTrue is the Chinese branch, 'en' if whenFalse is, else null
function sense(t) {
  if (Node.isCallExpression(t)) { const e = t.getExpression(); return (Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith' && refsLang(e.getExpression().getText())) ? 'zh' : null; }
  if (Node.isIdentifier(t) && t.getText() === 'isZh') return 'zh';
  if (Node.isPrefixUnaryExpression(t) && t.getOperatorToken() === SyntaxKind.ExclamationToken) { const o = t.getOperand(); if (Node.isIdentifier(o) && o.getText() === 'isZh') return 'en'; }
  if (Node.isBinaryExpression(t)) { const op = t.getOperatorToken().getText(); if (op !== '===' && op !== '==') return null; const l = t.getLeft(), r = t.getRight(); const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null; if (!lit) return null; const o = lit === l ? r : l; if (!refsLang(o.getText())) return null; const v = lit.getLiteralValue(); return v === 'zh' ? 'zh' : v === 'en' ? 'en' : null; }
  return null;
}

function tradArgText(arg) {
  if (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg)) {
    const v = arg.getLiteralValue();
    if (!HAS_CJK.test(v)) return null;
    const tr = conv(v);
    return tr === v ? null : JSON.stringify(tr);
  }
  if (Node.isTemplateExpression(arg)) {
    const txt = arg.getText();
    if (!HAS_CJK.test(txt)) return null;
    const tr = conv(txt);
    return tr === txt ? null : tr; // template literal, pass raw
  }
  return null;
}

let helpers = 0, calls = 0; const touched = new Set();
for (const sf of project.getSourceFiles()) {
  if (filters.length && !filters.some((f) => sf.getFilePath().includes(f))) continue;
  for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const init = vd.getInitializer();
    if (!init || !Node.isArrowFunction(init)) continue;
    const ps = init.getParameters();
    if (ps.length !== 2) continue;
    let body = init.getBody();
    if (Node.isParenthesizedExpression(body)) body = body.getExpression();
    if (!Node.isConditionalExpression(body)) continue;
    const names = ps.map((x) => x.getName());
    const wt = body.getWhenTrue().getText(), wf = body.getWhenFalse().getText();
    if (!(names.includes(wt) && names.includes(wf))) continue;
    const s = sense(body.getCondition());
    if (!s) continue;
    const zhName = s === 'zh' ? wt : wf;        // param holding the Chinese string
    const zhIdx = names.indexOf(zhName);
    const origBody = body.getText();

    // collect call sites BEFORE mutating the declaration
    const nameNode = vd.getNameNode();
    let refs = [];
    try { refs = nameNode.findReferencesAsNodes(); } catch { refs = []; }
    for (const ref of refs) {
      const parent = ref.getParent();
      if (!parent || !Node.isCallExpression(parent)) continue;
      if (parent.getExpression() !== ref) continue;
      const args = parent.getArguments();
      if (args.length !== 2) continue;
      const t3 = tradArgText(args[zhIdx]);
      if (!t3) continue;
      parent.addArgument(t3);
      calls++;
    }

    // upgrade the helper: add zhHant param + 3-way body
    init.addParameter({ name: 'zhHant', type: 'string', hasQuestionToken: true });
    init.getBody().replaceWithText(`i18n.language === 'zh-Hant' ? (zhHant ?? ${zhName}) : (${origBody})`);
    helpers++; touched.add(sf);
  }
}
for (const sf of touched) {
  const has = sf.getImportDeclarations().some((d) => d.getModuleSpecifierValue() === '@/i18n/i18n-client' && d.getDefaultImport());
  if (!has) sf.addImportDeclaration({ moduleSpecifier: '@/i18n/i18n-client', defaultImport: 'i18n' });
}
await project.save();
console.log(`thelper-3way: upgraded ${helpers} helpers, injected ${calls} call args, ${touched.size} files`);
