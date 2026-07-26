// 立体涂色画板(`_Interactive3DPuzzle`)靠的那条等价关系:
//
//   引擎贴纸 `userData.stickerKey`  ──ENGINE_SID_MAP⁻¹──▶  canonical sid (`F3` / `U0`)
//                                   ──face×perFace+slot──▶  求解器 facelet 下标
//
// 画板只做一次查表就把「点到的贴纸」变成「facelet 的第几格」。这里锁住两头:
//   ① 表对这两个拼图是**双射**到 0..size−1 —— 少一格 = 有贴纸点不动(静默!),
//      多一格 / 撞格 = 点一处涂两处;
//   ② canonical 面序确实是求解器的面序(PYRA_FACES / SKEWB_FACES),
//      每面槽数确实是求解器的 SLOTS_PER_FACE。
//
// 表本身(sid → stickerKey)由几何派生、由 engine-mask.test.ts 重推比对;本文件不重复那件事,
// 只管「派生表 + canonical id 空间 == facelet 空间」这一步 —— 画板的正确性全押在它上面。
import { describe, it, expect } from 'vitest';
import { CANONICAL_FACES, parseStickerId } from '@/lib/puzzle-image/mask-core';
import { ENGINE_SID_MAP } from '@/lib/puzzle-image/puzzle-mask';
import { PYRA_FACES, PYRA_SLOTS_PER_FACE, PYRA_STICKERS } from '@/lib/pyraminx-solver';
import { SKEWB_FACES, SKEWB_SLOTS_PER_FACE, SKEWB_STICKERS } from '@/lib/skewb-solver';

const CASES = [
  {
    puzzle: 'pyraminx' as const,
    faces: PYRA_FACES as readonly string[],
    perFace: PYRA_SLOTS_PER_FACE,
    size: PYRA_STICKERS,
  },
  {
    puzzle: 'skewb' as const,
    faces: SKEWB_FACES as readonly string[],
    perFace: SKEWB_SLOTS_PER_FACE,
    size: SKEWB_STICKERS,
  },
];

describe('立体画板的 stickerKey → facelet 下标映射', () => {
  it.each(CASES)('$puzzle:canonical 面序 / 槽数 == 求解器的 facelet 空间', ({ puzzle, faces, perFace, size }) => {
    expect(CANONICAL_FACES[puzzle]).toEqual([...faces]);
    expect(faces.length * perFace).toBe(size);
  });

  it.each(CASES)('$puzzle:sid 表双射到 0..size−1', ({ puzzle, faces, perFace, size }) => {
    const table = ENGINE_SID_MAP[puzzle];
    expect(table).toBeDefined();

    const byIdx = new Map<number, string>();
    const byKey = new Map<string, number>();
    for (const [sid, key] of Object.entries(table)) {
      const parsed = parseStickerId(sid);
      expect(parsed, sid).not.toBeNull();
      const f = faces.indexOf(parsed!.face);
      expect(f, `${sid} 的面不在 ${puzzle} 的面序里`).toBeGreaterThanOrEqual(0);
      expect(parsed!.index, `${sid} 的槽号越界`).toBeLessThan(perFace);

      const idx = f * perFace + parsed!.index;
      expect(byIdx.has(idx), `facelet 下标 ${idx} 被 ${sid} 与 ${byIdx.get(idx)} 撞了`).toBe(false);
      byIdx.set(idx, sid);
      expect(byKey.has(key), `stickerKey ${key} 出现两次`).toBe(false);
      byKey.set(key, idx);
    }

    // 双射:每一格都有且只有一张贴纸。
    expect(byIdx.size).toBe(size);
    expect(byKey.size).toBe(size);
    for (let i = 0; i < size; i++) expect(byIdx.has(i), `facelet 第 ${i} 格没有对应贴纸`).toBe(true);
  });
});
