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
// Run:   node scripts/inject-zhhant.mjs           (writes zhHant in place)
//        node scripts/inject-zhhant.mjs --check    (CI: report drift, exit 1; never writes)
//
// --check is the regenerate-and-diff gate (大厂 codegen-freshness pattern): it
// computes what a normal run WOULD write and fails if any committed zhHant is
// missing/stale, so nobody can hand-author or forget to re-run the codemod.

import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const CHECK = process.argv.includes('--check');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = OpenCC.Converter({ from: 'cn', to: 'twp' });
// 项目 (cube event) -> 項目, not s2twp's 專案 (software project). Keep 開源專案.
const conv = (s) => raw(s).replace(/專案/g, '項目').replace(/開源項目/g, '開源專案');
const HAS_CJK = /[㐀-鿿豈-﫿]/;

// jsx enabled so .tsx parses.
const project = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { jsx: 4 } });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

// Manage zhHant ONLY where it's provably safe, by pure AST shape — NO type
// checker. (Contextual types are unreliable without the full tsconfig project:
// `@/` alias imports don't resolve, and a wrong guess either deletes committed
// translations or adds TS2353 excess-property errors. Learned the hard way.)
//   (a) a direct tr({...}) argument — tr's parameter type always accepts zhHant
//   (b) an object that ALREADY has a zhHant property — its type provably allows it
// Other {zh,en} data objects are left alone: they're either mid-conversion
// (3-way pattern, see ZHHANT_RECIPE.md) or need a `zhHant?` type slot first.
// This script NEVER removes anything; if a zhHant ever lands where a type
// forbids it, tsc is the red light — not silent deletion.

let added = 0;
let files = 0;
const drift = []; // { file, zh, expected, got }
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
    const ei = existing && Node.isPropertyAssignment(existing) ? existing.getInitializer() : null;
    const cur = ei && (Node.isStringLiteral(ei) || Node.isNoSubstitutionTemplateLiteral(ei)) ? ei.getLiteralValue() : null;

    const par = obj.getParent();
    const isTrArg = par && Node.isCallExpression(par) && par.getExpression().getText() === 'tr';
    const managed = isTrArg || (existing && Node.isPropertyAssignment(existing));
    if (!managed) continue;

    if (CHECK) {
      if (cur !== trad) drift.push({ file: relative(ROOT, sf.getFilePath()), zh: zhVal, expected: trad, got: cur });
      continue;
    }
    if (cur === trad) continue; // already correct — leave it (keeps the run fast + diff-free)
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

if (CHECK) {
  if (drift.length) {
    console.error(`zhHant drift: ${drift.length} managed object(s) (tr() args / objects with zhHant) missing or stale.`);
    console.error('繁体字一律由 OpenCC 生成,禁手敲。修复: cd packages/client-next && node scripts/inject-zhhant.mjs (或 pnpm zh:inject)\n');
    for (const d of drift.slice(0, 40)) {
      console.error(`  ${d.file}\n    zh:       ${JSON.stringify(d.zh)}\n    expected: ${JSON.stringify(d.expected)}\n    got:      ${JSON.stringify(d.got)}`);
    }
    if (drift.length > 40) console.error(`  ... and ${drift.length - 40} more`);
    process.exit(1);
  }
  console.log('zhHant up to date — every managed object (tr() args / objects with zhHant) matches OpenCC output.');
  process.exit(0);
}

await project.save();
console.log(`injected/updated zhHant on ${added} tr() calls across ${files} files`);
