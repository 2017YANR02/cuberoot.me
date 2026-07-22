// 引擎驱动的 NxN 俯视图(plan)导出器 —— 退役对照表 §2b「视图 plan」。
//
// **不再手工复刻几何:直接调 visualcube 自己的 renderCubeSVG({view:'plan'})**,把引擎实时状态
// 当 `stickerColors` 喂进去。这样 SVG 与 /visualcube studio 的 plan 输出按构造逐字节同款
// (同外框 outlineWidth+0.1 描边、同 0.85/0.94 内缩、同 OLL 0.2 外推、同分组与不透明度),
// 不存在"看着像"的偏差。先前两版(平矩形版、手工投影版)都因手抄几何而与原版不一致,已废。
//
// 唯一需要证明的是**索引空间**:引擎 serialize() 的 6N² 字符串(块序 U R F D L B、块内
// row-major)与 visualcube stickerColors 的下标空间是否 1:1。已用「逐 facelet 单点着色 →
// 比对白格质心」在 N=3 全 54 位上核验为恒等映射(tests/sim_plan_export.test.ts)。
import { renderCubeSVG } from '@cuberoot/visualcube';
import type { NetFaceLetter } from './sim_net_export';

export interface SimPlanExportOptions {
  /** 引擎 Cube.serialize():6N² 个面字母,块序 U R F D L B,块内 row-major。 */
  serialized: string;
  order: number;
  faceColors: Record<NetFaceLetter, string>;
  background?: string | null;
  /** 输出 <svg> 的 width/height(PuzzleImage 会再用 sizeEngineSvg 钉成显示尺寸)。 */
  size?: number;
}

const FACE_LETTERS = 'URFDLB';

/** NxN 俯视 OLL 图 —— 由 visualcube 本体渲染,状态来自引擎。 */
export function exportSimPlanSvg(opts: SimPlanExportOptions): string {
  const N = Math.max(1, Math.round(opts.order));
  const size = opts.size ?? 256;
  const fc = opts.faceColors;

  // serialize() 下标 = stickerColors 下标(恒等,见文件头核验)。
  const stickerColors: string[] = [];
  for (let i = 0; i < 6 * N * N; i++) {
    const ch = opts.serialized[i] ?? '';
    stickerColors.push(FACE_LETTERS.includes(ch) ? fc[ch as NetFaceLetter] : '#444');
  }

  return renderCubeSVG({
    cubeSize: N,
    view: 'plan',
    width: size,
    height: size,
    stickerColors,
    ...(opts.background ? { backgroundColor: opts.background } : {}),
  });
}
