import { CUBE_FILL, type CubeFace } from './cube-colors';
import { orientedFaceColors } from '@cuberoot/shared/timer/cube-orientation';
const VISUALCUBE_COLOR_CODE: Record<CubeFace, string> = {
  U: 'w', D: 'y', F: 'g', B: 'b', L: 'o', R: 'r',
};
const VISUALCUBE_FACE_ORDER: CubeFace[] = ['U', 'R', 'F', 'D', 'L', 'B'];

/** VisualCube 的 `sch=`(U R F D L B)；`topOnly` 保留 OLL 的单色识别图语义。 */
export function visualCubeSchemeForOrientation(prefix: string, topOnly = false): string {
  const shown = orientedFaceColors(prefix);
  if (topOnly) {
    return VISUALCUBE_FACE_ORDER
      .map(face => face === 'U' ? CUBE_FILL[shown.U].slice(1) : '404040')
      .join(',');
  }
  return VISUALCUBE_FACE_ORDER.map(face => VISUALCUBE_COLOR_CODE[shown[face]]).join('');
}
