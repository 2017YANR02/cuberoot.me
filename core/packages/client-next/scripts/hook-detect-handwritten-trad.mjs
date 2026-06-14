#!/usr/bin/env node
// PreToolUse detector for client-next i18n discipline — TWO rules in ONE node spawn
// (block-handwritten-trad.ps1 CJK-gates then pipes here, so this runs only on CJK edits;
//  every offender of either rule contains Han, so the gate never drops one):
//   Rule 1: no bare `isZh ? '中' : 'EN'` text ternary — route copy through tr()/3-way.
//           Mirrors CI tests/i18n-no-bare-isz.test.ts (real Traditional gap only).
//   Rule 2: ABSOLUTE ban on hand-typed Traditional Chinese (original rule, below).
//
// --- Rule 2 rationale ---
// Traditional here is exclusively an OpenCC build artifact — it enters the
// tree ONLY through the fs-writing generators (inject-zhhant / gen-zh-hant /
// gen-ternary-zhhant), never through an Edit/Write tool call. So any Traditional-only
// glyph in the text THIS edit adds means a human/AI typed (or moved) it by hand → block.
//
// This is intentionally stricter than "is the Traditional correct": even a perfectly
// converted string is rejected if hand-typed, because the only sanctioned path is
// "edit the Simplified source, then run the generator". That closes the hole the old
// 繁===conv(简) checker had — carrying existing Traditional across an edit (e.g.
// 開放報名→報名) slipped through because every glyph already existed. Here we don't
// diff against the old text at all: new text with any Traditional glyph is blocked.
//
// Scope: only client-next app/components/lib/hooks .ts/.tsx (where rendered site copy
// lives). Generated catalogs (i18n/**), tests, scripts, docs are out of scope. The
// freshness of generated Traditional is enforced separately by CI
// (tests/zh-hant-drift.test.ts → the three --check generators).
//
// Fails OPEN (exit 0) on any parse/scope miss: CI is the authoritative gate.
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

// Text this tool call ADDS. We only look at inserted text, never the old/base content,
// so moving Traditional you didn't author is still caught (and correctly so).
function addedText(tool, ti) {
  if (tool === 'Write') return ti.content ?? '';
  if (tool === 'Edit') return ti.new_string ?? '';
  if (tool === 'MultiEdit' && Array.isArray(ti.edits)) {
    return ti.edits.map((e) => e?.new_string ?? '').join('\n');
  }
  return '';
}

const CJK = /[㐀-䶿一-鿿豈-﫿]/;

// Rule 1 — bare CJK isZh text ternary. Detect the shape with a regex (cheap), then keep
// only matches where a string-literal branch is a REAL Traditional gap (差 under s2twp),
// exactly like CI's isRealGap → 简繁同形 (新/未知/PB) is NOT flagged. The zh-Hant 3-way
// inner ternary (`=== 'zh-Hant' ? 繁 : (isZh ? 简 : en)`) is the sanctioned form: skipped
// via a narrow look-back (wide windows would swallow an unrelated earlier zh-Hant line).
const STR = "(?:'[^'\\r\\n]*'|\"[^\"\\r\\n]*\"|`[^`\\r\\n]*`)";
const COND =
  "(?:\\bisZh\\b|\\.language\\b[^?\\r\\n]{0,60}?(?:startsWith\\(\\s*['\"]zh|===?\\s*['\"](?:zh|en)['\"]))";
const BARE_ISZ = new RegExp(COND + "[^?\\r\\n]{0,40}\\?\\s*(" + STR + ")\\s*:\\s*(" + STR + ")", 'g');

function bareIszHits(text, toTrad) {
  const hits = [];
  for (const m of text.matchAll(BARE_ISZ)) {
    if (!CJK.test(m[0])) continue;
    if (text.slice(Math.max(0, m.index - 40), m.index).includes('zh-Hant')) continue;
    const realGap = [m[1], m[2]].some((lit) => {
      const s = lit.slice(1, -1);
      return CJK.test(s) && toTrad(s) !== s;
    });
    if (!realGap) continue;
    hits.push(m[0].replace(/\s+/g, ' ').slice(0, 70));
  }
  return hits;
}

// Block the tool call via the JSON permission decision. `exit 2` is IGNORED under the
// "auto"/bypass permission mode (empirically verified 2026-06-14), so we MUST emit this
// JSON deny — it is honored in every mode. block-handwritten-trad.ps1 pipes our stdout
// straight through to Claude Code and then exits 0.
function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
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

  const added = addedText(tool, ti);
  if (!CJK.test(added)) process.exit(0); // no Han at all → nothing to check

  let OpenCC;
  try {
    OpenCC = await import('opencc-js');
  } catch {
    process.exit(0); // tooling missing → fail open, CI catches it
  }

  // ── Rule 1: bare isZh CJK text ternary (route through tr()/3-way). Only ADDED text, so
  // pre-existing code is CI's job — this prevents NEW offenders at write time. ──
  const toTrad = OpenCC.Converter({ from: 'cn', to: 'twp' });
  const iszHits = bareIszHits(added, toTrad);
  if (iszHits.length) {
    deny(
      `⛔ 裸 isZh 文案三目(可见文案须走 tr()/三路):\n  ${iszHits.join('\n  ')}\n` +
        `在 ${String(ti.file_path).replace(/\\/g, '/')}\n` +
        `行内字面量 → tr({ en, zh }) 后跑 \`pnpm zh:inject\`;\n` +
        `需保留三目的动态/JSX → i18n.language==='zh-Hant' ? 繁 : (原三目),简支写好跑 \`pnpm zh:gen-ternary\`。\n` +
        `(简繁同形如 新/未知 不算违规。)详见 packages/client-next/scripts/ZHHANT_RECIPE.md。\n`,
    );
  }

  // ── Rule 2: hand-typed Traditional glyphs ──
  // For Write, only NEW Traditional should block — re-writing a file that already holds
  // generated Traditional verbatim is legitimate. Subtract glyphs present on disk so we
  // flag introductions, not faithful rewrites. (Edit/MultiEdit insert text, so their
  // "added" is genuinely new and isn't subtracted.)
  let onDisk = '';
  if (tool === 'Write' && existsSync(ti.file_path)) {
    try { onDisk = readFileSync(ti.file_path, 'utf8'); } catch { /* treat as empty */ }
  }
  const t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });

  // Traditional-only glyph = a Han char that the tw→cn converter rewrites (i.e. it is
  // not already its own Simplified form). 单 stays 单; 單 → 单, so 單 is flagged.
  const isTrad = (ch) => CJK.test(ch) && t2s(ch) !== ch;
  const onDiskTrad = tool === 'Write' ? new Set([...onDisk].filter(isTrad)) : null;

  const hits = [];
  for (const ch of added) {
    if (!isTrad(ch)) continue;
    if (onDiskTrad && onDiskTrad.has(ch)) continue; // already in the file → faithful rewrite
    if (!hits.includes(ch)) hits.push(ch);
  }
  if (!hits.length) process.exit(0);

  deny(
    `⛔ 检测到手写繁体字符 ${JSON.stringify(hits.slice(0, 30).join(''))} ` +
      `在 ${String(ti.file_path).replace(/\\/g, '/')}\n` +
      `本仓库繁体一律由 OpenCC 生成,任何文件都禁止手敲/搬运繁体(人 / AI 同)。\n` +
      `正确做法:只写简体源,繁体交给生成器经 fs 写入——\n` +
      `  内联三路  i18n.language==='zh-Hant' ? 繁 : (isZh?简:en):简支写好后跑 \`pnpm zh:gen-ternary\`(繁支自动生成)\n` +
      `  局部 t(zh,en,zhHant?) 第三参:只写 t('简','en') 后跑 \`pnpm zh:gen-localt\`(第三参自动生成)\n` +
      `  tr({zh,en}) / 数据对象 zhHant:跑 \`pnpm zh:inject\`\n` +
      `  t() 目录:改 i18n/zh.json 后跑 \`pnpm zh:gen\`\n` +
      `详见 packages/client-next/scripts/ZHHANT_RECIPE.md。\n`,
  );
});
