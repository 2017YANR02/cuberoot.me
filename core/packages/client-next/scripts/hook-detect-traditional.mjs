#!/usr/bin/env node
// PreToolUse detector: DENY writing Traditional Chinese into client-next source.
// The site is Simplified-only (en + zh-Hans); Traditional was fully removed
// (2026-06-14). Reads the hook payload on stdin ({tool_name, tool_input}) and
// scans the NEW content (Write.content / Edit.new_string / MultiEdit.edits[]).
// Emits a JSON permissionDecision=deny on stdout + exit 0 when Traditional is
// found (exit 2 is ignored in auto permission mode; JSON deny works everywhere).
//
// Detection: standard OpenCC t→s (NOT the 'tw'/'twp' Taiwan variant, which
// mutates pure Simplified). DUAL_USE = chars valid in Simplified that t2s still
// over-converts (著 名/显著, 覆 盖) — never flagged. Mirrors tests/i18n-removal-guard.
import * as OpenCC from 'opencc-js';

const t2s = OpenCC.Converter({ from: 't', to: 'cn' });
const DUAL_USE = new Set(['著', '覆']);
const HAN = /[㐀-䶿一-鿿豈-﫿]/g;

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let ti;
  try { ti = (JSON.parse(raw).tool_input) || {}; } catch { process.exit(0); }
  const fp = String(ti.file_path || '').replace(/\\/g, '/');
  // Only client-next app/components/lib/hooks/i18n source (.ts/.tsx); skip tests/scripts.
  if (!/client-next\/(app|components|lib|hooks|i18n)\//.test(fp) || !/\.tsx?$/.test(fp) || /\.test\.tsx?$/.test(fp)) {
    process.exit(0);
  }
  const parts = [];
  if (typeof ti.content === 'string') parts.push(ti.content);
  if (typeof ti.new_string === 'string') parts.push(ti.new_string);
  if (Array.isArray(ti.edits)) for (const e of ti.edits) if (e && typeof e.new_string === 'string') parts.push(e.new_string);
  const bad = new Set();
  for (const ch of (parts.join('\n').match(HAN) || [])) if (!DUAL_USE.has(ch) && t2s(ch) !== ch) bad.add(ch);
  if (!bad.size) process.exit(0);
  const reason = `繁体字被禁止:本站只服简体(zh-Hans)+ 英文,繁体已全站移除(2026-06-14)。检测到繁体字形 [${[...bad].join('')}],请改写为简体。`;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
  process.exit(0);
});
