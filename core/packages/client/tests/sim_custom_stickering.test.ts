import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { engineHomeSid } from '@/app/[lang]/sim/engine/nxn/netIndex';
import {
  customMaskFn, pickedSids, pieceSids, toggleSids, countSids, paintSids, CustomMaskHistory,
} from '@/components/sim-embed/customStickering';
import { FM_REGULAR, FM_DIM, FM_IGNORED, FM_OUTLINE } from '@/app/[lang]/sim/engine/nxn/stickering';
import { buildFaceletMap } from '@/components/sim-embed/faceletMap';
import { solvedCube, applyAlg } from '@/lib/lsll/cube333';
import { stickerFacelet } from '@/app/[lang]/predict/_lib/challenge';

const MAP3 = buildFaceletMap(3);

describe('per-sticker brush', () => {
  it('erases only the targeted sticker or piece and restores the unset treatment', () => {
    const mask = paintSids('dim=U:4|outline=F:4', ['U4'], 'erase');
    expect(mask).toBe('outline=F:4');
    const fn = customMaskFn(3, mask, 'erase', 'dim')!;
    const u = MAP3[4];
    expect(fn(u.cube, u.face)).toBe(FM_DIM);
    expect(paintSids(mask, ['F4'], 'erase')).toBe('');
    const corner = pieceSids(26, 3);
    const painted = paintSids(mask, corner, 'regular');
    expect(paintSids(painted, corner, 'erase')).toBe(mask);
  });
  it('changing brush or painting another sticker preserves all previous styles', () => {
    let mask = paintSids('', ['U4'], 'dim');
    mask = paintSids(mask, ['F4'], 'outline');
    mask = paintSids(mask, ['R4'], 'ignored');
    expect(mask).toBe('dim=U:4|ignored=R:4|outline=F:4');
    expect(paintSids(mask, [], 'regular')).toBe(mask);
    expect(paintSids(mask, ['F4'], 'outline')).toBe(mask);
    const fn = customMaskFn(3, mask, 'regular', 'regular')!;
    for (const [sid, code] of [['U4', FM_DIM], ['F4', FM_OUTLINE], ['R4', FM_IGNORED], ['B4', FM_REGULAR]] as const) {
      const slot = MAP3.find(entry => engineHomeSid(entry.cube, entry.face, 3) === sid)!;
      expect(fn(slot.cube, slot.face)).toBe(code);
    }
    expect(countSids(mask)).toBe(3);
  });

  it('freezes old uniform masks before changing the brush and preserves unclicked pieces', () => {
    const frozen = paintSids('U:4;F:4', [], 'dim', 'dim');
    expect(frozen).toBe('dim=F:4;U:4');
    expect(paintSids(frozen, ['U4'], 'outline')).toBe('dim=F:4|outline=U:4');
  });

  it('paints a whole piece, then allows just one of its stickers to be changed', () => {
    const corner = pieceSids(26, 3);
    expect(corner).toHaveLength(3);
    const whole = paintSids('', corner, 'dim');
    const one = paintSids(whole, [corner[0]], 'outline');
    const fn = customMaskFn(3, one, 'regular', 'ignored')!;
    for (const sid of corner) {
      const slot = MAP3.find(entry => engineHomeSid(entry.cube, entry.face, 3) === sid)!;
      expect(fn(slot.cube, slot.face)).toBe(sid === corner[0] ? FM_OUTLINE : FM_DIM);
    }
    expect(countSids(one)).toBe(3);
  });
});

describe('paint history', () => {
  it('undoes painting, erase, clear and background changes independently of brush selection', () => {
    const blank = { mask: '', rest: 'ignored' as const };
    const first = { ...blank, mask: 'dim=U:4' };
    const second = { ...first, mask: 'dim=U:4|outline=F:4' };
    const erased = { ...second, mask: 'outline=F:4' };
    const background = { ...erased, rest: 'regular' as const };
    const cleared = { ...background, mask: '' };
    const h = new CustomMaskHistory(blank);
    for (const value of [first, second, erased, background, cleared]) expect(h.record(value)).toBe(true);
    expect(h.record(cleared)).toBe(false);
    for (const value of [background, erased, second, first, blank]) expect(h.undo()).toEqual(value);
    expect(h.undo()).toBeNull();
    for (const value of [first, second, erased, background, cleared]) expect(h.redo()).toEqual(value);
    expect(h.redo()).toBeNull();
    h.undo();
    h.record(first);
    expect(h.redo()).toBeNull();
  });
});
/** facelet(URFDLB 位置)→ 该位置的 sid,读的是「几何格位 + 世界面」那一层。 */
const sidAtFacelet = (f: number): string => engineHomeSid(MAP3[f].cube, MAP3[f].face, 3);

/**
 * 独立 oracle:用纯 TS 的 cube333 状态机(/predict 那条链,与 /sim 引擎零共享代码)
 * 算出「当前 facelet → 该贴纸的本位 facelet」。中心块在面转下不动,取恒等。
 */
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

describe('pickedSids — 点中的贴纸要落回它的本位 sid', () => {
  // 拧过的魔方上,格位 ≠ 本位、世界面 ≠ 块的本地面。少任何一层换算,点出来的都是
  // 另一枚贴纸 —— 这组用例就是卡这两层换算。
  const ALGS = [
    '', 'R', "R'", 'R2', 'U', 'F', "U R U' R'",
    "R U R' U' R' F R2 U' R' U' R U R' F'", // T perm
    "F R U' R' U' R U R' F' R U R' U' R' F R F'", // 一长条
  ];

  for (const alg of ALGS) {
    it(`打乱「${alg || '还原态'}」下,每一枚可见贴纸都点得准`, () => {
      const cube = new Cube(3);
      if (alg) cube.twister.setup(alg);
      const home = homeFaceletMap(alg);

      for (let f = 0; f < 54; f++) {
        const { cube: posIdx, face: worldFace } = MAP3[f];
        const got = pickedSids(cube, posIdx, worldFace, 'sticker');
        expect(got).toHaveLength(1);
        // 独立算出的本位 facelet → 本位 sid
        expect(got[0]).toBe(sidAtFacelet(home.get(f)!));
      }
    });
  }

  it('还原态下点选 = 恒等(格位就是本位,世界面就是本地面)', () => {
    const cube = new Cube(3);
    for (let f = 0; f < 54; f++) {
      const { cube: posIdx, face: worldFace } = MAP3[f];
      expect(pickedSids(cube, posIdx, worldFace, 'sticker')[0]).toBe(sidAtFacelet(f));
    }
  });

  it('整块粒度:点一枚给整块 —— 中心 1 / 棱 2 / 角 3 枚', () => {
    const cube = new Cube(3);
    cube.twister.setup("R U R' U'");
    const sizes = new Map<string, number>();
    for (let f = 0; f < 54; f++) {
      const { cube: posIdx, face: worldFace } = MAP3[f];
      const piece = pickedSids(cube, posIdx, worldFace, 'piece');
      const one = pickedSids(cube, posIdx, worldFace, 'sticker')[0];
      // 整块必须包含单枚那一枚,且互不重复
      expect(piece).toContain(one);
      expect(new Set(piece).size).toBe(piece.length);
      sizes.set(one, piece.length);
    }
    const counts = [...sizes.values()].sort();
    expect(counts.filter((n) => n === 1)).toHaveLength(6);   // 6 个中心
    expect(counts.filter((n) => n === 2)).toHaveLength(24);  // 12 棱 × 2
    expect(counts.filter((n) => n === 3)).toHaveLength(24);  // 8 角 × 3
  });
});

describe('pieceSids', () => {
  it('3 阶:角 3 枚 / 棱 2 枚 / 中心 1 枚,且 sid 面前缀合法', () => {
    // initial = x + y·3 + z·9;(2,2,2)=角 URF、(1,2,2)=棱 UF、(1,2,1)=中心 U
    expect(pieceSids(2 + 2 * 3 + 2 * 9, 3)).toHaveLength(3);
    expect(pieceSids(1 + 2 * 3 + 2 * 9, 3)).toHaveLength(2);
    expect(pieceSids(1 + 2 * 3 + 1 * 9, 3)).toHaveLength(1);
    for (const sid of pieceSids(2 + 2 * 3 + 2 * 9, 3)) {
      expect(sid).toMatch(/^[URFDLB]\d+$/);
    }
  });

  it('2 阶:8 个块全是角,各 3 枚,合起来正好 24 枚且不重复', () => {
    const all = new Set<string>();
    for (let z = 0; z < 2; z++) {
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
          const sids = pieceSids(x + y * 2 + z * 4, 2);
          expect(sids).toHaveLength(3);
          for (const s of sids) all.add(s);
        }
      }
    }
    expect(all.size).toBe(24);
  });
});

describe('customMaskFn', () => {
  it('进入自定义或清空后，未设置的全部贴纸默认变灰', () => {
    for (const mask of ['', '   ']) {
      const fn = customMaskFn(3, mask)!;
      for (const slot of MAP3) expect(fn(slot.cube, slot.face)).toBe(FM_IGNORED);
    }
  });

  it('选中的保原色,其余置灰', () => {
    const fn = customMaskFn(3, 'U:4')!;
    // U 中心块 = (1,2,1),U 面
    const uCenter = 1 + 2 * 3 + 1 * 9;
    const { cube: c0, face: f0 } = MAP3[4];
    expect(c0).toBe(uCenter);
    expect(fn(c0, f0)).toBe(FM_REGULAR);
    // 别的贴纸一律灰
    expect(fn(MAP3[0].cube, MAP3[0].face)).toBe(FM_IGNORED);
    expect(fn(MAP3[22].cube, MAP3[22].face)).toBe(FM_IGNORED);
  });

  it('遮罩键的是本位,与当前有没有拧过无关(颜色随块走的前提)', () => {
    const fn = customMaskFn(3, 'F:0')!;
    const { cube: pos, face } = MAP3[18]; // F 面左上角
    expect(fn(pos, face)).toBe(FM_REGULAR);
  });

  it('画法可选:选中 / 其余各自原色、压暗、置灰', () => {
    const on = MAP3[4];   // U 中心(选中)
    const off = MAP3[22]; // D 中心(未选中)
    // 其余压暗 = CLL 那类预设的层次
    const cll = customMaskFn(3, 'U:4', 'regular', 'dim')!;
    expect(cll(on.cube, on.face)).toBe(FM_REGULAR);
    expect(cll(off.cube, off.face)).toBe(FM_DIM);
    // 反过来:压暗选中的、其余保持原色
    const hide = customMaskFn(3, 'U:4', 'dim', 'regular')!;
    expect(hide(on.cube, on.face)).toBe(FM_DIM);
    expect(hide(off.cube, off.face)).toBe(FM_REGULAR);
    // 选中置灰
    const gray = customMaskFn(3, 'U:4', 'ignored', 'regular')!;
    expect(gray(on.cube, on.face)).toBe(FM_IGNORED);
    // 描边:选中的保原色再描一圈,其余照常
    const outline = customMaskFn(3, 'U:4', 'outline', 'dim')!;
    expect(outline(on.cube, on.face)).toBe(FM_OUTLINE);
    expect(outline(off.cube, off.face)).toBe(FM_DIM);
  });

  it('画法缺省 = 原色 + 灰(老链接不变)', () => {
    const fn = customMaskFn(3, 'U:4')!;
    const explicit = customMaskFn(3, 'U:4', 'regular', 'ignored')!;
    for (const f of [0, 4, 22, 45]) {
      const { cube, face } = MAP3[f];
      expect(fn(cube, face)).toBe(explicit(cube, face));
    }
  });

  it('空清单遵循未设置样式，改画笔不会改变画布', () => {
    const dim = customMaskFn(3, '', 'outline', 'dim')!;
    for (const slot of MAP3) expect(dim(slot.cube, slot.face)).toBe(FM_DIM);
    expect(customMaskFn(3, '', 'dim', 'regular')).toBeNull();
  });

  it('从全灰画布点亮一格，只改变该格，其余保持灰色', () => {
    const fn = customMaskFn(3, paintSids('', ['U4'], 'regular'))!;
    for (const slot of MAP3) {
      expect(fn(slot.cube, slot.face)).toBe(engineHomeSid(slot.cube, slot.face, 3) === 'U4' ? FM_REGULAR : FM_IGNORED);
    }
  });
});

describe('描边(FM_OUTLINE)落到渲染层', () => {
  /** 贴纸 mesh 上的 per-instance 描边开关(shader 读的就是这条 attribute)。 */
  const outlineFlags = (cube: Cube): Float32Array =>
    cube.instancedRenderer.staticSticker.geometry.getAttribute('aOutline').array as Float32Array;

  it('hover outlines preserve painted colors and saved outlines through mask refresh and removal', () => {
    const cube = new Cube(3);
    const renderer = cube.instancedRenderer;
    renderer.setStickering(customMaskFn(3, 'outline=U:4|dim=F:4'));
    const index = renderer.stickerSlots.findIndex(slot => engineHomeSid(slot.cubeletInitial, slot.face, 3) === 'F4');
    const before = new THREE.Color();
    renderer.staticSticker.getColorAt(index, before);
    renderer.setStickerPreview((initial, face) => engineHomeSid(initial, face, 3) === 'F4');
    expect([...outlineFlags(cube)].filter(value => value === 1)).toHaveLength(2);
    const after = new THREE.Color();
    renderer.staticSticker.getColorAt(index, after);
    expect(after.getHex()).toBe(before.getHex());
    renderer.setStickering(customMaskFn(3, 'outline=U:4|dim=F:4'));
    expect([...outlineFlags(cube)].filter(value => value === 1)).toHaveLength(2);
    renderer.setStickerPreview(null);
    expect(outlineFlags(cube)[index]).toBe(0);
    expect([...outlineFlags(cube)].filter(value => value === 1)).toHaveLength(1);
    cube.dispose();
  });

  it('只有被标 outline 的槽位开描边,static / moving 共用同一份', () => {
    const cube = new Cube(3);
    cube.instancedRenderer.setStickering(customMaskFn(3, 'U:4;F:0', 'outline', 'dim'));
    const flags = outlineFlags(cube);
    const slots = cube.instancedRenderer.stickerSlots;
    expect(flags).toHaveLength(slots.length);
    const on = new Set<string>();
    for (let i = 0; i < slots.length; i++) {
      if (flags[i] === 1) on.add(engineHomeSid(slots[i].cubeletInitial, slots[i].face, 3));
    }
    expect([...on].sort()).toEqual(['F0', 'U4']);
    // moving 那只 mesh 复用 static 的几何 → 转层途中描边不会掉
    expect(cube.instancedRenderer.movingSticker.geometry)
      .toBe(cube.instancedRenderer.staticSticker.geometry);
  });

  it('换阶段 / 清阶段都要把旧描边收掉', () => {
    const cube = new Cube(3);
    cube.instancedRenderer.setStickering(customMaskFn(3, 'U:4', 'outline', 'dim'));
    expect([...outlineFlags(cube)].filter((v) => v === 1)).toHaveLength(1);
    // 同一批贴纸改成「原色」这一档
    cube.instancedRenderer.setStickering(customMaskFn(3, 'U:4', 'regular', 'dim'));
    expect([...outlineFlags(cube)].some((v) => v === 1)).toBe(false);
    cube.instancedRenderer.setStickering(customMaskFn(3, 'U:4', 'outline', 'dim'));
    cube.instancedRenderer.setStickering(null);
    expect([...outlineFlags(cube)].some((v) => v === 1)).toBe(false);
  });

  it('描边只是加一圈边,颜色仍是本来那枚贴纸的色(不像 ignored 会被灰盖掉)', () => {
    const cube = new Cube(3);
    const slots = cube.instancedRenderer.stickerSlots;
    const idx = slots.findIndex((s) => engineHomeSid(s.cubeletInitial, s.face, 3) === 'U4');
    const read = (): string => {
      const c = new THREE.Color();
      cube.instancedRenderer.staticSticker.getColorAt(idx, c);
      return c.getHexString();
    };
    cube.instancedRenderer.setStickering(null);
    const plain = read();
    cube.instancedRenderer.setStickering(customMaskFn(3, 'U:4', 'outline', 'ignored'));
    expect(read()).toBe(plain);
  });
});

describe('toggleSids / countSids', () => {
  it('单枚:一点选上,再点取消', () => {
    expect(toggleSids('', ['U4'])).toBe('U:4');
    expect(toggleSids('U:4', ['U4'])).toBe('');
  });

  it('整块:没全选 → 整块选上;已全选 → 整块取消(不出「半选」死角)', () => {
    const piece = ['U8', 'R0', 'F2'];
    const on = toggleSids('', piece);
    expect(countSids(on)).toBe(3);
    // 只留一枚 → 再点整块应补齐成 3 枚,而不是把那一枚也取消
    const partial = toggleSids(on, ['R0']); // 去掉 R0,剩 2 枚
    expect(countSids(partial)).toBe(2);
    expect(countSids(toggleSids(partial, piece))).toBe(3);
    // 全选状态下点整块 = 清掉整块
    expect(countSids(toggleSids(on, piece))).toBe(0);
  });

  it('DSL 往返稳定(连点同一枚不会把清单越写越长)', () => {
    let m = '';
    for (let i = 0; i < 6; i++) m = toggleSids(m, ['U0']);
    expect(m).toBe('');
    for (let i = 0; i < 5; i++) m = toggleSids(m, ['U0']);
    expect(m).toBe('U:0');
  });

  it('空数组不动清单', () => {
    expect(toggleSids('U:4', [])).toBe('U:4');
  });
});
