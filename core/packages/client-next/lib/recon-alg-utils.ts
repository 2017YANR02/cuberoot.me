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

/** Sync a TwistyPlayer instance to a specific move count along its current alg. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function syncPlayerToMoveCount(player: any, moveCount: number) {
  if (!player) return;
  try {
    const model = player.experimentalModel;
    if (!model || !model.indexer) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.indexer.get().then((indexer: any) => {
      try {
        if (typeof indexer.indexToMoveStartTimestamp === 'function') {
          const totalMoves = typeof indexer.numAnimatedLeaves === 'function'
            ? indexer.numAnimatedLeaves()
            : (typeof indexer.numMoves === 'function' ? indexer.numMoves() : 0);
          if (moveCount >= totalMoves && typeof indexer.algDuration === 'function') {
            player.timestamp = indexer.algDuration();
          } else {
            player.timestamp = indexer.indexToMoveStartTimestamp(moveCount);
          }
        }
      } catch {
        /* indexer not ready / shape mismatch */
      }
    }).catch(() => { /* not ready */ });
  } catch {
    /* experimentalModel inaccessible (older cubing.js) */
  }
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
