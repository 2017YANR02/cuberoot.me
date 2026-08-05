// lib/pocket-facelet 的转体扩展:applyPocketRotation / applyPocketAlg / pocketCaseKey。
//
// 判据仍然是外部的,不自证:
//   · x/y/z 的面像用「对面同向转」这条独立定义验(x = R L'、y = U D'、z = F B'),
//     而实现是从 POCKET_ROTATIONS 里按面像认出来的 —— 两条路互不引用。
//   · 转体不改变最优步数(solvePocketFacelet),也不改变「解没解开」。
//   · pocketCaseKey 的判据是它自己的定义:两态同 key ⟺ 差一个整体转体。
import { describe, it, expect } from 'vitest';
import {
  solvedPocketState, pocketStateToFacelet, applyPocketMoves, applyPocketAlg,
  applyPocketRotation, pocketCaseKey, POCKET_ROTATIONS, rotatePocketState,
  solvePocketFacelet,
  type PocketRotationAxis,
} from '@/lib/pocket-facelet';

/** 转体的独立定义:对面同向转。 */
const AXIS_AS_FACE_TURNS: Record<PocketRotationAxis, string> = {
  x: "R L'",
  y: "U D'",
  z: "F B'",
};

const solved = solvedPocketState();
const facelet = (alg: string, start = solved) => pocketStateToFacelet(applyPocketAlg(start, alg));

describe('整体转体 x / y / z', () => {
  it('每个轴一步 = 对面同向转(逐格相等)', () => {
    for (const axis of ['x', 'y', 'z'] as PocketRotationAxis[]) {
      const viaRotation = pocketStateToFacelet(applyPocketRotation(solved, axis, 1));
      const viaTurns = pocketStateToFacelet(applyPocketMoves(solved, AXIS_AS_FACE_TURNS[axis]));
      expect(viaRotation, axis).toBe(viaTurns);
    }
  });

  it('转体作用在乱态上也逐格等于对面同向转', () => {
    const scrambled = applyPocketMoves(solved, "R U' F2 R2 U R' F");
    for (const axis of ['x', 'y', 'z'] as PocketRotationAxis[]) {
      for (const amount of [1, 2, 3]) {
        const word = Array.from({ length: amount }, () => AXIS_AS_FACE_TURNS[axis]).join(' ');
        expect(
          pocketStateToFacelet(applyPocketRotation(scrambled, axis, amount)),
          `${axis}${amount}`,
        ).toBe(pocketStateToFacelet(applyPocketMoves(scrambled, word)));
      }
    }
  });

  it('每个轴转 4 次回到原状', () => {
    for (const axis of ['x', 'y', 'z'] as PocketRotationAxis[]) {
      expect(pocketStateToFacelet(applyPocketRotation(solved, axis, 4 as number)), axis)
        .toBe(pocketStateToFacelet(solved));
    }
  });

  it('转体不改变最优步数', () => {
    const scramble = "R U2 F' R2 U' F R'";
    const base = solvePocketFacelet(facelet(scramble)).length;
    for (const pose of ['x', 'y2', "z'", "x y'", 'y x2 z']) {
      expect(solvePocketFacelet(facelet(`${pose} ${scramble}`)).length, pose).toBe(base);
    }
  });
});

describe('applyPocketAlg', () => {
  it('纯转体串仍是还原态(六面各自单色 —— 转过朝向的还原态 facelet 串不等于 solved)', () => {
    for (const pose of ['x', "y'", 'z2', "x y' z", 'y x y x y x']) {
      const f = facelet(pose);
      for (let i = 0; i < 24; i += 4) {
        expect(new Set(f.slice(i, i + 4)).size, `${pose} @${i}`).toBe(1);
      }
    }
  });

  it('中途的转体会改写后续每一步转哪个面', () => {
    // y 之后的 R 打的是原来的 B 面 —— 若实现把 y 丢掉,这两串就会相等。
    expect(facelet('y R')).not.toBe(facelet('R'));
    expect(facelet('y R')).toBe(facelet("B U D'"));
  });

  it('公式 + 它的逆 = 恒等(含转体)', () => {
    for (const alg of ["y R U R' U R U2' R'", "x R2 U2 R2", "z' F R U' R' F'", "y2 R2 B2 U' R2 U R2"]) {
      const round = applyPocketAlg(applyPocketAlg(solved, alg), invertPocketAlgWithRotations(alg));
      expect(pocketStateToFacelet(round), alg).toBe(pocketStateToFacelet(solved));
    }
  });

  it('认不出来的 token 抛错,不静默吞', () => {
    expect(() => applyPocketAlg(solved, 'R M U')).toThrow('M');
    expect(() => applyPocketAlg(solved, 'Rw')).toThrow();
  });
});

/** invertPocketAlg 只认六面;转体串的逆在这里就地写一份(测试自用,不进 lib)。 */
function invertPocketAlgWithRotations(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).reverse()
    .map((t) => (t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0, -1) : `${t}'`))
    .join(' ');
}

describe('pocketCaseKey', () => {
  it('还原态的 key 与「转过朝向的还原态」相同', () => {
    const k = pocketCaseKey(solved);
    for (const rot of POCKET_ROTATIONS) {
      expect(pocketCaseKey(rotatePocketState(solved, rot))).toBe(k);
    }
  });

  // 尾随转体只改朝向不改 case —— 表里公式常以 `y'` 之类收尾/起手,反推出来的 case 态
  // 因此会带一个整体朝向差,key 必须把它折掉。
  it('公式尾随整体转体,key 不变', () => {
    const a = applyPocketAlg(solved, "R U R' U R U2' R'");
    for (const pose of ['y', "x'", 'z2', "y x'", 'x y2 z']) {
      const b = applyPocketAlg(solved, `R U R' U R U2' R' ${pose}`);
      expect(pocketCaseKey(b), pose).toBe(pocketCaseKey(a));
    }
  });

  it('差一个 AUF 不是同一个 case', () => {
    const a = applyPocketAlg(solved, "R U R' U R U2' R'");
    const b = applyPocketAlg(solved, "U R U R' U R U2' R'");
    expect(pocketCaseKey(a)).not.toBe(pocketCaseKey(b));
  });

  it('key 恰好把 24 个朝向折成 1 个:随机态的朝向轨道大小整除 24', () => {
    const scrambled = applyPocketMoves(solved, "R U' F2 R2 U R' F U2 R");
    const keys = new Set(POCKET_ROTATIONS.map((r) => pocketCaseKey(rotatePocketState(scrambled, r))));
    expect(keys.size).toBe(1);
    const facelets = new Set(POCKET_ROTATIONS.map((r) => pocketStateToFacelet(rotatePocketState(scrambled, r))));
    expect(24 % facelets.size).toBe(0);
  });
});
