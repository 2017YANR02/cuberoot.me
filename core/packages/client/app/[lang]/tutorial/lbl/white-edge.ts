import { FM_IGNORED, FM_REGULAR } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';

/** Preserve centers and the white/red edge's two stickers throughout its moves. */
export const whiteEdgeMask = (piece: number, face: number) => {
  const coordinates = [piece % 3, Math.floor(piece / 3) % 3, Math.floor(piece / 9)];
  if (coordinates.filter(value => value === 1).length === 2) return FM_REGULAR;
  const sticker = engineHomeSid(piece, face, 3);
  return sticker === 'D5' || sticker === 'R7' ? FM_REGULAR : FM_IGNORED;
};
export const whiteEdgeStickering = () => whiteEdgeMask;
