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
import type { NetFaceLetter } from './sim_net_export';

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

/** NxN 俯视 OLL 图 —— 由 visualcube 本体渲染,状态来自引擎。 */
export function exportSimPlanSvg(opts: SimPlanExportOptions): string {
  const N = Math.max(1, Math.round(opts.order));
  const fc = opts.faceColors;

  // serialize() 下标 = stickerColors 下标(恒等,见文件头核验)。
  const stickerColors: string[] = [];
  for (let i = 0; i < 6 * N * N; i++) {
    const ch = opts.serialized[i] ?? '';
    stickerColors.push(FACE_LETTERS.includes(ch) ? fc[ch as NetFaceLetter] : '#444');
  }

  // 旋钮基座:有 spec 走 studio 单一源;无 spec 退纯默认方形。
  const base: ICubeOptions = opts.spec
    ? specToCubeOptions(opts.spec)
    : { cubeSize: N, width: opts.size ?? 256, height: opts.size ?? 256 };

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
