/**
 * /sim 手部指法 rig — 手势分类映射回归。
 * 锁死 (轴, 层类别, 转向) → (weld/flick, 左/右手, 手指) 的约定:改映射 = 有意为之,
 * 顺手更新这里的 baseline(参照 CLAUDE.md「主动改 baseline 当 review 信号」)。
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { classifyHandGesture, classifyLayers, gripQuat, simulateGrips, type HandGripNames } from '@/app/[lang]/sim/engine/hands/handsRig';

const BOTH_HOME: HandGripNames = { R: 'home', L: 'home' };
const R_DOWN: HandGripNames = { R: 'down', L: 'home' };

describe('classifyLayers', () => {
  it('外层 / 中层 / 宽层 / 整体', () => {
    expect(classifyLayers([2], 3)).toBe('high');   // R/U/F
    expect(classifyLayers([0], 3)).toBe('low');    // L/D/B
    expect(classifyLayers([1], 3)).toBe('mid');    // M/E/S
    expect(classifyLayers([0, 1, 2], 3)).toBe('whole'); // x/y/z
    expect(classifyLayers([1, 2], 3)).toBe('high');     // Rw/Uw/Fw 宽层按外层
    expect(classifyLayers([0, 1], 3)).toBe('low');      // Lw/Dw/Bw
    expect(classifyLayers([0, 2], 3)).toBe('whole');    // 双外层(理论态)兜底整体
  });
});

describe('classifyHandGesture', () => {
  it('R/L 外层 = 同侧手腕转 weld', () => {
    expect(classifyHandGesture('x', 'high', 1)).toEqual({ kind: 'weld', hands: ['R'] });
    expect(classifyHandGesture('x', 'high', -1)).toEqual({ kind: 'weld', hands: ['R'] });
    expect(classifyHandGesture('x', 'low', 1)).toEqual({ kind: 'weld', hands: ['L'] });
    expect(classifyHandGesture('x', 'low', -1)).toEqual({ kind: 'weld', hands: ['L'] });
  });

  it('U 族 = 转向分手的食指弹', () => {
    expect(classifyHandGesture('y', 'high', 1)).toEqual({ kind: 'flick', hand: 'R', finger: 'index' });  // U
    expect(classifyHandGesture('y', 'high', -1)).toEqual({ kind: 'flick', hand: 'L', finger: 'index' }); // U'
  });

  it('D/E 族 = 无名指弹', () => {
    expect(classifyHandGesture('y', 'low', -1)).toEqual({ kind: 'flick', hand: 'L', finger: 'ring' });  // D
    expect(classifyHandGesture('y', 'low', 1)).toEqual({ kind: 'flick', hand: 'R', finger: 'ring' });   // D'
    expect(classifyHandGesture('y', 'mid', -1)).toEqual({ kind: 'flick', hand: 'L', finger: 'ring' });  // E
  });

  it('F 族 = 拇指弹,B/S 族 / M 族 = 中指弹', () => {
    // F 使左列上行 → 左拇指沿 F 面上扫;F' 右列上行 → 右拇指(2026-07-04 新握姿实测定向)
    expect(classifyHandGesture('z', 'high', 1)).toEqual({ kind: 'flick', hand: 'L', finger: 'thumb' });  // F
    expect(classifyHandGesture('z', 'high', -1)).toEqual({ kind: 'flick', hand: 'R', finger: 'thumb' }); // F'
    expect(classifyHandGesture('z', 'mid', 1)).toEqual({ kind: 'flick', hand: 'R', finger: 'middle' });  // S
    expect(classifyHandGesture('z', 'low', -1)).toEqual({ kind: 'flick', hand: 'L', finger: 'middle' }); // B
    expect(classifyHandGesture('x', 'mid', -1)).toEqual({ kind: 'flick', hand: 'L', finger: 'middle' }); // M
    expect(classifyHandGesture('x', 'mid', 1)).toEqual({ kind: 'flick', hand: 'R', finger: 'middle' });  // M'
  });

  it('双手 home 握时 F 族 = 食指越顶(F 右食指→UFR,F\' 左食指→UFL)', () => {
    expect(classifyHandGesture('z', 'high', 1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'topPush' });  // F
    expect(classifyHandGesture('z', 'high', -1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'L', finger: 'index', style: 'topPush' }); // F'
    expect(classifyHandGesture('x', 'high', 1, BOTH_HOME)).toEqual({ kind: 'weld', hands: ['R'] }); // R 不受影响
  });

  it('双中手 y 族 = 接触勾拨 hook;180° 提示连拨(FINGERTRICKS §4.2)', () => {
    expect(classifyHandGesture('y', 'high', 1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'hook' });  // U
    expect(classifyHandGesture('y', 'high', -1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'L', finger: 'index', style: 'hook' }); // U'
    expect(classifyHandGesture('y', 'low', 1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'R', finger: 'ring', style: 'hook' });    // D'
    // U2 连拨:先食指后中指;D2' 连拨:先小指后无名指(用户口述顺序)
    expect(classifyHandGesture('y', 'high', 1, BOTH_HOME, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'index', finger2: 'middle', style: 'hook' }); // U2
    expect(classifyHandGesture('y', 'low', 1, BOTH_HOME, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'pinky', finger2: 'ring', style: 'hook' });   // D2'
    // 镜像连拨(U2'/D2)缺 L 侧标定 → 回落单指 hook(FINGERTRICKS §6)
    expect(classifyHandGesture('y', 'low', -1, BOTH_HOME, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'L', finger: 'ring', style: 'hook' });                     // D2 回落
    expect(classifyHandGesture('y', 'high', -1, BOTH_HOME, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'L', finger: 'index', style: 'hook' });                    // U2' 回落
    // E 族 / 非标准握不受影响
    expect(classifyHandGesture('y', 'mid', -1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'L', finger: 'ring' }); // E
    expect(classifyHandGesture('y', 'high', 1)).toEqual({ kind: 'flick', hand: 'R', finger: 'index' });           // U(非标准握)
    expect(classifyHandGesture('y', 'high', 1, undefined, { quarters: 2 })).toEqual({ kind: 'flick', hand: 'R', finger: 'index' }); // U2 非标准握不连拨
  });

  it('双中手 B\'/B = 食指背钩;U\'p 推法(FINGERTRICKS §4.2/§4.5)', () => {
    expect(classifyHandGesture('z', 'low', 1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'backHook' });  // B'
    expect(classifyHandGesture('z', 'low', -1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'L', finger: 'index', style: 'backHook' }); // B(镜像)
    expect(classifyHandGesture('y', 'high', -1, BOTH_HOME, { push: true }))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'upPush' }); // U'p
    expect(classifyHandGesture('y', 'high', 1, BOTH_HOME, { push: true }))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'hook' });   // Up 未编排 → 回落 U 默认
    expect(classifyHandGesture('z', 'low', 1)).toEqual({ kind: 'flick', hand: 'R', finger: 'middle' }); // B' 非标准握回落中指
  });

  it('左中右下:F = 右食指下拨,F2 连拨食指→中指(FINGERTRICKS §4.3)', () => {
    expect(classifyHandGesture('z', 'high', 1, R_DOWN)).toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'downPush' }); // F
    expect(classifyHandGesture('z', 'high', 1, R_DOWN, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'index', finger2: 'middle', style: 'downPush' }); // F2
    expect(classifyHandGesture('z', 'high', -1, R_DOWN)).toEqual({ kind: 'flick', hand: 'R', finger: 'thumb' }); // F' 未定义 → 回落拇指
    expect(classifyHandGesture('z', 'high', 1, { R: 'down', L: 'down' })).toEqual({ kind: 'flick', hand: 'L', finger: 'thumb' }); // 双下手未定义 → 回落
  });

  it('整体 x/y/z = 双手抱转 weld', () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      for (const dir of [1, -1] as const) {
        expect(classifyHandGesture(axis, 'whole', dir)).toEqual({ kind: 'weld', hands: ['L', 'R'] });
      }
    }
  });
});

describe('simulateGrips(握姿持久化静态推演,quarters 符号 = 引擎 convert 的 twist)', () => {
  const near = (a: THREE.Quaternion, b: THREE.Quaternion) => a.angleTo(b) < 1e-9;

  it("R 提交 → 右手上手、左手不动;R R' 抵消回 home", () => {
    const g1 = simulateGrips([{ axis: 'x', layers: [2], quarters: 1 }], 3);
    expect(near(g1.R, gripQuat('up'))).toBe(true);
    expect(near(g1.L, gripQuat('home'))).toBe(true);
    const g2 = simulateGrips([
      { axis: 'x', layers: [2], quarters: 1 },
      { axis: 'x', layers: [2], quarters: -1 },
    ], 3);
    expect(near(g2.R, gripQuat('home'))).toBe(true);
  });

  it("L'(x 轴 layer0 quarters+1)→ 左手上手(两手 up 同为绕 x +90°)", () => {
    const g = simulateGrips([{ axis: 'x', layers: [0], quarters: 1 }], 3);
    expect(near(g.L, gripQuat('up'))).toBe(true);
    expect(near(g.R, gripQuat('home'))).toBe(true);
  });

  it('整体 x/y/z 均不烘(手黏着转+90° 踏移,提交即在 home 频段,#20)', () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      const g = simulateGrips([{ axis, layers: [0, 1, 2], quarters: 1 }], 3);
      expect(near(g.R, gripQuat('home'))).toBe(true);
      expect(near(g.L, gripQuat('home'))).toBe(true);
    }
  });

  it('flick(U/M)不改握;换握记号覆盖两手', () => {
    const g = simulateGrips([
      { axis: 'y', layers: [2], quarters: 1 },  // U → flick
      { axis: 'x', layers: [1], quarters: -1 }, // M → flick
    ], 3);
    expect(near(g.R, gripQuat('home'))).toBe(true);
    expect(near(g.L, gripQuat('home'))).toBe(true);
    const g2 = simulateGrips([
      { axis: 'x', layers: [2], quarters: 1 }, // R → 右手 up
      { grip: 'down' },                        // ↓ 两手压到下手
    ], 3);
    expect(near(g2.R, gripQuat('down'))).toBe(true);
    expect(near(g2.L, gripQuat('down'))).toBe(true);
  });
});
