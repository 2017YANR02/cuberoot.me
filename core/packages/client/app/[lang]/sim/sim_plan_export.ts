// 引擎驱动的 NxN 俯视图(plan)导出器 —— 退役对照表 §2b「视图 plan」。
//
// **不再手工复刻几何:直接调 visualcube 自己的 renderCubeSVG({view:'plan'})**,把引擎实时状态
// 当 `stickerColors` 喂进去。这样 SVG 与 /visualcube studio 的 plan 输出按构造逐字节同款
// (同外框 outlineWidth+0.1 描边、同 0.85/0.94 内缩、同 OLL 0.2 外推、同分组与不透明度),
// 不存在"看着像"的偏差。先前两版(平矩形版、手工投影版)都因手抄几何而与原版不一致,已废。
//
// **渲染旋钮走 studio 单一源**:plan 是透视投影,面板大小随 `dist` 变(透视滑块);
// stickerOpacity / cubeOpacity / 壳色 / 背景 / 旋转同样影响输出。这些一律复用
// `specToCubeOptions(spec)`(与 VC 路 renderSpecSvg 同一份映射),companion 只把
// 状态换成引擎实时态:覆盖 stickerColors、清 alg(实时态已烙进颜色,不能再被 alg
// 二次置换)、钉 view=plan。故任意 dist/opacity 下 engine 与 VC 逐字节同。
//
// 索引空间已核验:引擎 serialize() 的 6N² 串(块序 U R F D L B、块内 row-major)与
// visualcube stickerColors 下标 1:1 恒等(tests/sim_plan_export.test.ts)。
import { renderCubeSVG, type ICubeOptions } from '@cuberoot/visualcube';
import { specToCubeOptions } from '@/lib/puzzle-image/render';
import type { ImageSpec } from '@/lib/puzzle-image/types';
import type { NetFaceLetter } from '@/lib/cube-net-svg';

export interface SimPlanExportOptions {
  /** 引擎 Cube.serialize():6N² 个面字母,块序 U R F D L B,块内 row-major。 */
  serialized: string;
  order: number;
  faceColors: Record<NetFaceLetter, string>;
  /** studio 渲染旋钮的单一源:dist / opacity / 壳 / 背景 / 旋转全从这里取(经
   *  specToCubeOptions),保证与 VC 路(renderSpecSvg)逐字节同。省略 = 纯默认。 */
  spec?: ImageSpec;
  background?: string | null;
  /** 输出 <svg> 的 width/height(PuzzleImage 会再用 sizeEngineSvg 钉成图片尺寸)。
   *  省略时用 spec.imageSize(经 specToCubeOptions),与 studio 一致。 */
  size?: number;
}

const FACE_LETTERS = 'URFDLB';

/** Fill for a sticker the engine reports as not-a-face (a stickering hid it). Same grey
 *  the net exporter and the 3D cube use. */
const IGNORED_STICKER_FILL = '#444';

/** stickerColors 下标里侧环那一圈:R F L B 四面的第 0 行(挨着 U 的那排)。
 *  面序 U R F D L B(visualcube AllFaces),面内 row-major —— 与 renderOLLStickers
 *  取的 (face, row 0, col i) 同一套下标。 */
function rimIndices(N: number): number[] {
  const out: number[] = [];
  for (const faceIdx of [1, 2, 4, 5]) {
    for (let i = 0; i < N; i++) out.push(faceIdx * N * N + i);
  }
  return out;
}

/** NxN 俯视 OLL 图 —— 由 visualcube 本体渲染,状态来自引擎。 */
export function exportSimPlanSvg(opts: SimPlanExportOptions): string {
  const N = Math.max(1, Math.round(opts.order));
  const fc = opts.faceColors;

  // serialize() 下标 = stickerColors 下标(恒等,见文件头核验)。
  const stickerColors: string[] = [];
  for (let i = 0; i < 6 * N * N; i++) {
    const ch = opts.serialized[i] ?? '';
    stickerColors.push(FACE_LETTERS.includes(ch) ? fc[ch as NetFaceLetter] : IGNORED_STICKER_FILL);
  }

  // 旋钮基座:有 spec 走 studio 单一源;无 spec 退纯默认方形。
  const base: ICubeOptions = opts.spec
    ? specToCubeOptions(opts.spec)
    : { cubeSize: N, width: opts.size ?? 256, height: opts.size ?? 256 };

  // 「隐去侧面灰格」:引擎路的灰是引擎自己的 IGNORED_STICKER_FILL,不是 spec 的 mkc
  // (stickerColors 已被实时态整体覆盖)。这里只把**侧环那 12 个下标**置透明 ——
  // 渲染器本来就跳过 transparent,顶面的灰因此一格不动、色值也不动。spec 自带的
  // stage 遮罩灰仍由渲染器按 maskColor 比对,两个来源各走各的、互不干扰。
  if (base.hideGreySides) {
    for (const i of rimIndices(N)) {
      if (stickerColors[i] === IGNORED_STICKER_FILL) stickerColors[i] = 'transparent';
    }
  }

  const cubeOpts: ICubeOptions = {
    ...base,
    cubeSize: N,
    view: 'plan',
    stickerColors,
    // 实时态已在 stickerColors 里,清掉 alg 防二次置换(specToCubeOptions 会按
    // spec.algorithm 填这两个)。
    algorithm: undefined,
    case: undefined,
    ...(opts.size ? { width: opts.size, height: opts.size } : {}),
    ...(opts.background ? { backgroundColor: opts.background } : {}),
  };
  return renderCubeSVG(cubeOpts);
}
