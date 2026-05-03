/**
 * cubedb-style URL encoding for sharing recon scramble + solution.
 *
 * URL params (independent, all optional):
 *   ?scramble=<wcaScramble>&optimal=<optimalScramble>&alg=<solution>
 *
 * Encode: spaces → `_`, `'` → `-` (so the URL is `+`/`%27`-free and readable).
 * Other special chars (`(`, `)`, `+`, `·`, `\n`, …) are left to the URL system.
 *
 * Decode for `-`: in the move portion of each line (before `//`), aggressively
 * convert `<move>-` → `<move>'`. In comments after `//`, dashes are left alone
 * so `// ZBLL-T` survives a round-trip.
 */

// cubedb 的 URL 偶尔夹零宽字符(%E2%80%8B = U+200B 等),留着会让 cubing.js
// Alg parser 报错,整段 alg 不可播 — decode 时全剥掉。
const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF]/g;

// 在公式段(非注释)里,任何 [字母][w]?[2]? 后跟 `-` 都还原成 `'`。
// 这样 `D-U2-` 紧贴写法 → `D'U2'`(后续 cleanForPlayer 会补空格)。
const MOVE_DASH = /([A-Za-z][wW]?[2]?)-/g;

export function encodeUrlAlg(s: string): string {
  if (!s) return '';
  return s.replace(/'/g, '-').replace(/ /g, '_');
}

export function decodeUrlAlg(raw: string): string {
  if (!raw) return '';
  const stripped = raw.replace(ZERO_WIDTH, '').replace(/_/g, ' ');
  return stripped.split('\n').map(line => {
    const idx = line.indexOf('//');
    if (idx < 0) return line.replace(MOVE_DASH, "$1'");
    return line.slice(0, idx).replace(MOVE_DASH, "$1'") + line.slice(idx);
  }).join('\n');
}
