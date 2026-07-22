// sq1 贴纸遮罩 —— canonical piece 本位 id 空间(mask-core 头注)的两端锁:
// ① 2D 渲染器 sq1-svg:data-sid 发射 + 灰化 + piece-following(打乱后灰跟块)。
// ② 引擎几何 sq1Geometry:每贴纸 mesh 的 stickerKey = canonical sid,双射覆盖
//    全 46 贴纸(16 顶底 + 24 侧 + 6 中层)—— toEngineMask('sq1') 恒等的前提。
// sr-puzzlegen 从来做不到 sq1 mask(几何建构期定色),这是引擎路线的新增能力。
import { describe, it, expect } from 'vitest';
import { renderSq1Svg, DEFAULT_SQ1_COLORS } from '@/lib/sq1-svg';
import { applySq1Scramble } from '@cuberoot/shared/sq1-notation';

const solvedSq1 = () => applySq1Scramble(''); // shared 未导出 solved;空打乱即还原态
import { MASK_COLOR } from '@/lib/puzzle-image/mask-core';
import { pieceGroups, toEngineMask, engineMaskSupported } from '@/lib/puzzle-image/puzzle-mask';
import { buildPieceMesh, buildMiddlePair } from '@/app/[lang]/sim/engine/sq1/sq1Geometry';
import type * as THREE from 'three';

const sidsIn = (svg: string): string[] =>
  [...svg.matchAll(/data-sid="([^"]+)"/g)].map((m) => m[1]);

describe('sq1-svg canonical sticker ids', () => {
  it('solved render emits every layer sid exactly once (2D has no equator stickers)', () => {
    const svg = renderSq1Svg(solvedSq1(), DEFAULT_SQ1_COLORS, { stickerIds: true });
    const sids = sidsIn(svg);
    const want = new Set<string>();
    for (let p = 0; p <= 15; p++) {
      want.add(p <= 7 ? `U${p}` : `D${p}`);
      want.add(`SA${p}`);
      const corner = ((p + (p <= 7 ? 0 : 1)) % 2) === 0;
      if (corner) want.add(`SB${p}`);
    }
    expect(sids.length).toBe(40); // 16 top/bottom + 24 side; M0-5 是引擎伴图专属
    expect(new Set(sids)).toEqual(want);
  });

  it('masks exactly the requested sticker, and the gray follows the piece', () => {
    const mask = { ids: new Set(['U0']), color: MASK_COLOR };
    const solved = renderSq1Svg(solvedSq1(), DEFAULT_SQ1_COLORS, { mask });
    expect(solved.match(new RegExp(MASK_COLOR, 'g'))!.length).toBe(1);
    // (1,0) 顶层转 30°:piece0 挪槽,但灰仍然恰好一张(id 跟 piece,不跟槽位)。
    const turned = renderSq1Svg(applySq1Scramble('(1,0)'), DEFAULT_SQ1_COLORS, { mask });
    expect(turned.match(new RegExp(MASK_COLOR, 'g'))!.length).toBe(1);
    // slice 把东半送到底层:piece0(在东半)去了下面,灰照样恰好一张。
    const sliced = renderSq1Svg(applySq1Scramble('/'), DEFAULT_SQ1_COLORS, { mask });
    expect(sliced.match(new RegExp(MASK_COLOR, 'g'))!.length).toBe(1);
  });

  it('no data-sid attributes leak without the stickerIds option (byte-stability)', () => {
    const svg = renderSq1Svg(solvedSq1(), DEFAULT_SQ1_COLORS);
    expect(svg.includes('data-sid')).toBe(false);
  });
});

describe('sq1 engine sticker keys = canonical sids (identity toEngineMask)', () => {
  it('all 16 pieces + 2 equator halves cover the 46-sid space exactly once', () => {
    const got: string[] = [];
    const collect = (obj: THREE.Object3D): void => {
      obj.traverse((o) => {
        const k = (o.userData as { stickerKey?: string }).stickerKey;
        if (k) got.push(k);
      });
    };
    for (let p = 0; p <= 15; p++) collect(buildPieceMesh(p, p <= 7).pivot);
    const mid = buildMiddlePair();
    collect(mid.big);
    collect(mid.small);
    const want = new Set(pieceGroups('sq1').flat());
    expect(got.length).toBe(46);
    expect(new Set(got)).toEqual(want);
  });

  it('toEngineMask passes sq1 sids through identically', () => {
    expect(engineMaskSupported('sq1')).toBe(true);
    expect(toEngineMask('sq1', ['U0', 'SB15', 'M3'])).toEqual(new Set(['U0', 'SB15', 'M3']));
  });
});
