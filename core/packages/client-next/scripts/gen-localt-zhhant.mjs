#!/usr/bin/env node
// Local-t 3rd-arg Traditional GENERATOR + freshness gate.
//
// Dozens of components define a private inline translator
//   const t = (zh, en, zhHant?) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en)
// (names seen: t / T / tt, sometimes useCallback-wrapped). Its 3rd positional arg is
// the Traditional string — and historically it was HAND-TYPED, managed by no generator
// (inject-zhhant only touches {zh,en} object literals, not positional call args). With
// the absolute hand-typed-Traditional ban now in the PreToolUse hook, that 3rd arg can
// no longer be authored by hand, so this generator owns it: author t('简','en') and run
// `pnpm zh:gen-localt` — the 3rd arg is filled as conv('简') wherever 简≠繁, and a
// redundant 3rd arg (简===繁) is dropped.
//
// Same conv as the other generators (OpenCC s2twp + 项目→項目). Plain-string args are
// compared by VALUE (quote style ignored — no pointless re-quoting churn); template args
// (with ${}) are compared by source text (conv leaves ${} / English intact).
//
// Usage:
//   node scripts/gen-localt-zhhant.mjs            fill/refresh 3rd args (fs write)
//   node scripts/gen-localt-zhhant.mjs --check     CI gate: exit 1 if any 3rd arg is stale
import * as OpenCC from 'opencc-js';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const CHECK = process.argv.includes('--check');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = OpenCC.Converter({ from: 'cn', to: 'twp' });
const conv = (s) => raw(s).replace(/專案/g, '項目').replace(/開源項目/g, '開源專案');
const HAS_CJK = /[㐀-鿿豈-﫿]/;

// Does this call's callee accept our translator's 3rd arg? Decided by the callee's CALL
// SIGNATURE (type checker), so it holds whether `t` is a local arrow, a function-typed
// prop `t: (zh, en, zhHant?) => string`, or a destructured prop — and correctly rejects a
// 2-arg `t: (zh, en) => string` living in another scope (appending a 3rd arg there is
// TS2554, the over-reach typecheck caught). Requiring the 3rd param be named `zhHant`
// pins it to OUR translator, not any incidental 3-arg function with a Han first arg.
function isHelperCallee(idNode) {
  let sigs;
  try { sigs = idNode.getType().getCallSignatures(); } catch { return false; }
  return sigs.some((s) => {
    const ps = s.getParameters();
    return ps.length >= 3 && ps[2].getName() === 'zhHant';
  });
}

const isStr = (n) => n && (Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n));
const isTmpl = (n) => n && Node.isTemplateExpression(n);

// What the 3rd arg SHOULD be for a given first (Simplified) arg.
//   { kind: 'none' }                — arg1 not a generatable literal, or no Han: ignore call
//   { kind: 'drop' }                — 简===繁: no 3rd arg should exist
//   { kind: 'value', value }        — plain string: 3rd arg value must equal `value`
//   { kind: 'tmpl',  src }          — template: 3rd arg source must equal `src`
function want(arg1) {
  if (isStr(arg1)) {
    const v = arg1.getLiteralValue();
    if (!HAS_CJK.test(v)) return { kind: 'none' };
    const trad = conv(v);
    return trad === v ? { kind: 'drop' } : { kind: 'value', value: trad };
  }
  if (isTmpl(arg1)) {
    const src = arg1.getText();
    if (!HAS_CJK.test(src)) return { kind: 'none' };
    const trad = conv(src);
    return trad === src ? { kind: 'drop' } : { kind: 'tmpl', src: trad };
  }
  return { kind: 'none' };
}

// Is the existing 3rd arg already what we want?
function ok(want, arg3) {
  if (want.kind === 'drop') return arg3 == null;
  if (arg3 == null) return false;
  if (want.kind === 'value') return isStr(arg3) && arg3.getLiteralValue() === want.value;
  if (want.kind === 'tmpl') return arg3.getText() === want.src;
  return true;
}

const project = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { jsx: 4 } });
for (const d of ['app', 'components', 'lib', 'hooks']) {
  project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
}

let scanned = 0;
let changed = 0;
const stale = [];

for (const sf of project.getSourceFiles()) {
  if (/\.test\.tsx?$/.test(sf.getFilePath())) continue;
  scanned++;
  const rel = relative(ROOT, sf.getFilePath()).replace(/\\/g, '/');

  // Collect target calls first; mutate later (bottom-up) so edits don't shift each other.
  const jobs = [];
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const ex = call.getExpression();
    if (!Node.isIdentifier(ex)) continue;
    const args = call.getArguments();
    if (args.length < 2) continue; // need at least (zh, en)
    const w = want(args[0]); // cheap AST gate: arg0 must be a Han-bearing literal
    if (w.kind === 'none') continue;
    if (!isHelperCallee(ex)) continue; // type check only on plausible (Han-literal) calls
    const arg3 = args[2] ?? null;
    if (ok(w, arg3)) continue;
    jobs.push({ call, want: w, line: call.getStartLineNumber() });
  }
  if (!jobs.length) continue;

  if (CHECK) {
    for (const j of jobs) stale.push({ file: rel, line: j.line, text: j.call.getText().replace(/\s+/g, ' ').slice(0, 160) });
    continue;
  }

  jobs.sort((a, b) => b.call.getStart() - a.call.getStart());
  for (const j of jobs) {
    const args = j.call.getArguments();
    const arg3 = args[2] ?? null;
    if (j.want.kind === 'drop') {
      if (arg3) j.call.removeArgument(arg3);
    } else if (j.want.kind === 'value') {
      const emit = JSON.stringify(j.want.value); // double-quoted, unicode kept literal
      if (arg3) arg3.replaceWithText(emit);
      else j.call.addArgument(emit);
    } else {
      // tmpl
      if (arg3) arg3.replaceWithText(j.want.src);
      else j.call.addArgument(j.want.src);
    }
  }
  changed++;
  console.log(`✎ ${rel} — ${jobs.length} 处局部 t 第三参`);
}

if (CHECK) {
  for (const s of stale) console.error(`⛔ ${s.file}:${s.line}  ${s.text}`);
  console.error(`\n扫描 ${scanned} 个文件;过期/手写/缺失的局部 t 第三参 ${stale.length} 处。`);
  if (stale.length) {
    console.error('繁体一律由 OpenCC 生成。修复:在 packages/client-next 跑 `pnpm zh:gen-localt`(只写简体第一参,繁体第三参自动生成)。');
    process.exit(1);
  }
  console.log('OK — 每个局部 t 调用的第三参都等于 conv(第一参)(或简繁同形时不带第三参)。');
  process.exit(0);
}

await project.save();
console.log(`\n完成:扫描 ${scanned} 个文件,改写 ${changed} 个。`);
