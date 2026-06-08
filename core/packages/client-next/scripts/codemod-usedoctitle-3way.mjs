#!/usr/bin/env node
// Make the useDocumentTitle(zh, en) hook zh-Hant aware: add an optional 3rd
// arg and inject the Traditional title at every literal call site.
//   useDocumentTitle('关于', 'About')  ->  useDocumentTitle('关于', 'About', '關於')
// The hook resolves i18n.language === 'zh-Hant' ? (zhHant ?? zh) : isZh ? zh : en.
//
// Run: node scripts/codemod-usedoctitle-3way.mjs
import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const conv = OpenCC.Converter({ from: 'cn', to: 'twp' });
const HAS_CJK = /[㐀-鿿豈-﫿]/;
const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

// 1) upgrade the hook definition
const hookSf = project.getSourceFile((s) => s.getFilePath().endsWith('hooks/useDocumentTitle.ts'));
if (hookSf) {
  const fn = hookSf.getFunction('useDocumentTitle');
  if (fn && fn.getParameters().length === 2) {
    fn.addParameter({ name: 'zhHant', type: 'string', hasQuestionToken: true });
    for (const ce of fn.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
      const t = ce.getCondition().getText();
      if (t === 'isZh' && ce.getWhenTrue().getText() === 'zh' && ce.getWhenFalse().getText() === 'en') {
        ce.replaceWithText("i18n.language === 'zh-Hant' ? (zhHant ?? zh) : isZh ? zh : en");
      }
    }
    // i18n is the hook-local from useTranslation(); ensure it's destructured (it is)
  }
}

// 2) inject 3rd arg at call sites
let calls = 0; const touched = new Set();
for (const sf of project.getSourceFiles()) {
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getText() !== 'useDocumentTitle') continue;
    const args = call.getArguments();
    if (args.length !== 2) continue;
    const a = args[0];
    if (!(Node.isStringLiteral(a) || Node.isNoSubstitutionTemplateLiteral(a))) continue;
    const v = a.getLiteralValue();
    if (!HAS_CJK.test(v)) continue;
    const tr = conv(v);
    if (tr === v) continue;
    call.addArgument(JSON.stringify(tr));
    calls++; touched.add(sf);
  }
}
await project.save();
console.log(`usedoctitle-3way: upgraded hook + injected ${calls} call args across ${touched.size} files`);
