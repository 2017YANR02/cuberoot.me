/**
 * stickerOutline —— FM_OUTLINE 那一档的渲染:贴纸不换色,沿边缘描一圈高亮色。
 *
 * 为什么要有这一档:阶段遮罩原来只会「换色」(压暗 / 变灰 / 记号色)。要指认「就是这一枚」
 * 时换色是不够的 —— 换了就看不出它本来什么颜色,而 /predict 恰恰要玩家读出那枚贴纸的颜色。
 * 描边把「标记」和「颜色」分开:颜色照旧是它自己的,边框负责跳出来。
 *
 * 做法照 rawCore 那条路(不加网格、不加 draw call):
 *   - 每个 sticker 实例一个 `aOutline` 属性(0/1),setStickering 时按遮罩码填;
 *   - material 用 onBeforeCompile 注入:fragment 里算「贴纸本地系到圆角矩形边界的距离」
 *     (SDF 与 _STICKER 的 makeStickerShape 同源:半宽 STICKER_INNER/2、圆角
 *     STICKER_CORNER_RADIUS),落在边界内 OUTLINE_WIDTH 以内就换成描边色。
 *
 * static / moving 两个 InstancedMesh 共享同一份几何与同一组材质注入,所以转层动画里
 * 描边自动跟着走,无需额外同步。挤出体的侧壁 `position.xy` 正好落在边界上 → 侧壁也是
 * 描边色,厚贴片从侧面看仍是一圈框。
 */
import * as THREE from 'three';
import { COLORS, STICKER_INNER, STICKER_CORNER_RADIUS } from '@cuberoot/puzzle-render-core/engine/define';

/** 描边宽度(世界单位;贴纸半宽 = STICKER_INNER/2 = 28)。 */
export const OUTLINE_WIDTH = 4.5;

/** 默认描边色 = 引擎自带的高亮品红(define.COLORS.High)。六面色里没有这个色相,
 *  压在白/黄/红/橙/绿/蓝哪一枚上都跳得出来。 */
export const OUTLINE_DEFAULT = COLORS.High;

const HALF = STICKER_INNER / 2;
const R = STICKER_CORNER_RADIUS;

/** 圆角矩形 SDF 的两个尺寸参数,随「黑边」滑块缩放(贴纸几何整体缩,shader 读到的
 *  `position.xy` 也跟着缩,所以边界常量必须同倍缩才对得上)—— 编成 uniform 而不是
 *  写死进 shader 源码。x = 半宽−圆角,y = 圆角;单位是世界单位(几何缩放不改实例矩阵,
 *  所以 OUTLINE_WIDTH 这条描边宽度保持绝对值,滑块只改贴纸大小不改边框粗细)。 */
const uOutlineSdf = { value: new THREE.Vector2(HALF - R, R) };
/** 贴纸几何按 k 缩放后同步 SDF 边界(k = 1 → 出厂尺寸)。 */
export function setStickerOutlineScale(k: number): void {
  uOutlineSdf.value.set((HALF - R) * k, R * k);
}

export type StickerMaterial = THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;

/** 一组材质共享的描边色 uniform(改一次两个材质一起变)。 */
export interface OutlineUniform { value: THREE.Color }

/**
 * 给 sticker 材质注入描边。返回描边色 uniform —— 调用方留着改色用。
 * 注入点(`<common>` / `<begin_vertex>` / `<color_fragment>`)Lambert 与 Basic 都有,
 * 所以低阶(带光照)和超高阶(unlit)同一份注入通用,与 rawCore 的做法一致。
 */
export function injectStickerOutline(mats: readonly StickerMaterial[]): OutlineUniform {
  const uOutlineColor: OutlineUniform = { value: new THREE.Color(OUTLINE_DEFAULT) };
  for (const mat of mats) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uOutlineColor = uOutlineColor;
      shader.uniforms.uOutlineSdf = uOutlineSdf;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aOutline;
          varying float vOutline;
          varying vec2 vOutlinePos;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vOutline = aOutline;
          vOutlinePos = position.xy;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec3 uOutlineColor;
          uniform vec2 uOutlineSdf;
          varying float vOutline;
          varying vec2 vOutlinePos;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          if (vOutline > 0.5) {
            vec2 q = abs(vOutlinePos) - vec2(uOutlineSdf.x);
            float sdf = min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - uOutlineSdf.y;
            if (sdf > ${(-OUTLINE_WIDTH).toFixed(3)}) diffuseColor.rgb = uOutlineColor;
          }`,
        );
    };
    // 注入过的材质与没注入过的不能共用同一份编译结果。
    mat.customProgramCacheKey = () => 'sticker-outline';
  }
  return uOutlineColor;
}
