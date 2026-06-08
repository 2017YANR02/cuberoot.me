#!/usr/bin/env node
// Build-time zhHant injection. For every tr({ zh: '<literal>', en }) call, add
// (or refresh) a `zhHant` field = OpenCC(zh, s2twp). This makes tr() a PURE,
// STATIC resolver (m.zhHant ?? m.zh) — no runtime OpenCC, no async, no hydration
// gate, so SSR and client render identical Traditional text (zero mismatch, zero
// flash). The zhHant strings live next to their component, so they're code-split
// per route rather than shipped as one site-wide blob.
//
// Idempotent: re-run after editing zh strings to keep zhHant in sync (it's a
// translation-refresh step, like updating a catalog). Only literal/no-sub-string
// `zh:` values are handled; dynamic tr({ zh: expr }) keep Simplified on zh-Hant.
//
// Run: node scripts/inject-zhhant.mjs

import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = OpenCC.Converter({ from: 'cn', to: 'twp' });
// 项目 (cube event) -> 項目, not s2twp's 專案 (software project). Keep 開源專案.
const conv = (s) => raw(s).replace(/專案/g, '項目').replace(/開源項目/g, '開源專案');
const HAS_CJK = /[㐀-鿿豈-﫿]/;

const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

let added = 0;
let files = 0;
for (const sf of project.getSourceFiles()) {
  let touched = false;
  // Any object literal with sibling `zh:` + `en:` string props — covers both
  // tr({ zh, en }) args AND {zh,en,...} data objects rendered via tr(X).
  for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    const zhp = obj.getProperty('zh');
    const enp = obj.getProperty('en');
    if (!zhp || !enp || !Node.isPropertyAssignment(zhp) || !Node.isPropertyAssignment(enp)) continue;
    const init = zhp.getInitializer();
    if (!init || !(Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init))) continue;
    const zhVal = init.getLiteralValue();
    if (!HAS_CJK.test(zhVal)) continue;
    const trad = conv(zhVal);
    if (trad === zhVal) continue; // identical → zhHant ?? zh already correct
    const existing = obj.getProperty('zhHant');
    if (existing && Node.isPropertyAssignment(existing)) {
      existing.setInitializer((w) => w.quote(trad));
    } else {
      obj.addPropertyAssignment({ name: 'zhHant', initializer: (w) => w.quote(trad) });
    }
    added++;
    touched = true;
  }
  if (touched) files++;
}
await project.save();
console.log(`injected/updated zhHant on ${added} tr() calls across ${files} files`);
