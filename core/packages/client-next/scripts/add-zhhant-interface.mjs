#!/usr/bin/env node
// Add `zhHant?: string` to every interface / type-literal that declares a
// `zh: string` + `en: string` pair (bilingual data shape). This lets
// inject-zhhant.mjs write a zhHant field into the data literals AND lets the
// datapick-3way rewrite read `X.zhHant` without a type error. Conservative:
// only touches members whose type node is exactly `string`.
//
// Run: node scripts/add-zhhant-interface.mjs
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

function strMember(node, name) {
  const m = node.getProperty ? node.getProperty(name) : null;
  if (!m || !Node.isPropertySignature(m)) return false;
  const tn = m.getTypeNode();
  return tn && tn.getText() === 'string';
}

let added = 0; const files = new Set();
const handle = (node) => {
  if (!strMember(node, 'zh') || !strMember(node, 'en')) return;
  if (node.getProperty('zhHant')) return;
  node.addProperty({ name: 'zhHant', hasQuestionToken: true, type: 'string' });
  added++; files.add(node.getSourceFile().getFilePath());
};
for (const sf of project.getSourceFiles()) {
  for (const iface of sf.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration)) handle(iface);
  for (const tl of sf.getDescendantsOfKind(SyntaxKind.TypeLiteral)) handle(tl);
}
await project.save();
console.log(`add-zhhant-interface: added zhHant? to ${added} interfaces/type-literals across ${files.size} files`);
