#!/usr/bin/env node
// PreToolUse detector: block AI/human from HAND-TYPING Traditional Chinese into
// client-next source. Traditional is a generated artifact here (OpenCC s2twp via
// inject-zhhant.mjs / gen-zh-hant.mjs / conv.mjs) — never authored by hand.
//
// Reads the tool-call JSON on stdin, looks only at the text the edit ADDS (new
// minus old, so reordering / refactoring that carries existing Traditional is
// fine), and flags any Traditional-only char (OpenCC tw->cn changes it). The
// codemods write via fs (not the Edit tool), so they bypass this hook entirely.
//
// exit 2 + stderr -> Claude Code surfaces the message and blocks the edit.
// Fails OPEN (exit 0) on any parse/scope miss: CI (tests/zh-hant-drift.test.ts)
// is the authoritative gate; this is the shift-left nudge.
import * as OpenCC from 'opencc-js';
import { existsSync, readFileSync } from 'node:fs';

const t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });
const CJK = /[㐀-䶿一-鿿豈-﫿]/;
const isTradOnly = (ch) => CJK.test(ch) && t2s(ch) !== ch;

// Only client-next UI source. Generated/doc/test/data dirs are out of scope.
function inScope(p) {
  if (!p) return false;
  const f = p.replace(/\\/g, '/');
  if (!f.includes('/client-next/')) return false;
  if (!/\.(ts|tsx)$/.test(f) || /\.test\.tsx?$/.test(f)) return false;
  if (/\/(tests|scripts|i18n|node_modules|\.next)\//.test(f)) return false;
  return /\/(app|components|lib|hooks)\//.test(f);
}

function added(tool, ti) {
  // returns { add: string, base: string } — add = text introduced, base = text it replaces
  if (tool === 'Edit') return { add: ti.new_string ?? '', base: ti.old_string ?? '' };
  if (tool === 'MultiEdit' && Array.isArray(ti.edits))
    return {
      add: ti.edits.map((e) => e.new_string ?? '').join('\n'),
      base: ti.edits.map((e) => e.old_string ?? '').join('\n'),
    };
  if (tool === 'Write')
    return { add: ti.content ?? '', base: existsSync(ti.file_path) ? readFileSync(ti.file_path, 'utf8') : '' };
  return null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw.replace(/^﻿/, '')); // strip BOM the PS pipe may prepend
  } catch {
    process.exit(0); // fail open
  }
  const tool = payload.tool_name;
  const ti = payload.tool_input ?? {};
  if (!inScope(ti.file_path)) process.exit(0);

  const a = added(tool, ti);
  if (!a) process.exit(0);

  const baseSet = new Set([...a.base].filter(isTradOnly));
  const offending = [...new Set([...a.add].filter(isTradOnly))].filter((ch) => !baseSet.has(ch));
  if (offending.length === 0) process.exit(0);

  process.stderr.write(
    `⛔ 检测到手写繁体字 [${offending.join(' ')}] 在 ${String(ti.file_path).replace(/\\/g, '/')}\n` +
      `本仓库繁体中文一律由 OpenCC 生成,禁手敲。改法:\n` +
      `  • tr({zh,en}) / {zh,en} 数据对象:只写简体 + 英文,然后 cd packages/client-next && pnpm zh:inject(会自动注入 zhHant)。\n` +
      `  • 三路分支 i18n.language==='zh-Hant' ? (繁) : (原):用 node scripts/conv.mjs "简体" 取繁体粘贴。\n` +
      `详见 packages/client-next/scripts/ZHHANT_RECIPE.md。\n`,
  );
  process.exit(2);
});
