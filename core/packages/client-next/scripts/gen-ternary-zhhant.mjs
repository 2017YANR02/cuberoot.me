#!/usr/bin/env node
// Inline-3-way Traditional GENERATOR + freshness gate.
//
// The repo has three Traditional channels, each "Simplified is the single source,
// Traditional is OpenCC-generated, never hand-authored":
//   • i18n/zh-Hant.json (t() catalog)                 → gen-zh-hant.mjs
//   • zhHant fields in tr() args / data objects       → inject-zhhant.mjs
//   • inline switches in component source              → THIS script
//       i18n.language === 'zh-Hant' ? <繁> : (isZh ? <简> : <en>)   (3-way)
//       i18n.language === 'zh-Hant' ? <繁> : <简>                   (2-way, no English)
//
// For every such switch whose Simplified sibling carries a Han literal, the Traditional
// branch is regenerated as conv(Simplified sibling) — conv = OpenCC s2twp + the
// 项目→項目 domain override, identical to the other two generators. conv only rewrites
// Han glyphs, so ${...} / JSX tags / English survive verbatim; the Simplified branch is
// authored normally and the Traditional branch is produced mechanically, fs-written
// (bypassing the PreToolUse hand-typed-Traditional hook, exactly like zh:inject).
//
// Hard rule that makes this total (no special-casing): the Simplified branch must be
// PURE Simplified source — no nested t()/tr() call, no precomputed language variable.
// conv(简 sibling) must equal the Traditional branch CHARACTER-FOR-CHARACTER (strict,
// no brace-stripping). If you need a language-varying value mid-string, inline the
// conditional in Simplified (`${type === 'average' ? '平均' : '单次'}`) so conv carries
// it into Traditional too — do NOT reach for a `${typeZh}`-style precomputed var.
//
// Usage:
//   node scripts/gen-ternary-zhhant.mjs            regenerate Traditional branches (fs write)
//   node scripts/gen-ternary-zhhant.mjs --check     CI gate: exit 1 if any branch is stale
import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const rawS2T = OpenCC.Converter({ from: 'cn', to: 'twp' });
const conv = (s) => rawS2T(s).replace(/專案/g, '項目').replace(/開源項目/g, '開源專案');

const CJK = /[㐀-䶿一-鿿豈-﫿]/;
const hasHan = (s) => CJK.test(s);
const ZH_HANT_COND = /i18n\.language\s*===?\s*['"]zh-Hant['"]/;
const unwrap = (n) => { while (n && Node.isParenthesizedExpression(n)) n = n.getExpression(); return n; };

// Every inline language switch with a Han Simplified sibling → its Traditional branch
// node + the text it MUST hold. Runtime siblings (no Han literal, e.g. `r.zhHant ?? r.zh`)
// are skipped: nothing to generate from.
function collectTargets(sourceFile) {
  const out = [];
  for (const cond of sourceFile.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    if (!ZH_HANT_COND.test(cond.getCondition().getText())) continue;
    const aNode = unwrap(cond.getWhenTrue());
    const whenFalse = unwrap(cond.getWhenFalse());
    const zhNode = Node.isConditionalExpression(whenFalse)
      ? unwrap(whenFalse.getWhenTrue()) // 3-way: 简 is the isZh-true branch
      : whenFalse;                      // 2-way: 简 is the whole else
    const zhSrc = zhNode.getText();
    if (!hasHan(zhSrc)) continue;
    out.push({ line: cond.getStartLineNumber(), aNode, current: aNode.getText(), expected: conv(zhSrc) });
  }
  return out;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const project = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { jsx: 4 } });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

let scanned = 0;
let changedFiles = 0;
const stale = [];
for (const sf of project.getSourceFiles()) {
  if (/\.test\.tsx?$/.test(sf.getFilePath())) continue;
  scanned++;
  const rel = relative(ROOT, sf.getFilePath()).replace(/\\/g, '/');
  const targets = collectTargets(sf).filter((t) => t.current !== t.expected);
  if (!targets.length) continue;

  if (CHECK) {
    for (const t of targets) stale.push({ file: rel, ...t });
    continue;
  }

  // Splice replacements into the raw text from the ONE parse, applied end→start so no
  // edit shifts another's offsets (ts-morph node mutation would invalidate later nodes).
  let text = sf.getFullText();
  const edits = targets
    .map((t) => ({ start: t.aNode.getStart(), end: t.aNode.getEnd(), expected: t.expected }))
    .sort((a, b) => b.start - a.start);
  for (const e of edits) text = text.slice(0, e.start) + e.expected + text.slice(e.end);
  writeFileSync(sf.getFilePath(), text);
  changedFiles++;
  console.log(`✎ ${rel} — 重新生成 ${targets.length} 处繁体分支`);
}

if (CHECK) {
  for (const s of stale) {
    console.error(`⛔ ${s.file}:${s.line}`);
    console.error(`   现有繁支: ${s.current}`);
    console.error(`   应生成为: ${s.expected}`);
  }
  console.error(`\n扫描 ${scanned} 个文件;过期/手写繁体分支 ${stale.length} 处。`);
  if (stale.length) {
    console.error('繁体一律由 OpenCC 生成。修复:在 packages/client-next 跑 `pnpm zh:gen-ternary`(只写简支,繁支自动生成)。');
    process.exit(1);
  }
  console.log('OK — 每个内联三路的繁体分支都等于 conv(简体兄弟)。');
  process.exit(0);
}

console.log(`\n完成:扫描 ${scanned} 个文件,改写 ${changedFiles} 个。`);
