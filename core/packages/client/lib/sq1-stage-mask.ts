import type { StickerId } from '@/lib/puzzle-image/mask-core';

export const SQ1_STAGE_ITEMS = ['CO', 'EO', 'CP', 'EP'] as const;
export type Sq1Stage = typeof SQ1_STAGE_ITEMS[number];

function isCornerPiece(piece: number): boolean {
  return ((piece + (piece <= 7 ? 0 : 1)) % 2) === 0;
}

function faceSid(piece: number): StickerId {
  return piece <= 7 ? `U${piece}` : `D${piece}`;
}

const ALL_STICKERS = new Set<StickerId>();
for (let piece = 0; piece <= 15; piece++) {
  ALL_STICKERS.add(faceSid(piece));
  ALL_STICKERS.add(`SA${piece}`);
  if (isCornerPiece(piece)) ALL_STICKERS.add(`SB${piece}`);
}
for (let i = 0; i < 6; i++) ALL_STICKERS.add(`M${i}`);

/** Formula-set slug or stage selector value → canonical SQ1 stage. */
export function sq1Stage(value: string): Sq1Stage | null {
  const stage = value.toUpperCase();
  return (SQ1_STAGE_ITEMS as readonly string[]).includes(stage) ? stage as Sq1Stage : null;
}

/**
 * Stage → stickers omitted from the render. IDs are piece-keyed, so the mask
 * follows every physical piece through turns and slices.
 */
export function sq1StageHiddenStickerIds(value: string): Set<StickerId> | null {
  const stage = sq1Stage(value);
  if (!stage) return null;

  const visible = new Set<StickerId>();
  for (let piece = 0; piece <= 15; piece++) {
    const corner = isCornerPiece(piece);
    // Stages are cumulative:CO → +EO → +CP → +EP.
    if (corner || stage !== 'CO') visible.add(faceSid(piece));
    if (corner && (stage === 'CP' || stage === 'EP')) {
      visible.add(`SA${piece}`);
      visible.add(`SB${piece}`);
    } else if (!corner && stage === 'EP') {
      visible.add(`SA${piece}`);
    }
  }

  return new Set([...ALL_STICKERS].filter((sid) => !visible.has(sid)));
}
