#!/usr/bin/env node
// Generalize the data-object zhHant machinery to the `<prefix>Zh / <prefix>En`
// naming convention (nameZh/nameEn, titleZh/titleEn, labelZh/labelEn,
// sectionTitleZh/sectionTitleEn, ...) in addition to plain zh/en. For each such
// pair this:
//   (a) adds `<prefix>ZhHant?: string` to the interface / type-literal, and
//   (b) injects `<prefix>ZhHant` = OpenCC(s2twp, <prefix>Zh value) into data
//       object literals.
// Run BEFORE codemod-datapick-generic.mjs.
//
// Run: node scripts/generic-zhhant-data.mjs
import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const conv = OpenCC.Converter({ from: 'cn', to: 'twp' });
const HAS_CJK = /[㐀-鿿豈-﫿]/;
const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

const isZhField = (n) => n === 'zh' || (n.endsWith('Zh') && n.length > 2);
const enSibling = (n) => (n === 'zh' ? 'en' : n.slice(0, -2) + 'En');
const hantField = (n) => n + 'Hant';

let ifaceAdds = 0, injects = 0; const files = new Set();

// (a) interfaces / type literals
const handleType = (node) => {
  for (const prop of node.getProperties?.() ?? []) {
    if (!Node.isPropertySignature(prop)) continue;
    const name = prop.getName();
    if (!isZhField(name)) continue;
    const tn = prop.getTypeNode();
    if (!tn || tn.getText() !== 'string') continue;
    if (!node.getProperty(enSibling(name))) continue;
    if (node.getProperty(hantField(name))) continue;
    node.addProperty({ name: hantField(name), hasQuestionToken: true, type: 'string' });
    ifaceAdds++; files.add(node.getSourceFile().getFilePath());
  }
};
for (const sf of project.getSourceFiles()) {
  for (const iface of sf.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration)) handleType(iface);
  for (const tl of sf.getDescendantsOfKind(SyntaxKind.TypeLiteral)) handleType(tl);
}

// (b) object literals
for (const sf of project.getSourceFiles()) {
  for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    for (const prop of obj.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;
      const name = prop.getName();
      if (!isZhField(name)) continue;
      if (!obj.getProperty(enSibling(name))) continue;
      const init = prop.getInitializer();
      if (!init || !(Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init))) continue;
      const v = init.getLiteralValue();
      if (!HAS_CJK.test(v)) continue;
      const trad = conv(v);
      if (trad === v) continue;
      const hn = hantField(name);
      const existing = obj.getProperty(hn);
      if (existing && Node.isPropertyAssignment(existing)) existing.setInitializer((w) => w.quote(trad));
      else obj.addPropertyAssignment({ name: hn, initializer: (w) => w.quote(trad) });
      injects++; files.add(sf.getFilePath());
    }
  }
}
await project.save();
console.log(`generic-zhhant-data: +${ifaceAdds} interface fields, ${injects} object injects, ${files.size} files`);
