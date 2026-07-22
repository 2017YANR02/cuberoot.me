/**
 * Server-side iso render for sq1 / megaminx / pyraminx / skewb via the /sim
 * engine (PLAN-sr-retirement Phase 4) — replaces the sr-puzzlegen path.
 *
 * Headless: builds the client engine's `World`(Phase 1 已 gate/DI:无 DOM /
 * rAF / WebGL 依赖,vitest node + tests/engine_headless.test.ts 锁死),applies
 * the alg via each puzzle's `twister.setup()`(全拼图统一入口,同 /sim 回放),
 * then exports the schematic SVG(与 /sim 伴图同一导出器 → 同一观感,天然与
 * client 端一致,不再有 sr 的 SR_ANGLE_BASE 手工标定层)。
 *
 * Import path: `@/*` → client 树(server tsconfig paths;tsx dev 与 esbuild
 * bundle 都原生吃 tsconfig paths)。Worker/指针/手全部不在此路径(懒 import /
 * 注入槽,Phase 1 报告)。
 *
 * `r=y30x-30`(shared 语法)叠加在引擎默认视角上(scene.rotation 欧拉),语义
 * = /sim 里把魔方往相应方向拖 —— 与 sr 的 rotations 不同源,消费方切换时按缓存
 * 规则 bump `v=`(见 cube.ts)。
 */
import World from '@/app/[lang]/sim/engine/world';
import { exportSimSvgSchematic, hasSchematicFacelets } from '@/app/[lang]/sim/sim_svg_export_schematic';
import { sizeEngineSvg } from '@/lib/puzzle-image/engine-svg';
import { parseViewRotations } from '@cuberoot/shared/sr-rotations';
import { canonicalSq1Alg } from '@cuberoot/shared/sq1-notation';

type Puzzle = 'sq1' | 'megaminx' | 'pyraminx' | 'skewb';

const KIND: Record<Puzzle, 'sq1' | 'megaminx' | 'pyraminx' | 'skewb'> = {
  sq1: 'sq1', megaminx: 'megaminx', pyraminx: 'pyraminx', skewb: 'skewb',
};

/** World 复用池:World 构造(几何建构)贵,按拼图缓存;twister.setup 每次从
 *  solved 重放 → 无状态泄漏。单请求串行(hono handler await 内同步跑完)。 */
let world: World | null = null;
function getWorld(puzzle: Puzzle): World {
  if (!world) world = new World();
  if (world.puzzleKind !== KIND[puzzle]) world.setPuzzle(KIND[puzzle]);
  return world;
}

export function renderEngineIsoSVG(
  puzzle: Puzzle,
  alg: string,
  rotationsParam: string | undefined,
  size: number,
): string | null {
  try {
    const w = getWorld(puzzle);

    // 视角:引擎默认(π/6, −π/4+π/16,与 /sim 一致)+ r= 偏转叠加。
    w.scene.rotation.set(Math.PI / 6, -Math.PI / 4 + Math.PI / 16, 0);
    for (const p of parseViewRotations(rotationsParam).slice(0, 2)) {
      const rad = (p.angle * Math.PI) / 180;
      if (p.axis === 'x') w.scene.rotation.x += rad;
      else if (p.axis === 'y') w.scene.rotation.y += rad;
      else w.scene.rotation.z += rad;
    }
    w.scene.updateMatrix();
    // 导出器坐标域 = 屏幕像素(衬底封缝 stroke-width=1px、viewBox 裁剪余量都以 px
    // 计),所以视口必须给真实像素尺寸 —— 1×1 会让投影域缩到 ~1 单位,1px 描边
    // 直接把整图吞成剪影(2026-07-21 实测黑团根因)。
    w.width = size; w.height = size;
    w.resize(); // 1:1 视口取景(相机距离/FOV 按拼图 refHalf)
    // headless 没有 renderer.render() 帧循环(它才会隐式刷新 matrixWorld);相机
    // matrixWorld 不刷 = camPos 读成原点 → 背面剔除全灭只剩衬底剪影。手动刷。
    w.camera.updateMatrixWorld(true);

    const trimmed = (alg ?? '').trim();
    const norm = puzzle === 'sq1' && trimmed ? canonicalSq1Alg(trimmed) : trimmed;
    const tw = (w.cube as { twister: { setup(exp: string): void; finish(): void } }).twister;
    tw.setup(norm); // 从 solved 重放;tweener headless 下无 rAF,setup 内 finish 瞬时到位
    tw.finish();
    w.scene.updateMatrixWorld(true);

    if (!hasSchematicFacelets(w.scene)) return null;
    const svg = exportSimSvgSchematic({
      world: w,
      inset: 0.15,          // /sim 面板「黑边」默认(imgOutline 15)
      bodyColor: '#000000',
      bodyOpacity: 100,
      stickerOpacity: 100,
    });
    return sizeEngineSvg(svg, size);
  } catch (err) {
    console.warn('[engine_render] failed', puzzle, err);
    return null;
  }
}
