/**
 * 智能魔方实况展开图 —— 画的必须是魔方真正的状态。
 * =========================================================================
 *
 * 实况小窗现在默认画展开图(六个面都在,能逐面和手里的魔方对；上游 csTimer 也
 * 只有这一种)。渲染器是全站共用的那一份(`lib/cube-net-svg` → shared 的
 * `renderUnfoldedStateSvg`),所以布局/描边/字节格式天然与打乱预览一致。
 *
 * 真正会悄悄错掉的是**贴纸映射**:URFDLB 串的第 k 个字符该落在展开图哪一格。
 * L/B 面在内部 posit 里是水平镜像、D 面是垂直镜像,一旦把这层搞反,复原态照样
 * 看不出问题 —— 六个面各自纯色 —— 只有打乱之后才错,而且错得很像是「魔方状态
 * 读错了」。已有的 parity 测试只锁复原态,所以这里按**打乱态**逐字节对照
 * tnoodle 参照实现(`renderUnfoldedSvgForEvent`,即打乱预览用的那条路)。
 *
 * 喂进去的串来自计时器自己的跟踪器模型(`applyMoves` + `toFaceletString`),
 * 也就是蓝牙链路真正推给小窗的那个串,所以这条测试同时锁住了两端的约定。
 */
import { describe, it, expect } from 'vitest';
import { renderUnfoldedSvgForEvent } from '@cuberoot/shared/cube-unfolded-svg';
import { renderCubeNetSvg } from '@/lib/cube-net-svg';
import { CUBE_FILL } from '@/lib/cube-colors';
import { applyMoves, solved, toFaceletString } from '@/app/[lang]/timer/_lib/cube/state';
import { parseScrambleStrict } from '@/app/[lang]/timer/_lib/cube/moves';

/** The string the bluetooth tracker hands the live window for this scramble. */
function trackedFacelets(scramble: string): string {
  const { moves, bad } = parseScrambleStrict(scramble);
  expect(bad).toEqual([]);
  return toFaceletString(applyMoves(solved(3), 3, moves));
}

const SCRAMBLES = [
  '',                                    // solved — the case the old test covered
  'R',                                   // one turn: catches a swapped face
  "L'",                                  // L is horizontally mirrored internally
  'B2',                                  // so is B
  'D',                                   // D is vertically mirrored internally
  'U',
  "R U R' U'",
  "F R U' R' U' R U R' F' R U R' U' R' F R F'",   // OLL 14, both wide-ish blocks
  "D2 R' D' F2 B D R2 D2 R' F2 D' F2 U' B2 L2 U2 D R2 U",
];

describe('live smart-cube net', () => {
  it('matches the tnoodle reference net sticker for sticker, byte for byte', () => {
    for (const scramble of SCRAMBLES) {
      const reference = renderUnfoldedSvgForEvent('333', scramble)!;
      const live = renderCubeNetSvg({
        serialized: trackedFacelets(scramble),
        order: 3,
        faceColors: CUBE_FILL,
      });
      expect(live, `net differs from the reference for "${scramble || 'solved'}"`).toBe(reference);
    }
  });

  it('draws 54 stickers and only the six WCA colours', () => {
    const svg = renderCubeNetSvg({
      serialized: trackedFacelets("R U R' U'"), order: 3, faceColors: CUBE_FILL,
    });
    const fills = svg.match(/fill="#[0-9A-Fa-f]{6}"/g) ?? [];
    // Exactly the 54 stickers: the emitter paints no backdrop of its own.
    expect(fills.length).toBe(54);
    const used = new Set(fills.map((f) => f.slice(6, 13)));
    for (const c of used) expect(Object.values(CUBE_FILL)).toContain(c);
    // Every face colour must appear — a mapping that collapsed a face would
    // otherwise pass everything above.
    for (const c of Object.values(CUBE_FILL)) expect(used).toContain(c);
  });

  it('shows nine of each colour, whatever the scramble', () => {
    // The invariant a state renderer cannot violate: turning moves stickers, it
    // does not create or destroy them. Catches an index that reads the same
    // sticker twice — which a byte-identical comparison would also catch, but
    // this says out loud what "correct" means here.
    for (const scramble of SCRAMBLES) {
      const svg = renderCubeNetSvg({
        serialized: trackedFacelets(scramble), order: 3, faceColors: CUBE_FILL,
      });
      for (const [face, colour] of Object.entries(CUBE_FILL)) {
        const n = (svg.match(new RegExp(`fill="${colour}"`, 'g')) ?? []).length;
        expect(n, `${face} count for "${scramble || 'solved'}"`).toBe(9);
      }
    }
  });
});
