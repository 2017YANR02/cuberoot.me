/**
 * /sim 手部指法 rig — 手势分类映射回归。
 * 锁死 (轴, 层类别, 转向) → (weld/flick, 左/右手, 手指) 的约定:改映射 = 有意为之,
 * 顺手更新这里的 baseline(参照 docs/contributing/development.md「主动改 baseline 当 review 信号」)。
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { TwistAction } from '@cuberoot/puzzle-render-core/engine/nxn/twister';
import { gripNames, moves } from '@/app/[lang]/sim/grips/catalog';
import { pushRules } from '@/lib/push-notation';
import { planHomeStroke, gestureForLayers, classifyHandGesture, classifyLayers, gripQuat, simulateGrips, type HandGripNames } from '@/app/[lang]/sim/engine/hands/handsRig';

const BOTH_HOME: HandGripNames = { R: 'home', L: 'home' };
const R_DOWN: HandGripNames = { R: 'down', L: 'home' };

it('uses the seated index stroke after either hand regrips for a four-layer inner upper turn', () => {
  for (const dir of [1, -1] as const) {
    const hand = dir === 1 ? 'R' : 'L';
    for (const entry of gripNames.filter(name => name !== 'home')) {
      const stroke = planHomeStroke(4, { ...BOTH_HOME, [hand]: entry }, 'y', [2], dir, 1);
      expect(stroke?.grip).toBe('home');
      expect(stroke?.gesture).toMatchObject({ kind: 'flick', hand, finger: 'index', style: 'indexHook' });
    }
  }
});

it('selects the front half-turn relay independently of either entry wrist across the three-order atlas', () => {
  const cube = new Cube(3);
  try {
    expect(gripNames.length ** 2 * moves.length).toBe(1800);
    for (const move of moves) {
      const turns = cube.table.convert(new TwistAction(move));
      const [{ group, twist }] = turns;
      for (const L of gripNames) for (const R of gripNames) {
        const stroke = planHomeStroke(3, { L, R }, group.axis as 'x' | 'y' | 'z', turns.map(t => t.group.layer),
          twist > 0 ? 1 : -1, Math.abs(twist));
        if (/^Fw?2'?$/.test(move)) {
          expect(stroke?.bearing?.center.toArray()).toEqual([move.endsWith("'") ? -64 : 64, 96, 64]);
          expect(stroke).toMatchObject({ grip: 'down', gesture: {
            kind: 'flick', hand: move.endsWith("'") ? 'L' : 'R', finger: 'index', finger2: 'middle', style: 'downPush',
          } });
        } else if (/^[BD]w?2'?$/.test(move)) {
          expect(stroke?.gesture).toMatchObject({ hand: move.endsWith("'") ? 'R' : 'L', finger: 'pinky', finger2: 'ring' });
        } else if (/^[RLxyz]/.test(move)) {
          expect(stroke).toBeUndefined();
        }
      }
    }
  } finally { cube.dispose(); }
});

describe('classifyLayers', () => {
  it('二阶单层按外层用指，两层同转用双手抱转', () => {
    expect(classifyLayers([1], 2)).toBe('high');
    expect(classifyLayers([0], 2)).toBe('low');
    const whole = classifyLayers([0, 1], 2);
    expect(classifyHandGesture('x', whole, 1, BOTH_HOME)).toEqual({ kind: 'weld', hands: ['L', 'R'] });
  });

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

  it('三阶双中握 M 用左无名指甲，M′ 用指腹，M2 用左无名指和小指接力', () => {
    const ring = { kind: 'flick', hand: 'L', finger: 'ring' };
    expect(classifyHandGesture('x', 'mid', -1, BOTH_HOME)).toEqual({ ...ring, style: 'middleSliceNail' });
    expect(classifyHandGesture('x', 'mid', 1, BOTH_HOME)).toEqual({ ...ring, style: 'middleSlicePad' });
    for (const dir of [-1, 1] as const) {
      expect(classifyHandGesture('x', 'mid', dir, BOTH_HOME, { quarters: 2 }))
        .toEqual({ ...ring, style: 'middleSlicePad', finger2: 'pinky' });
    }
    for (const g of [classifyHandGesture('x', 'mid', -1, R_DOWN),
      classifyHandGesture('x', 'mid', -1, BOTH_HOME, undefined, true, 5)]) {
      expect(g).toEqual({ kind: 'flick', hand: 'L', finger: 'middle' });
    }
  });

  it('双手 home 握时 F 族 = 食指越顶(F 右食指→UFR,F\' 左食指→UFL)', () => {
    expect(classifyHandGesture('z', 'high', 1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'topPush' });  // F
    expect(classifyHandGesture('z', 'high', -1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'L', finger: 'index', style: 'topPush' }); // F'
    expect(classifyHandGesture('x', 'high', 1, BOTH_HOME)).toEqual({ kind: 'weld', hands: ['R'] }); // R 不受影响
  });

  it.each(['home', 'up', 'down', 'half', null] as const)('右中手 F / F2 从 U8 越顶，按左手 %s 区分下握拇指上推', (left) => {
    const grips: HandGripNames = { R: 'home', L: left };
    for (const quarters of [1, 2]) {
      expect(classifyHandGesture('z', 'high', 1, grips, { quarters }))
        .toEqual(quarters === 1 && left === 'down' ? { kind: 'flick', hand: 'L', finger: 'thumb', style: 'thumbLift' }
          : { kind: 'flick', hand: 'R', finger: 'index', style: 'topPush' });
    }
  });

  it.each(['home', 'up', 'down', 'half', null] as const)('右中手单步 S 从 U5 下按，不受左手 %s 握姿影响', left => {
    const grips: HandGripNames = { R: 'home', L: left };
    expect(classifyHandGesture('z', 'mid', 1, grips))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'topPush' });
    expect(classifyHandGesture('z', 'mid', 1, grips, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'middle' });
    expect(classifyHandGesture('z', 'mid', -1, grips))
      .toEqual(left === 'home' ? { kind: 'flick', hand: 'L', finger: 'index', style: 'topPush' }
        : left === 'down' || left === 'up' ? { kind: 'flick', hand: 'R', finger: 'index', style: 'sliceNail' }
        : { kind: 'flick', hand: 'L', finger: 'middle' });
    for (const right of ['up', 'down', 'half'] as const) {
      expect(classifyHandGesture('z', 'mid', 1, { R: right, L: left }))
        .toEqual(left === 'home' && right !== 'half' ? { kind: 'flick', hand: 'L', finger: 'index', style: 'sliceNail' }
          : { kind: 'flick', hand: 'R', finger: 'middle' });
    }
  });

  it.each(['home', 'up', 'down', 'half', null] as const)('左中手单步 S-prime 从 U3 下按，不受右手 %s 握姿影响', right => {
    expect(classifyHandGesture('z', 'mid', -1, { R: right, L: 'home' }))
      .toEqual({ kind: 'flick', hand: 'L', finger: 'index', style: 'topPush' });
    expect(classifyHandGesture('z', 'mid', -1, { R: right, L: 'home' }, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'L', finger: 'middle' });
  });

  it.each(['home', 'up', 'down', 'half', null] as const)('左中手 F\' / F2\' 从 U6 越顶，按右手 %s 区分下握拇指上推', (right) => {
    for (const quarters of [1, 2]) {
      expect(classifyHandGesture('z', 'high', -1, { R: right, L: 'home' }, { quarters }))
        .toEqual(quarters === 1 && right === 'down' ? { kind: 'flick', hand: 'R', finger: 'thumb', style: 'thumbLift' }
          : { kind: 'flick', hand: 'L', finger: 'index', style: 'topPush' });
    }
  });

  it.each(['home', 'up', 'down', 'half', null] as const)('下起手 F / F\' 单拨和双拨只看主动手，对侧为 %s', (other) => {
    for (const [hand, dir] of [['R', 1], ['L', -1]] as const) {
      const grips: HandGripNames = hand === 'R' ? { R: 'down', L: other } : { R: other, L: 'down' };
      expect(classifyHandGesture('z', 'high', dir, grips, { quarters: 1 }))
        .toEqual({ kind: 'flick', hand, finger: 'index', style: 'downPush' });
      expect(classifyHandGesture('z', 'high', dir, grips, { quarters: 2 }))
        .toEqual({ kind: 'flick', hand, finger: 'index', finger2: 'middle', style: 'downPush' });
    }
  });

  it.each([1, -1] as const)('双中手可显式用反侧食指甲顶 S，宽层和半转保持原手法 %s', dir => {
    const hand = dir > 0 ? 'R' : 'L', other = dir > 0 ? 'L' : 'R';
    expect(classifyHandGesture('z', 'mid', dir, BOTH_HOME, { nail: true }))
      .toEqual({ kind: 'flick', hand: other, finger: 'index', style: 'sliceNail' });
    const grips = { ...BOTH_HOME, [other]: 'down' as const };
    expect(classifyHandGesture('z', 'high', dir, grips, {}, false))
      .toEqual({ kind: 'flick', hand, finger: 'index', style: 'topPush' });
  });

  it('keeps the pocket U2 relay when a preceding turn changes either grip', () => {
    const relay = { kind: 'flick', hand: 'R', finger: 'index', finger2: 'middle' };
    expect(classifyHandGesture('y', 'high', 1, { R: 'home', L: 'down' }, { quarters: 2 }, true, 2))
      .toEqual({ ...relay, style: 'hook' });
    const up = { R: 'up', L: 'home' } as const;
    expect(classifyHandGesture('y', 'high', 1, up, { quarters: 2 }, true, 2))
      .toEqual({ ...relay, style: 'topPush' });
    for (const [order, quarters] of [[3, 2], [2, 1]]) {
      expect(classifyHandGesture('y', 'high', 1, up, { quarters }, true, order)).not.toHaveProperty('finger2');
    }
  });

  it('relays a pocket U2-prime from left index to middle through mixed grips', () => {
    const halfTurn = { quarters: 2 };
    const relay = { kind: 'flick', hand: 'L', finger: 'index', finger2: 'middle' };
    const afterR = { R: 'up', L: 'home' } as const;
    expect(classifyHandGesture('y', 'high', -1, afterR, halfTurn, true, 2)).toEqual({ ...relay, style: 'hook' });
    expect(classifyHandGesture('y', 'high', -1, { R: 'home', L: 'down' }, halfTurn, true, 2)).toEqual(relay);
    expect(classifyHandGesture('y', 'high', -1, afterR, { quarters: 1 }, true, 2)).not.toHaveProperty('finger2');
    for (const order of [2, 3, 4]) {
      for (const right of ['up', 'down', 'half', 'halfDown', null] as const) {
        expect(classifyHandGesture('y', 'high', -1, { R: right, L: 'home' }, halfTurn, true, order))
          .toEqual({ ...relay, style: 'hook' });
      }
    }
  });

  it('keeps the seated half wrist and drives the opposite pocket layer with the home hand', () => {
    for (const grip of ['half', 'halfDown'] as const) {
      const grips = { R: grip, L: 'home' } as const;
      expect(classifyHandGesture('y', 'high', 1, grips, { quarters: 1 }, true, 2))
        .toEqual({ kind: 'flick', hand: 'L', finger: 'index', style: 'reverseIndexHook' });
      expect(classifyHandGesture('y', 'low', 1, grips, { quarters: 1 }, true, 2))
        .toEqual({ kind: 'flick', hand: 'L', finger: 'ring', style: 'reverseRingHook' });
      expect(classifyHandGesture('y', 'low', 1, grips, { quarters: 1 }, true, 3)).toMatchObject({ hand: 'R' });
    }
    expect(classifyHandGesture('y', 'high', -1, { L: 'up', R: 'home' }, { quarters: 2 }, true, 2))
      .toEqual({ kind: 'flick', hand: 'L', finger: 'index', finger2: 'middle', style: 'topPush' });
  });

  it('双中手 y 族 = 接触勾拨 hook;180° 提示连拨(FINGERTRICKS §4.2)', () => {
    expect(classifyHandGesture('y', 'high', 1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'indexHook' });  // U
    expect(classifyHandGesture('y', 'high', -1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'L', finger: 'index', style: 'indexHook' }); // U'
    expect(classifyHandGesture('y', 'low', 1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'R', finger: 'ring', style: 'hook' });    // D'
    // U2 连拨:先食指后中指;D2' 连拨:先小指后无名指(用户口述顺序)
    expect(classifyHandGesture('y', 'high', 1, BOTH_HOME, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'index', finger2: 'middle', style: 'hook' }); // U2
    expect(classifyHandGesture('y', 'low', 1, BOTH_HOME, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'pinky', finger2: 'ring', style: 'hook' });   // D2'
    // U2' 镜像连拨(2026-07-09 L 侧 hook_index/hook_middle2 标定后解锁);
    // D2 镜像连拨(2026-07-10 L 侧 hook_pinky/hook_ring2 标定后解锁)
    expect(classifyHandGesture('y', 'low', -1, BOTH_HOME, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'L', finger: 'pinky', finger2: 'ring', style: 'hook' });   // D2 连拨
    expect(classifyHandGesture('y', 'high', -1, BOTH_HOME, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'L', finger: 'index', finger2: 'middle', style: 'hook' }); // U2' 连拨
    // E 族 / 非标准握不受影响
    expect(classifyHandGesture('y', 'mid', -1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'L', finger: 'ring' }); // E
    expect(classifyHandGesture('y', 'high', 1)).toEqual({ kind: 'flick', hand: 'R', finger: 'index' });           // U(非标准握)
    expect(classifyHandGesture('y', 'high', 1, undefined, { quarters: 2 })).toEqual({ kind: 'flick', hand: 'R', finger: 'index' }); // U2 非标准握不连拨
  });

  it('双中手 B\'/B = 食指背钩;U\'p 推法(FINGERTRICKS §4.2/§4.5)', () => {
    expect(classifyHandGesture('z', 'low', 1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'backHook' });  // B'
    expect(classifyHandGesture('z', 'low', -1, BOTH_HOME)).toEqual({ kind: 'flick', hand: 'L', finger: 'index', style: 'backHook' }); // B(镜像)
    // B2'/B2 双向连拨:先食指后中指(2026-07-10 backHook_middle2 + BACK_EXIT 标定后解锁)
    expect(classifyHandGesture('z', 'low', 1, BOTH_HOME, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'index', finger2: 'middle', style: 'backHook' }); // B2'
    expect(classifyHandGesture('z', 'low', -1, BOTH_HOME, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'L', finger: 'index', finger2: 'middle', style: 'backHook' }); // B2
    expect(classifyHandGesture('z', 'low', 1, undefined, { quarters: 2 })).toEqual({ kind: 'flick', hand: 'R', finger: 'middle' }); // B2' 非标准握不连拨
    expect(classifyHandGesture('y', 'high', -1, BOTH_HOME, { push: true }))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'upPush' }); // U'p
    expect(classifyHandGesture('y', 'high', 1, BOTH_HOME, { push: true }))
      .toEqual({ kind: 'flick', hand: 'L', finger: 'index', style: 'upPush' }); // Up
    expect(classifyHandGesture('z', 'low', 1)).toEqual({ kind: 'flick', hand: 'R', finger: 'middle' }); // B' 非标准握回落中指
  });

  it.each([2, 4])('maps only marked outer quarter turns from home to the four push gestures on %i layers', order => {
    const push = { push: true, quarters: 1 };
    for (const rule of pushRules) {
      const layer = rule.layer === 'low' ? 0 : order - 1;
      const gesture = gestureForLayers('y', [layer], rule.dir, BOTH_HOME, push, order);
      expect(gesture).toEqual({ kind: 'flick', hand: rule.hand, finger: rule.finger,
        style: rule.layer === 'low' ? 'lowerPush' : 'upPush' });
      expect(gestureForLayers('y', [layer], rule.dir, BOTH_HOME, { ...push, quarters: 2 }, order)).not.toEqual(gesture);
      expect(gestureForLayers('y', [layer], rule.dir, { R: 'up', L: 'home' }, push, order)).not.toEqual(gesture);
      expect(gestureForLayers('y', [0, 1], rule.dir, BOTH_HOME, push, order)).not.toEqual(gesture);
    }
  });

  it('左中右下:F = 右食指下拨,F2 连拨食指→中指(FINGERTRICKS §4.3)', () => {
    expect(classifyHandGesture('z', 'high', 1, R_DOWN)).toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'downPush' }); // F
    expect(classifyHandGesture('z', 'high', 1, R_DOWN, { quarters: 2 }))
      .toEqual({ kind: 'flick', hand: 'R', finger: 'index', finger2: 'middle', style: 'downPush' }); // F2
    expect(classifyHandGesture('z', 'high', -1, R_DOWN)).toEqual({ kind: 'flick', hand: 'R', finger: 'thumb', style: 'thumbLift' });
    expect(classifyHandGesture('z', 'high', 1, { R: 'down', L: 'down' })).toEqual({ kind: 'flick', hand: 'R', finger: 'index', style: 'downPush' });
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

  it('half grip matches home after R2 and L2, with subsequent turns matching seek', () => {
    const turned = simulateGrips([
      { axis: 'x', layers: [2], quarters: 2 },
      { axis: 'x', layers: [0], quarters: -2 },
    ], 3);
    expect(near(turned.R, gripQuat('half'))).toBe(true);
    expect(near(turned.L, gripQuat('half'))).toBe(true);
    const marked = simulateGrips([{ grip: 'half', side: 'R' }], 3);
    expect(near(marked.R, turned.R)).toBe(true);
    expect(near(marked.L, gripQuat('home'))).toBe(true);
    const after = simulateGrips([{ grip: 'half', side: 'R' }, { axis: 'x', layers: [2], quarters: -1 }], 3);
    expect(near(after.R, gripQuat('up'))).toBe(true);
  });

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

  it('整体 x/y/z 均不烘(两手随层转动并依次回握)', () => {
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
