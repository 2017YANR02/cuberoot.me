// Shared core for the inline-3-way Traditional verifier. Used by both the CI
// scanner (check-handwritten-trad.mjs) and the write-time PreToolUse hook
// (hook-detect-handwritten-trad.mjs) so they enforce one identical rule:
//
//   i18n.language === 'zh-Hant' ? (繁) : (isZh ? 简 : en)
//   ⇒ the 繁 branch MUST equal conv(the 简 sibling) — conv = OpenCC s2twp + the
//     项目→項目 domain override (same converter inject-zhhant.mjs uses).
//
// s2twp is not invertible (算法→演算法), so verification compares against the
// Simplified sibling in the SAME ternary, never a t2s round-trip. conv touches
// only Han glyphs, leaving ${...} / tags / English intact, so for a correct
// branch conv(zhSource) === tradSource outside brace-expressions.

import * as OpenCC from 'opencc-js';
import { SyntaxKind, Node } from 'ts-morph';

const t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });
const rawS2T = OpenCC.Converter({ from: 'cn', to: 'twp' });
export const conv = (s) => rawS2T(s).replace(/專案/g, '項目').replace(/開源項目/g, '開源專案');

const CJK = /[㐀-䶿一-鿿豈-﫿]/;
export const hasTrad = (s) => [...s].some((ch) => CJK.test(ch) && t2s(ch) !== ch);
const hasHan = (s) => CJK.test(s);
const ZH_HANT_COND = /i18n\.language\s*===?\s*['"]zh-Hant['"]/;

const unwrap = (n) => {
  while (n && Node.isParenthesizedExpression(n)) n = n.getExpression();
  return n;
};

// Drop template ${...} and JSX {...} spans by brace depth (regex can't balance
// nesting): the 繁 branch and zh sibling occasionally diverge INSIDE code spans
// (one inlines a conditional, the other uses a var / extra t() arg) while the
// surrounding copy is identical — comparing only out-of-brace text keeps real
// glyph errors visible without that structural noise.
export function stripBraces(s) {
  let out = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '$' && s[i + 1] === '{') { depth++; i++; continue; }
    if (c === '{') { depth++; continue; }
    if (c === '}') { if (depth > 0) depth--; continue; }
    if (depth === 0) out += c;
  }
  return out;
}

// Returns [{ line, got, expected }] for every inline 3-way whose Traditional
// branch doesn't match conv(its Simplified sibling). Runtime siblings (no Han
// literal, e.g. `r.zhHant ?? r.zh`) are skipped — nothing to compare against.
export function collectViolations(sourceFile) {
  const out = [];
  for (const cond of sourceFile.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    if (!ZH_HANT_COND.test(cond.getCondition().getText())) continue;
    const A = unwrap(cond.getWhenTrue());
    const B = unwrap(cond.getWhenFalse());
    const aSrc = A.getText();
    if (!hasTrad(aSrc)) continue; // runtime/Hant-const branch — no literal Traditional here
    if (!Node.isConditionalExpression(B)) continue; // sibling not a literal (isZh?简:en) shape
    const zhNode = unwrap(B.getWhenTrue());
    const zhSrc = zhNode.getText();
    if (!hasHan(zhSrc)) continue;
    const expected = conv(zhSrc);
    if (stripBraces(expected) !== stripBraces(aSrc)) {
      out.push({ line: cond.getStartLineNumber(), got: aSrc, expected });
    }
  }
  return out;
}
