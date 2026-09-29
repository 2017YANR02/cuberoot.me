/**
 * 拿方朝向(csTimer `preScr`)—— 全站单一来源。
 *
 * 一个整体转前缀,描述「你把魔方拿成什么朝向」。它不改变魔方的状态,只改变
 * 哪个面显示哪种颜色:标签读作 "(<上><前>) <转体>",(UF) = 白上绿前 = 不转,
 * (DF) z2 = 黄上绿前。
 *
 * 两个消费方:
 *   - /timer 把前缀拼在打乱前面,只影响打乱图(打乱文本保持标准),见
 *     `timer/_lib/scramble/pre_scramble.ts` 里 csTimer 平价的 preScr/preScrT 两档;
 *   - /predict 不转状态,只用 `orientedFaceColors` 把颜色重贴到固定的几何面上。
 */
import { CUBE_FILL, type CubeFace } from './cube-colors';

import { orientedFaceColors } from '@cuberoot/shared/timer';
export { CUBE_ORIENTATIONS, applyOrientationPrefix, orientedFaceColors, faceShowingColor, orientationForBottomFace, type CubeOrientationOption } from '@cuberoot/shared/timer';

/** 朝向对应的六面实色。给 3D 渲染器做实例级覆写，不改 `/sim` 的全局用户配色。 */
export function orientedCubeFaceColors(
  prefix: string,
  faceColors: Record<CubeFace, string> = CUBE_FILL,
): Record<CubeFace, string> {
  const shown = orientedFaceColors(prefix);
  return Object.fromEntries(
    (Object.keys(shown) as CubeFace[]).map(face => [face, faceColors[shown[face]]]),
  ) as Record<CubeFace, string>;
}

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
