#!/usr/bin/env node
// PreToolUse detector for client i18n write guards. Reads the hook payload on
// stdin ({tool_name, tool_input}), scans the NEW content (Write.content /
// Edit.new_string / MultiEdit.edits[]), and DENIES (JSON permissionDecision=deny
// on stdout + exit 0; exit 2 is ignored in auto permission mode) on either:
//
//   1. Traditional Chinese — the site is Simplified-only (en + zh-Hans);
//      Traditional was fully removed (2026-06-14).
//      Detection: standard OpenCC t→s (NOT the 'tw'/'twp' Taiwan variant, which
//      mutates pure Simplified). DUAL_USE = chars valid in Simplified that t2s
//      still over-converts (著 名/显著, 覆 盖) — never flagged.
//      Mirrors tests/i18n-removal-guard.test.ts.
//
//   2. Inline UI-language TEXT ternaries — the banned pattern
//        isZh ? '中文' : 'English'   /   i18n.language.startsWith('zh') ? … : …
//      Visible text must go through tr({ en, zh }) / <T en zh /> / useT() / t().
//      Mirrors tests/i18n-no-isz-text-ternary.test.ts (CI ratchet is authoritative;
//      this is best-effort fast feedback for the common literal/`i18n.language` cases).
import * as OpenCC from 'opencc-js';

const t2s = OpenCC.Converter({ from: 't', to: 'cn' });
const DUAL_USE = new Set(['著', '覆']);
const HAN = /[㐀-䶿一-鿿豈-﫿]/g;
const HAS_CJK = /[㐀-鿿豈-﫿]/;

const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
  process.exit(0);
};

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let ti;
  try { ti = (JSON.parse(raw).tool_input) || {}; } catch { process.exit(0); }
  const fp = String(ti.file_path || '').replace(/\\/g, '/');
  // Only client app/components/lib/hooks/i18n source (.ts/.tsx); skip tests/scripts.
  if (!/client\/(app|components|lib|hooks|i18n)\//.test(fp) || !/\.tsx?$/.test(fp) || /\.test\.tsx?$/.test(fp)) {
    process.exit(0);
  }
  const parts = [];
  if (typeof ti.content === 'string') parts.push(ti.content);
  if (typeof ti.new_string === 'string') parts.push(ti.new_string);
  if (Array.isArray(ti.edits)) for (const e of ti.edits) if (e && typeof e.new_string === 'string') parts.push(e.new_string);
  const text = parts.join('\n');

  // (1) Traditional Chinese.
  const bad = new Set();
  for (const ch of (text.match(HAN) || [])) if (!DUAL_USE.has(ch) && t2s(ch) !== ch) bad.add(ch);
  if (bad.size) {
    deny(`繁体字被禁止:本站只服简体(zh-Hans)+ 英文,繁体已全站移除(2026-06-14)。检测到繁体字形 [${[...bad].join('')}],请改写为简体。`);
  }

  // (2) Inline UI-language text ternaries → must use tr()/<T>/useT()/t().
  // Exempt the i18n/ primitives (tr.tsx / i18n-client.ts) — they ARE the single
  // language-switch chokepoint, so the ternary lives there by design. The CI
  // ratchet likewise only scans app/components/lib/hooks (not i18n/).
  if (/client\/i18n\//.test(fp)) process.exit(0);
  // 2a. `i18n.language … ?` — the test is unambiguously the global UI language.
  if (/i18n\.language\b[^?\n]{0,80}\?/.test(text)) {
    deny(`禁止内联 UI 语言文案三元(i18n.language ? … : …)。可见文案统一走 tr({ en, zh }) / <T en zh /> / useT() 的 t(zh, en) / t('ns.key')。详见 skill i18n。`);
  }
  // 2b. `isZh ? …中文… :` in component land (app/ + components/ .tsx), where `isZh`
  //     is the global-lang const. lib/ utils legitimately take `isZh` as a param
  //     (displayCuberName(name, isZh)) — not flagged here; the CI ratchet excludes them.
  if (/client\/(app|components)\//.test(fp) && /\.tsx$/.test(fp)) {
    for (const m of text.matchAll(/!?\bisZh\s*\?/g)) {
      const window = text.slice(m.index, m.index + 140);
      if (HAS_CJK.test(window)) {
        deny(`禁止内联 isZh 文案三元(isZh ? '中文' : 'English')。组件内可见文案走 tr({ en, zh }) / <T en zh /> / useT() 的 t(zh, en)。详见 skill i18n。`);
      }
    }
  }

  process.exit(0);
});
