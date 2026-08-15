// 平面伴图(net / wca / plan)要跟着 /sim 的阶段遮罩走。
//
// 3D 那条路是渲染器按 slot 改色,伴图从 `cube.serialize()` 的逻辑态直出 —— 看不见那一层,
// 所以选了 OLL 时曾出现「大魔方灰了侧面,小图还是整颗满色」。这里锁三件事:
//   ① serialize() 的格序 = 标准 URFDLB facelet 序(独立 oracle:/predict 的 cube333 状态机,
//      与 /sim 引擎零共享代码);
//   ② serializeStickering() 的码逐格对齐 serialize(),且**跟着贴纸走** —— 打乱后某枚贴纸的
//      码 = 它本位那一格的码;
//   ③ 两个平面渲染器吃到码之后真的换色,且用的是 3D 同一份色值。
import { describe, it, expect } from 'vitest';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import {
  FM_IGNORED, FM_REGULAR, dimFaceletColor, faceletDisplayColor, stickeringMaskFn,
} from '@/app/[lang]/sim/engine/nxn/stickering';
import { exportSimPlanSvg } from '@/app/[lang]/sim/sim_plan_export';
import { renderCubeNetSvg } from '@/lib/cube-net-svg';
import { DEFAULTS } from '@/lib/puzzle-image/defaults';
import { solvedCube, applyAlg } from '@/lib/lsll/cube333';
import { stickerFacelet } from '@/app/[lang]/predict/_lib/challenge';

const FACE_COLORS = {
  U: '#ffffff', R: '#ff0000', F: '#00ff00', D: '#ffff00', L: '#ff9900', B: '#0000ff',
} as const;

const IGNORED_GREY = '#666666';

/** 独立 oracle:当前 facelet → 该贴纸的本位 facelet(/predict 的纯 TS 状态机)。 */
function homeFaceletMap(alg: string): Map<number, number> {
  const end = applyAlg(solvedCube(), alg);
  const m = new Map<number, number>();
  for (let p = 0; p < 8; p++) {
    for (let k = 0; k < 3; k++) {
      m.set(stickerFacelet(end, 'corner', p, k), stickerFacelet(solvedCube(), 'corner', p, k));
    }
  }
  for (let p = 0; p < 12; p++) {
    for (let k = 0; k < 2; k++) {
      m.set(stickerFacelet(end, 'edge', p, k), stickerFacelet(solvedCube(), 'edge', p, k));
    }
  }
  for (const c of [4, 13, 22, 31, 40, 49]) m.set(c, c);
  return m;
}

const ALGS = [
  '', 'R', "U'", 'F2',
  "R U R' U' R' F R F'",                          // 一个真 OLL 情况(U 色翻到侧面)
  "R U R' U' R' F R2 U' R' U' R U R' F'",         // T perm
];

const ollCodes = (alg: string): Uint8Array => {
  const cube = new Cube(3);
  if (alg) cube.twister.setup(alg);
  return cube.serializeStickering(stickeringMaskFn(3, 'OLL')!);
};

describe('Cube.serializeStickering', () => {
  it('serialize() 的格序就是标准 URFDLB facelet 序', () => {
    for (const alg of ALGS) {
      const cube = new Cube(3);
      if (alg) cube.twister.setup(alg);
      const home = homeFaceletMap(alg);
      const expected = Array.from({ length: 54 }, (_, f) => 'URFDLB'[Math.floor(home.get(f)! / 9)]).join('');
      expect(cube.serialize(), `alg=「${alg || '还原态'}」`).toBe(expected);
    }
  });

  it('还原态 OLL:U 面整面原色,侧面第一排全灰', () => {
    const codes = ollCodes('');
    for (let i = 0; i < 9; i++) expect(codes[i]).toBe(FM_REGULAR);
    // R F L B 四面的第 0 行(挨着 U 的那排)
    for (const faceIdx of [1, 2, 4, 5]) {
      for (let i = 0; i < 3; i++) expect(codes[faceIdx * 9 + i]).toBe(FM_IGNORED);
    }
  });

  it('码跟着贴纸走:打乱后每一格的码 = 它本位那一格的码', () => {
    const solved = ollCodes('');
    for (const alg of ALGS) {
      const codes = ollCodes(alg);
      const home = homeFaceletMap(alg);
      for (let f = 0; f < 54; f++) {
        expect(codes[f], `alg=「${alg || '还原态'}」facelet ${f}`).toBe(solved[home.get(f)!]);
      }
    }
  });

  it('原色的贴纸恒 9 枚(9 个末层块各一枚主贴纸),打乱不增不减', () => {
    for (const alg of ALGS) {
      expect(ollCodes(alg).filter((c) => c === FM_REGULAR)).toHaveLength(9);
    }
  });
});

describe('faceletDisplayColor', () => {
  it('灰档取 3D 同一个色值', () => {
    expect(faceletDisplayColor(FM_IGNORED, '#00ff00')).toBe(IGNORED_GREY);
  });
  it('原色档原样透传', () => {
    expect(faceletDisplayColor(FM_REGULAR, '#00ff00')).toBe('#00ff00');
  });
  it('dim = sRGB 分量减半,纯白特判(减半就跟 ignored 那档灰撞了)', () => {
    expect(dimFaceletColor('#00ff00')).toBe('#007f00');
    expect(dimFaceletColor('#ffffff')).toBe('#dddddd');
    expect(dimFaceletColor('rgb(0,255,0)')).toBe('rgb(0,255,0)'); // 认不出就原样退回
  });
});

describe('平面渲染器吃阶段遮罩', () => {
  const cube = new Cube(3);
  const serialized = cube.serialize();
  const codes = cube.serializeStickering(stickeringMaskFn(3, 'OLL')!);
  const greys = (svg: string) => (svg.match(new RegExp(`fill="${IGNORED_GREY}"`, 'gi')) ?? []).length;

  it('net:不传码整颗原色,传了码侧面第一排变灰', () => {
    const plain = renderCubeNetSvg({ serialized, order: 3, faceColors: FACE_COLORS });
    expect(greys(plain)).toBe(0);
    const masked = renderCubeNetSvg({ serialized, order: 3, faceColors: FACE_COLORS, stickering: codes });
    expect(greys(masked)).toBe(12);
  });

  it('net:展开图里 54 格全在,灰的只吃掉侧面第一排', () => {
    const masked = renderCubeNetSvg({ serialized, order: 3, faceColors: FACE_COLORS, stickering: codes });
    expect((masked.match(/fill="/g) ?? []).length).toBe(54);
    expect((masked.match(new RegExp(`fill="${FACE_COLORS.U}"`, 'gi')) ?? []).length).toBe(9);
  });

  it('plan:俯视图 9 顶 + 12 侧,侧面全灰', () => {
    const plain = exportSimPlanSvg({ serialized, order: 3, faceColors: FACE_COLORS });
    expect(greys(plain)).toBe(0);
    const masked = exportSimPlanSvg({ serialized, order: 3, faceColors: FACE_COLORS, stickering: codes });
    expect(greys(masked)).toBe(12);
  });

  it('plan + 隐去侧面灰格:阶段遮罩灰的那圈也要一起隐掉', () => {
    const svg = exportSimPlanSvg({
      serialized, order: 3, faceColors: FACE_COLORS, stickering: codes,
      spec: { ...DEFAULTS, cubeView: 'plan', hideGreySides: true },
    });
    expect(greys(svg)).toBe(0);
    expect((svg.match(new RegExp(`fill="${FACE_COLORS.U}"`, 'gi')) ?? []).length).toBe(9);
  });

  it('net / plan 都保留图片面板逐贴纸遮罩,且阶段遮罩在重叠格优先', () => {
    const color = '#123456';
    const selected = new Uint8Array(54);
    selected[0] = 1; // U0:OLL 原色
    selected[9] = 1; // R0:OLL ignored,阶段必须覆盖图片遮罩
    const stickerMask = { selected, color };
    const count = (svg: string, fill: string) =>
      (svg.match(new RegExp(`fill="${fill}"`, 'gi')) ?? []).length;

    for (const render of [
      (stickering?: Uint8Array) => renderCubeNetSvg({
        serialized, order: 3, faceColors: FACE_COLORS, stickering, stickerMask,
      }),
      (stickering?: Uint8Array) => exportSimPlanSvg({
        serialized, order: 3, faceColors: FACE_COLORS, stickering, stickerMask,
      }),
    ]) {
      expect(count(render(), color)).toBe(2);
      const staged = render(codes);
      expect(count(staged, color)).toBe(1);
      expect(count(staged, IGNORED_GREY)).toBe(12);
    }
  });
});
