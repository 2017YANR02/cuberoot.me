/**
 * LSLL 模型回归:
 *  1. 计数锁定:42 大类枚举总和 = 583,284(Burnside 推导 + 独立暴力验证过的数)。
 *  2. cubie 模型 ↔ cubing.js 全状态一致(位置映射 + ori 约定)。
 *  3. toFacelets ↔ visualcube fd 渲染字节一致。
 *  4. canonical key 对前/后 AUF 不变;定位、自测、编解码闭环。
 */
import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { renderFromSimpleQuery, renderCubeSVG } from '@cuberoot/visualcube';
import {
  applyAlg, solvedCube, toFacelets, extractLsll, CUBING_CORNER_INDEX, CUBING_EDGE_INDEX,
} from '@/lib/lsll/cube333';
import {
  CATEGORIES, TOTAL_CASES, enumerateCategory, locateFromScramble, canonicalKey,
  decodeKey, keyToString, keyFromString, unpackState, classify, verifyCaseAlg,
} from '@/lib/lsll/model';

const SETUPS = [
  "R U R' U'", "R U' R' U2", "F' U F U'", "R U2 R' U' F' U' F",
  "R U R' U' R U R' U'", "F' U2 F U R U R'",
];

describe('lsll counts', () => {
  it('per-category counts and grand total', () => {
    let total = 0;
    for (const cat of CATEGORIES) {
      const n = enumerateCategory(cat.slug).length;
      expect(n, cat.slug).toBe(cat.count);
      total += n;
    }
    expect(total).toBe(TOTAL_CASES);
    expect(TOTAL_CASES).toBe(583284);
  }, 120_000);
});

describe('cubie model vs cubing.js', () => {
  it('states agree through the probe maps', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const alg of [...SETUPS, 'U', 'R', 'F', 'D', 'L', 'B', "B2 L D' R F' U2 B' R2 L'"]) {
      const mine = applyAlg(solvedCube(), alg);
      const cd = kpuzzle.defaultPattern().applyAlg(new Alg(alg)).patternData;
      for (let i = 0; i < 8; i++) {
        const ci = CUBING_CORNER_INDEX[i];
        expect(CUBING_CORNER_INDEX.indexOf(cd.CORNERS.pieces[ci] as never), alg).toBe(mine.cp[i]);
        expect(cd.CORNERS.orientation[ci], alg).toBe(mine.co[i]);
      }
      for (let i = 0; i < 12; i++) {
        const ei = CUBING_EDGE_INDEX[i];
        expect(CUBING_EDGE_INDEX.indexOf(cd.EDGES.pieces[ei] as never), alg).toBe(mine.ep[i]);
        expect(cd.EDGES.orientation[ei], alg).toBe(mine.eo[i]);
      }
    }
  });
});

describe('facelets vs visualcube', () => {
  it('renders byte-identical SVG', () => {
    for (const alg of SETUPS.slice(0, 3)) {
      const a = renderFromSimpleQuery({ setup: alg, view: 'iso', size: '128' });
      const b = renderCubeSVG({ width: 128, height: 128, cubeSize: 3, facelets: toFacelets(applyAlg(solvedCube(), alg)).split('') });
      expect(b, alg).toBe(a);
    }
  });
});

describe('canonical key + locate + verify', () => {
  it('key invariant under pre/post AUF', () => {
    for (const s of SETUPS) {
      const base = locateFromScramble(s);
      const post = locateFromScramble(`${s} U`);
      const pre = locateFromScramble(`U ${s}`);
      expect(base.ok && post.ok && pre.ok).toBe(true);
      if (base.ok && post.ok && pre.ok) {
        expect(post.key).toBe(base.key);
        expect(pre.key).toBe(base.key);
      }
    }
  });

  it("R U R' U' lands in family A+ (zbls letter mapping)", () => {
    const r = locateFromScramble("R U R' U'");
    expect(r.ok && r.category.letter).toBe('A+');
  });

  it('rejects non-LSLL scrambles with broken piece names', () => {
    const r = locateFromScramble('D R2');
    expect(!r.ok && r.reason).toBe('not-lsll');
  });

  it('key string round-trips and decodes valid states', () => {
    const r = locateFromScramble("R U2 R' U' F' U' F");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const back = keyFromString(keyToString(r.key));
    expect(back).toBe(r.key);
    const st = decodeKey(r.key);
    expect(st).not.toBeNull();
    expect(canonicalKey(st!)).toBe(r.key);
  });

  it('verifyCaseAlg accepts the inverse alg up to AUF', () => {
    // setup 的逆解 setup 态;canonical 代表与 setup 态差一个 AUF,
    // 允许用户式的前置 U 调整(0..3 里必有一个命中)。
    const setupState = extractOf("R U R' U'");
    expect(verifyCaseAlg(setupState, "U R U' R'").ok).toBe(true);
    expect(verifyCaseAlg(setupState, "R U R' F'").ok).toBe(false);

    const canon = unpackState(canonicalKey(setupState));
    expect(classify(canon).category.letter).toBe('A+');
    const hit = ['', 'U ', 'U2 ', "U' "].some((p) => verifyCaseAlg(canon, `${p}U R U' R'`).ok);
    expect(hit).toBe(true);
  });
});

/** setup → LsllState(测试内已知合法)。 */
function extractOf(setup: string) {
  const got = extractLsll(applyAlg(solvedCube(), setup));
  if ('broken' in got) throw new Error('bad fixture setup');
  return got.state;
}
