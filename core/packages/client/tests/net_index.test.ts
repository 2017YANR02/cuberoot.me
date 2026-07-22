// netIndex.ts —— NxN 展开图坐标 + HOME canonical sid 的纯函数锁。
//
// engineHomeSid 是 NxN 自由 facelet 遮罩(`U:0,2` DSL)灰化引擎伴图的键源
// (instanced.ts 给每贴纸槽位打的 HOME sid)。这里不经引擎渲染器,直接按面外层枚举
// (face f 的外层 = 对应固定坐标),证明它是「引擎 facelet ↔ mask-core canonical sid」
// 的双射:每面产出的 sid 集合 = 恰好该面全部 N² 个 index,无重、无缺、面字母正确。
import { describe, it, expect } from 'vitest';
import { engineHomeSid, netIndexOf, ENGINE_TO_VC_FACE, VC_FACE_LETTER } from '@/app/[lang]/sim/engine/nxn/netIndex';
import { FACE } from '@/app/[lang]/sim/engine/define';

/** face f 的外层 cubelet 网格坐标(与 cubelet.ts 建色规则同源:x=0→L, x=max→R, …)。 */
function outerLayer(face: number, N: number): Array<[number, number, number]> {
  const max = N - 1;
  const out: Array<[number, number, number]> = [];
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      switch (face) {
        case FACE.L: out.push([0, a, b]); break;
        case FACE.R: out.push([max, a, b]); break;
        case FACE.D: out.push([a, 0, b]); break;
        case FACE.U: out.push([a, max, b]); break;
        case FACE.B: out.push([a, b, 0]); break;
        case FACE.F: out.push([a, b, max]); break;
      }
    }
  }
  return out;
}

describe('engineHomeSid — canonical sid bijection over each face', () => {
  const FACES = [FACE.U, FACE.R, FACE.F, FACE.D, FACE.L, FACE.B];
  for (const N of [2, 3, 4, 5, 6, 7]) {
    it(`N=${N}: every face maps onto exactly its N² net ids, once each`, () => {
      const N2 = N * N;
      for (const face of FACES) {
        const letter = VC_FACE_LETTER[ENGINE_TO_VC_FACE[face]];
        const got = new Set<string>();
        for (const [x, y, z] of outerLayer(face, N)) {
          const init = x + y * N + z * N2;
          got.add(engineHomeSid(init, face, N));
        }
        // 恰好 {letter}{0..N²-1},每个一次
        const want = new Set(Array.from({ length: N2 }, (_, i) => `${letter}${i}`));
        expect(got).toEqual(want);
      }
    });
  }

  it('agrees with netIndexOf + face letter on concrete 3x3 anchors', () => {
    // U 面(y=max=2):init = x + 2·3 + z·9;netIndexOf U = z·3 + x。
    // U0 = (x0,z0), U2 = (x2,z0), U8 = (x2,z2)。
    expect(engineHomeSid(0 + 2 * 3 + 0 * 9, FACE.U, 3)).toBe('U0');
    expect(engineHomeSid(2 + 2 * 3 + 0 * 9, FACE.U, 3)).toBe('U2');
    expect(engineHomeSid(2 + 2 * 3 + 2 * 9, FACE.U, 3)).toBe('U8');
    // F 面(z=max=2):netIndexOf F = (max-y)·3 + x → F 顶排(y=2)= 0,1,2。
    expect(engineHomeSid(0 + 2 * 3 + 2 * 9, FACE.F, 3)).toBe('F0');
  });

  it('netIndexOf stays a per-face bijection onto 0..N²-1 (2..7)', () => {
    for (const N of [2, 3, 4, 5, 6, 7]) {
      const max = N - 1;
      for (const face of FACES) {
        const seen = new Set<number>();
        for (const [x, y, z] of outerLayer(face, N)) seen.add(netIndexOf(x, y, z, face, max, N));
        expect(seen.size).toBe(N * N);
        expect(Math.max(...seen)).toBe(N * N - 1);
        expect(Math.min(...seen)).toBe(0);
      }
    }
  });
});
