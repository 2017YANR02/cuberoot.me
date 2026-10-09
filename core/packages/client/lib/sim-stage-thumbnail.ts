import { buildSimpleOptions, renderCubeSVG } from '@cuberoot/visualcube';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { ENGINE_TO_VC_FACE, netIndexOf } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { faceletDisplayColor, FM_REGULAR, type StickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { CUBE_FILL, type CubeFace } from '@/lib/cube-colors';

/** Render the same solved-slot mask as the simulator using the catalog's trans view. */
export function renderStageThumbnail(order: number, mask: StickeringMaskFn | null, faceColors: Record<CubeFace, string> = CUBE_FILL): string {
  const max = order - 1;
  const stickerColors = new Array<string>(6 * order * order);
  for (let z = 0; z < order; z++) for (let y = 0; y < order; y++) for (let x = 0; x < order; x++) {
    const initial = x + y * order + z * order * order;
    const faces: FACE[] = [];
    if (x === 0) faces.push(FACE.L);
    if (x === max) faces.push(FACE.R);
    if (y === 0) faces.push(FACE.D);
    if (y === max) faces.push(FACE.U);
    if (z === 0) faces.push(FACE.B);
    if (z === max) faces.push(FACE.F);
    for (const face of faces) {
      const index = ENGINE_TO_VC_FACE[face] * order * order + netIndexOf(x, y, z, face, max, order);
      stickerColors[index] = faceletDisplayColor(mask?.(initial, face) ?? FM_REGULAR, faceColors[FACE[face]]);
    }
  }
  return renderCubeSVG({ ...buildSimpleOptions({ case: '', view: 'trans', pzl: order, size: 64 }), stickerColors });
}
