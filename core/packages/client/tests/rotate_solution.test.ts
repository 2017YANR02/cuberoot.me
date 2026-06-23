import { describe, it, expect } from 'vitest';
import { CubieCube } from '@/lib/roux/CubeLib';
import { rotateSolutionY } from '@/lib/rotate-solution';

// 末态串(纯比较 cubie 状态)。
const state = (alg: string) => new CubieCube().apply(alg).serialize();

const Y_PREFIX = ['', 'y', 'y2', "y'"];

const FACES = ['U', 'D', 'L', 'R', 'F', 'B'];
const SUFFIX = ['', "'", '2'];
function randAlg(len: number, seed: () => number): string {
  const out: string[] = [];
  let prev = '';
  for (let i = 0; i < len; i++) {
    let f = FACES[Math.floor(seed() * FACES.length)];
    while (f === prev) f = FACES[Math.floor(seed() * FACES.length)];
    prev = f;
    out.push(f + SUFFIX[Math.floor(seed() * SUFFIX.length)]);
  }
  return out.join(' ');
}
// 确定性 LCG,避免依赖 Math.random。
function lcg(s: number) { let x = s >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 0x100000000; }; }

describe('rotateSolutionY', () => {
  it('n=0 原样返回', () => {
    expect(rotateSolutionY("R U R' U'", 0)).toBe("R U R' U'");
    expect(rotateSolutionY('', 1)).toBe('');
  });

  it('显示串以对应预转体开头', () => {
    expect(rotateSolutionY("R U R'", 1).startsWith('y ')).toBe(true);
    expect(rotateSolutionY("R U R'", 2).startsWith('y2 ')).toBe(true);
    expect(rotateSolutionY("R U R'", 3).startsWith("y' ")).toBe(true);
  });

  it('已知样例:R U R\' 加 y 等价于 y B U B\'(整体效果 = R U R\' y)', () => {
    const rot = rotateSolutionY("R U R'", 1);
    expect(state(rot)).toBe(state("R U R' y"));
  });

  it('随机解法:y^n 重写后整体效果 == 原解 + y^n(同一个十字,末态多转 y^n)', () => {
    const rng = lcg(12345);
    for (let t = 0; t < 200; t++) {
      const len = 4 + Math.floor(rng() * 8);
      const A = randAlg(len, rng);
      for (let k = 1; k <= 3; k++) {
        const rot = rotateSolutionY(A, k);
        expect(state(rot)).toBe(state(`${A} ${Y_PREFIX[k]}`));
      }
    }
  });

  it('带前导转体:y 插在转体之后,前缀原样保留(z F\' … → z y …)', () => {
    expect(rotateSolutionY("z F' U B' L' R' F L2 R2", 1).startsWith('z y ')).toBe(true);
    expect(rotateSolutionY("x' D' F2 L' R2 U L' B", 2).startsWith("x' y2 ")).toBe(true);
    expect(rotateSolutionY("x' y R U R'", 3).startsWith("x' y y' ")).toBe(true);
  });

  it('带前导转体:整体效果 == 前缀 + body + y^n,且前缀留在开头', () => {
    const rng = lcg(54321);
    const prefixes = ['z', "x'", 'z2', "x' y"];
    for (const pre of prefixes) {
      for (let t = 0; t < 40; t++) {
        const A = `${pre} ${randAlg(4 + Math.floor(rng() * 6), rng)}`;
        for (let k = 1; k <= 3; k++) {
          const rot = rotateSolutionY(A, k);
          expect(state(rot)).toBe(state(`${A} ${Y_PREFIX[k]}`));
          expect(rot.startsWith(`${pre} `)).toBe(true);
        }
      }
    }
  });

  it('面转动数不变(预转体不计入步数)', () => {
    const count = (s: string) => s.replace(/^([xyz][2']?\s+)+/, '').split(/\s+/).filter(Boolean).length;
    const rng = lcg(999);
    for (let t = 0; t < 50; t++) {
      const A = randAlg(6 + Math.floor(rng() * 6), rng);
      for (let k = 1; k <= 3; k++) {
        expect(count(rotateSolutionY(A, k))).toBe(count(A));
      }
    }
  });
});
