/**
 * 图案搜索编辑器状态的 URL 编码 —— `?q=` 与 DB 里 pattern_examples.q 是同一串(单一源)。
 *
 * 格式:45 位 [0-5] 格子色类(5 个图案 × 9 格,行主序,GRAY=5)+ '-' +
 *       5 × 2 位十六进制面分配掩码(bit0..5 = U R F D L B)。
 * 服务端同款校验在 server/src/routes/pattern_examples.ts 的 Q_RE。
 */

import { GRAY, isEmptyPattern } from './_pattern_core';

export type Patterns = number[][]; // 5 × 9
export type Assign = boolean[][]; // 5 × 6

export const Q_RE = /^[0-5]{45}-[0-9a-f]{10}$/;

export const defaultPatterns = (): Patterns => Array.from({ length: 5 }, () => new Array(9).fill(GRAY));
export const defaultAssign = (): Assign => Array.from({ length: 5 }, () => new Array(6).fill(false));

/** 初始态(全灰 + 无分配):不写进 URL。 */
export const DEFAULT_Q = `${'5'.repeat(45)}-${'00'.repeat(5)}`;

export function encodeQ(patterns: Patterns, assign: Assign): string {
  const cells = patterns.flat().join('');
  let mask = '';
  for (let j = 0; j < 5; j++) {
    let m = 0;
    for (let f = 0; f < 6; f++) if (assign[j][f]) m |= 1 << f;
    mask += m.toString(16).padStart(2, '0');
  }
  return `${cells}-${mask}`;
}

export function decodeQ(q: string | null): { patterns: Patterns; assign: Assign } | null {
  if (!q || !Q_RE.test(q)) return null;
  const patterns = defaultPatterns();
  const assign = defaultAssign();
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 9; i++) patterns[j][i] = Number(q[j * 9 + i]);
    const m = parseInt(q.slice(46 + j * 2, 48 + j * 2), 16);
    for (let f = 0; f < 6; f++) assign[j][f] = (m & (1 << f)) !== 0;
  }
  return { patterns, assign };
}

/** 示例按钮上的 3×3 缩略图:取该预设第一个非空图案(全空则退回图案 1)。 */
export function miniCells(q: string): number[] {
  const d = decodeQ(q);
  if (!d) return new Array(9).fill(GRAY);
  return d.patterns.find((p) => !isEmptyPattern(p)) ?? d.patterns[0];
}
