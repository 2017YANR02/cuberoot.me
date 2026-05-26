/**
 * Alg text utilities — strip comments / zero-width chars, count expanded moves,
 * extract alg from recon-prefixed text. Ported from packages/client/src/utils/recon_alg_utils.ts.
 */

const STRIP_TOKENS = new Set([
  '[regrip]', '[lockup]', '[freePair]', '[free_pair]',
  '[yRot]', '[y_rot]', '[sMove]', '[s_move]',
]);

const COMMENT_LINE_RE = /^\/\/.*/;

export function cleanForPlayer(text: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  const cleaned: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (COMMENT_LINE_RE.test(trimmed)) continue;
    const commentIdx = trimmed.indexOf('//');
    const effective = commentIdx >= 0 ? trimmed.substring(0, commentIdx).trim() : trimmed;
    if (!effective) continue;
    const tokens = effective.split(/\s+/).filter((t) => !STRIP_TOKENS.has(t));
    if (tokens.length > 0) {
      cleaned.push(tokens.join(' '));
    }
  }
  let alg = cleaned.join('\n');
  alg = alg.replace(/[.·↑↓⅓⅔​‌‍﻿]/g, '');
  alg = alg.replace(/\(([^)]*)\)(?!\d)/g, '$1');
  alg = alg.replace(/([RULDFBMESruldfbmesxyz][w]?2?'?)(?=[RULDFBMESruldfbmesxyz])/g, '$1 ');
  return alg;
}

export function cleanForAlgCubingNet(text: string): string {
  const cleaned = cleanForPlayer(text);
  return cleaned.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractAlgFromText(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  let startIdx = 0;
  if (lines.length > 0 && /^\d+STM\s/i.test(lines[0])) {
    startIdx = 1;
    if (lines.length > 1 && !lines[1].includes('//')) {
      startIdx = 2;
    }
  }
  const alg = lines
    .slice(startIdx)
    .map((line) => {
      const idx = line.indexOf('//');
      return (idx >= 0 ? line.substring(0, idx) : line).trim();
    })
    .filter((line) => line.length > 0)
    .join('\n');
  return cleanForPlayer(alg);
}
