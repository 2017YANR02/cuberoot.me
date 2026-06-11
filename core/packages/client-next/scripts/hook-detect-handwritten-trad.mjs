#!/usr/bin/env node
// PreToolUse detector: block hand-typed WRONG Traditional in client-next source.
// Traditional here is OpenCC output (s2twp), never authored by hand.
//
// Reconstructs the post-edit file (Edit/MultiEdit splice, or Write content),
// parses it, and runs the shared inline-3-way verifier: every
//   i18n.language === 'zh-Hant' ? (繁) : (isZh ? 简 : en)
// must have 繁 === conv(简 sibling). A mismatch — the exact gap the old
// new-minus-old char check missed when Traditional was carried across an edit —
// blocks with exit 2. Correct conv-pasted Traditional passes, so the legit
// ternary workflow isn't obstructed.
//
// Scope split: zhHant fields (tr() args / objects with zhHant) and the t()
// catalog are owned by inject-zhhant / gen-zh-hant and their CI --check; this
// hook + check-handwritten-trad.mjs own the inline-ternary case. Same core
// module (lib/trad-ternary-check.mjs) so write-time and CI agree exactly.
//
// Fails OPEN (exit 0) on any parse/scope/reconstruct miss: CI
// (tests/zh-hant-drift.test.ts) is the authoritative gate; this is shift-left.
import { existsSync, readFileSync } from 'node:fs';

// Only client-next UI source. Generated/doc/test/data dirs are out of scope.
function inScope(p) {
  if (!p) return false;
  const f = p.replace(/\\/g, '/');
  if (!f.includes('/client-next/')) return false;
  if (!/\.(ts|tsx)$/.test(f) || /\.test\.tsx?$/.test(f)) return false;
  if (/\/(tests|scripts|i18n|node_modules|\.next)\//.test(f)) return false;
  return /\/(app|components|lib|hooks)\//.test(f);
}

// Splice new_string in for the first occurrence of old_string. Returns null if
// old_string isn't found verbatim (whitespace drift) → caller fails open.
function spliceOnce(base, oldStr, newStr) {
  if (oldStr === '') return null;
  const idx = base.indexOf(oldStr);
  if (idx < 0) return null;
  return base.slice(0, idx) + newStr + base.slice(idx + oldStr.length);
}

// Rebuild the file content as it WOULD be after this tool call.
function postEditContent(tool, ti) {
  const fp = ti.file_path;
  if (tool === 'Write') return ti.content ?? '';
  if (!existsSync(fp)) return null;
  const base = readFileSync(fp, 'utf8');
  if (tool === 'Edit') return spliceOnce(base, ti.old_string ?? '', ti.new_string ?? '');
  if (tool === 'MultiEdit' && Array.isArray(ti.edits)) {
    let cur = base;
    for (const e of ti.edits) {
      cur = spliceOnce(cur, e.old_string ?? '', e.new_string ?? '');
      if (cur === null) return null;
    }
    return cur;
  }
  return null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', async () => {
  let payload;
  try {
    payload = JSON.parse(raw.replace(/^﻿/, '')); // strip BOM the PS pipe may prepend
  } catch {
    process.exit(0); // fail open
  }
  const tool = payload.tool_name;
  const ti = payload.tool_input ?? {};
  if (!inScope(ti.file_path)) process.exit(0);

  let post;
  try {
    post = postEditContent(tool, ti);
  } catch {
    process.exit(0);
  }
  if (post == null) process.exit(0);

  // Defer the heavy imports (ts-morph + opencc) until we actually have content
  // to parse — keeps the common no-op path cheap.
  let violations;
  try {
    const { Project } = await import('ts-morph');
    const { collectViolations } = await import('./lib/trad-ternary-check.mjs');
    const project = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { jsx: 4 } });
    const sf = project.createSourceFile(ti.file_path, post, { overwrite: true });
    violations = collectViolations(sf);
  } catch {
    process.exit(0); // fail open on any tooling error
  }
  if (!violations.length) process.exit(0);

  const lines = violations
    .slice(0, 8)
    .map((v) => `  行 ${v.line}\n    手写: ${JSON.stringify(v.got)}\n    应为: ${JSON.stringify(v.expected)}`)
    .join('\n');
  process.stderr.write(
    `⛔ 内联三路的繁体分支与简体兄弟不一致(手写繁体)在 ${String(ti.file_path).replace(/\\/g, '/')}\n` +
      `本仓库繁体一律由 OpenCC 生成,禁手敲。改法:繁体分支用 \`node scripts/conv.mjs "简体"\` 取值粘贴。\n` +
      `${lines}\n` +
      `详见 packages/client-next/scripts/ZHHANT_RECIPE.md。\n`,
  );
  process.exit(2);
});
