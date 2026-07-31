/**
 * 转体计数(从姿态流里推 x / y' / z2)。
 * =========================================================================
 *
 * 这条一直挂着「可行性未验」,所以测试要先回答**可行不可行**,再谈准不准。四件事:
 *
 *   1. 干净的转体数得对、名字叫得对;
 *   2. 人手里的晃动**不**被当成转体(这是这个功能能不能用的分水岭);
 *   3. 连着转好几次,**数目不多也不少** —— 基准每认一次都要不带偏差地往前挪,
 *      否则偏差滚起来,一次转体会被劈成两次(或者反过来被吞掉一次);
 *   4. 传感器姿态未验时,**哪半结论是免标定的**:计数和角度是,轴向不是。
 *      这一条以前写反了,所以现在两边分开各证各的。
 */

import { describe, it, expect } from 'vitest';

import {
  detectRotations, rotationsByStep, stepTimeBounds, tokenForRelative, HOLD_MS,
} from '@/app/[lang]/timer/_lib/reconstruct/rotation_detect';
import { GyroRecorder, type GyroSample } from '@/app/[lang]/timer/_lib/bluetooth/gyro_track';
import {
  QUAT_IDENTITY, quatConjugate, quatMul, quatNormalize, type Quat,
} from '@/app/[lang]/timer/_lib/bluetooth/orientation';

function axis(a: 'x' | 'y' | 'z', deg: number): Quat {
  const h = (deg * Math.PI) / 360;
  const s = Math.sin(h);
  return { w: Math.cos(h), x: a === 'x' ? s : 0, y: a === 'y' ? s : 0, z: a === 'z' ? s : 0 };
}

/** 一段停在某个朝向上的样本(默认待够 HOLD_MS 的两倍,保证被认下来)。 */
function hold(q: Quat, fromMs: number, ms = HOLD_MS * 2, stepMs = 40): GyroSample[] {
  const out: GyroSample[] = [];
  for (let t = 0; t <= ms; t += stepMs) out.push({ tMs: fromMs + t, q });
  return out;
}

/** 一段从 a 转到 b 的中间样本(线性插值,故意不吸附到任何一格)。 */
function sweep(a: Quat, b: Quat, fromMs: number, ms: number, stepMs = 20): GyroSample[] {
  const out: GyroSample[] = [];
  for (let t = stepMs; t < ms; t += stepMs) {
    const u = t / ms;
    const q = quatNormalize({
      w: a.w + (b.w - a.w) * u, x: a.x + (b.x - a.x) * u,
      y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u,
    });
    out.push({ tMs: fromMs + t, q });
  }
  return out;
}

describe('tokenForRelative', () => {
  it('九个基本转体各叫各的名字', () => {
    expect(tokenForRelative(axis('x', 90))).toBe('x');
    expect(tokenForRelative(axis('x', -90))).toBe("x'");
    expect(tokenForRelative(axis('x', 180))).toBe('x2');
    expect(tokenForRelative(axis('y', 90))).toBe('y');
    expect(tokenForRelative(axis('y', -90))).toBe("y'");
    expect(tokenForRelative(axis('z', 90))).toBe('z');
    expect(tokenForRelative(axis('z', -90))).toBe("z'");
    expect(tokenForRelative(axis('z', 180))).toBe('z2');
  });

  it('半转的正反是同一个记号(x2 == x2\',魔方记号里没有后者)', () => {
    expect(tokenForRelative(axis('y', 180))).toBe('y2');
    expect(tokenForRelative(axis('y', -180))).toBe('y2');
  });

  it('不是单次转体的,说不知道而不是硬凑一个名字', () => {
    // x 之后再 y = 复合,不在九个里
    expect(tokenForRelative(quatMul(axis('y', 90), axis('x', 90)))).toBeNull();
    expect(tokenForRelative(QUAT_IDENTITY)).toBeNull();     // 没转
  });
});

describe('detectRotations', () => {
  it('一次 y:数出来一次,名字对,时刻是新朝向第一次被采到的那一刻', () => {
    const a = QUAT_IDENTITY;
    const b = axis('y', 90);
    const track = [...hold(a, 0), ...sweep(a, b, 300, 200), ...hold(b, 500)];
    const evs = detectRotations(track);
    expect(evs).toHaveLength(1);
    expect(evs[0].token).toBe('y');
    // 时刻是「新朝向第一次明确成立」的那一刻 —— 落在转动的尾段,不必等手停稳。
    // 这是想要的:转体在手还在动的时候就已经发生了。
    expect(evs[0].tMs).toBeGreaterThan(300);
    expect(evs[0].tMs).toBeLessThanOrEqual(500);
    expect((evs[0].angleRad * 180) / Math.PI).toBeCloseTo(90, 1);
  });

  it('三次连着转:y x y2,顺序和名字都对', () => {
    const o0 = QUAT_IDENTITY;
    const o1 = axis('y', 90);
    const o2 = quatMul(o1, axis('x', 90));
    const o3 = quatMul(o2, axis('y', 180));
    const track = [
      ...hold(o0, 0), ...hold(o1, 400), ...hold(o2, 800), ...hold(o3, 1200),
    ];
    expect(detectRotations(track).map(e => e.token)).toEqual(['y', 'x', 'y2']);
  });

  it('起始朝向不算一次转体(魔方一开始朝哪边是握持,不是动作)', () => {
    // 整条录像都停在一个非单位朝向上
    expect(detectRotations(hold(axis('z', 90), 0, 2000))).toEqual([]);
  });

  it('**手里晃 25° 不算转体** —— 这条决定这个功能能不能用', () => {
    const track: GyroSample[] = [];
    for (let t = 0; t <= 4000; t += 30) {
      track.push({ tMs: t, q: axis('x', 25 * Math.sin(t / 300)) });
    }
    expect(detectRotations(track)).toEqual([]);
  });

  it('转到一半又转回去,不算一次(没待够 HOLD_MS)', () => {
    const a = QUAT_IDENTITY;
    const b = axis('y', 90);
    const track = [
      ...hold(a, 0),
      // b 上只停 60ms(< HOLD_MS=120),然后回 a
      { tMs: 400, q: b }, { tMs: 440, q: b },
      ...hold(a, 500),
    ];
    expect(detectRotations(track)).toEqual([]);
  });

  it('待够了就算 —— 同一个动作多停一会儿,结论翻过来', () => {
    const a = QUAT_IDENTITY;
    const b = axis('y', 90);
    const track = [
      ...hold(a, 0),
      { tMs: 400, q: b }, { tMs: 440, q: b }, { tMs: 480, q: b }, { tMs: 560, q: b },
      ...hold(a, 700),
    ];
    // y 转过去,又 y' 转回来 —— 两次
    expect(detectRotations(track).map(e => e.token)).toEqual(['y', "y'"]);
  });

  it('空录像 / 单样本不抛,也不冒充数出了东西', () => {
    expect(detectRotations([])).toEqual([]);
    expect(detectRotations([{ tMs: 0, q: QUAT_IDENTITY }])).toEqual([]);
  });
});

describe('死区压缩过的录像(真编码器产出的形状)', () => {
  /**
   * 回归:第一版按「同一格连着采到好几个样本」算保持时长,合成录像里每个姿态给十几个
   * 样本所以过了 —— 而真录下来的一把,`gyro_track` 的 4° 死区让「停在一个朝向上的
   * 那一整段」只剩**一个**样本。浏览器实测:一把两次转体的解法,整条流 3 个样本,
   * 一个转体都数不出来。
   */
  it('每个姿态只有一个样本时照样数得出来', () => {
    const track: GyroSample[] = [
      { tMs: 0, q: QUAT_IDENTITY },
      { tMs: 620, q: axis('y', 90) },
      { tMs: 1730, q: quatMul(axis('y', 90), axis('x', 90)) },
    ];
    const evs = detectRotations(track);
    expect(evs.map(e => e.token)).toEqual(['y', 'x']);
    expect(evs.map(e => e.tMs)).toEqual([620, 1730]);
  });

  it('最后一个样本管到录像结束 —— 收尾那次转体不因为「后面没样本了」被丢掉', () => {
    const track: GyroSample[] = [
      { tMs: 0, q: QUAT_IDENTITY },
      { tMs: 900, q: axis('z', -90) },
    ];
    expect(detectRotations(track).map(e => e.token)).toEqual(["z'"]);
  });

  /**
   * 回归(审查发现):候选段必须被**任何**不落在候选格上的样本打断,包括「晃到了
   * 两格之间」那种。只跳过不打断的话,65° 上晃两下、中间回到 50°(离哪一格都超过
   * 30° 的无人区),两次 blip 之间的时间差会把保持时长凑够 —— 一次纯晃动被记成转体。
   */
  it('在两格之间来回晃、从不停住,不算转体', () => {
    const track: GyroSample[] = [
      { tMs: 0, q: QUAT_IDENTITY },
      { tMs: 400, q: axis('y', 65) },   // 离 y90 只有 25°,进得了格
      { tMs: 420, q: axis('y', 50) },   // 离 y90 40°、离单位 50° —— 两格之间
      { tMs: 620, q: axis('y', 65) },
      { tMs: 640, q: axis('y', 50) },
      { tMs: 1040, q: axis('y', 50) },
    ];
    expect(detectRotations(track)).toEqual([]);
  });

  it('转的**路上**那个中间样本仍然不算 —— 它下一个样本紧跟着来', () => {
    const track: GyroSample[] = [
      { tMs: 0, q: QUAT_IDENTITY },
      // 40ms 之内连着跨过一格再走掉:是扫过去的,不是停在那儿
      { tMs: 500, q: axis('y', 80) },
      { tMs: 530, q: axis('y', 130) },
      { tMs: 560, q: axis('y', 175) },
      { tMs: 2000, q: axis('y', 180) },
    ];
    // 只该数出最终那次 y2,不该在 y 那一格上多数一次
    expect(detectRotations(track).map(e => e.token)).toEqual(['y2']);
  });
});

/**
 * 连着转好几次 —— 基准漂移的回归。
 *
 * 这组用**真的 `GyroRecorder`** 把合成的连续姿态压一遍,拿到的就是硬件那条流的形状
 * (4° 死区、停住的那段不发样本)。上面那些手写录像每个姿态都干干净净落在格点上,
 * 掩盖了「基准该取哪个姿态」这个问题;而一旦连着转,基准每次带的那点偏差就会进位:
 *
 *   基准取**刚进格**那一下  → 每次落后约 27°,四个 y 数出**五**个;
 *   基准取格里**最后**那一下 → 每次超前约 30°,四个 y 只数出**三**个。
 *
 * 两种都实测过。现在基准按认下来的那一格精确推进,所以下面这些配置一个不漏。
 */
describe('连着转不漂(真 GyroRecorder 压过的流)', () => {
  /** n 次同轴 90° 转体,每次 sweepMs 转完、停 dwellMs。 */
  function recorded(n: number, ax: 'x' | 'y' | 'z', sweepMs: number, hz: number): GyroSample[] {
    const rec = new GyroRecorder();
    const dt = 1000 / hz;
    let t = 0;
    let base: Quat = QUAT_IDENTITY;
    const dwell = () => { for (let k = 0; k < 700; k += dt) { rec.push(base, t); t += dt; } };
    dwell();
    for (let i = 0; i < n; i++) {
      for (let e = dt; e <= sweepMs; e += dt) {
        rec.push(quatNormalize(quatMul(base, axis(ax, 90 * (e / sweepMs)))), t);
        t += dt;
      }
      base = quatNormalize(quatMul(base, axis(ax, 90)));
      dwell();
    }
    return rec.take();
  }

  for (const sweepMs of [150, 200, 300, 400]) {
    for (const hz of [20, 30, 50]) {
      it(`四个 y,每次 ${sweepMs}ms / 传感器 ${hz}Hz → 正好四个`, () => {
        expect(detectRotations(recorded(4, 'y', sweepMs, hz)).map(e => e.token).join(' '))
          .toBe('y y y y');
      });
    }
  }

  it('换根轴也一样(x)', () => {
    expect(detectRotations(recorded(4, 'x', 250, 30)).map(e => e.token).join(' '))
      .toBe('x x x x');
  });

  /**
   * 已知且可接受:慢到 360ms 以上的半转会读成两个四分之一转。判据是「在这一格里
   * 待够 HOLD_MS」,而一次慢半转**确实**在中间那一格的 30° 带里待了一百多毫秒。
   * `y y` 和 `y2` 是同一个动作的两种写法,谱子照样对得上,所以不为它再加一档阈值;
   * 记在这儿是免得以后有人当成新 bug 又改一遍判据。
   */
  it('慢半转读成两个四分之一转(等价写法,不是缺陷)', () => {
    const rec = new GyroRecorder();
    let t = 0;
    for (let k = 0; k < 600; k += 20) { rec.push(QUAT_IDENTITY, t); t += 20; }
    for (let e = 20; e <= 800; e += 20) { rec.push(axis('y', 180 * (e / 800)), t); t += 20; }
    for (let k = 0; k < 900; k += 20) { rec.push(axis('y', 180), t); t += 20; }
    expect(detectRotations(rec.take()).map(e => e.token)).toEqual(['y', 'y']);
  });

  it('快半转仍然读成 y2', () => {
    const rec = new GyroRecorder();
    let t = 0;
    for (let k = 0; k < 600; k += 20) { rec.push(QUAT_IDENTITY, t); t += 20; }
    for (let e = 20; e <= 240; e += 20) { rec.push(axis('y', 180 * (e / 240)), t); t += 20; }
    for (let k = 0; k < 900; k += 20) { rec.push(axis('y', 180), t); t += 20; }
    expect(detectRotations(rec.take()).map(e => e.token)).toEqual(['y2']);
  });
});

/**
 * 未知量有两个,消掉的只有一个 —— 这一组把两边分开钉住。
 *
 * `q = W · C · M`:`W` 是传感器的世界系(左因子),`M` 是它装在魔方里的姿态
 * (右因子,就是 `BRAND_SENSOR_BASIS`)。相对量里 `W` 被消掉,`M` 变成一次相似
 * 变换 —— 保角不保轴。所以:
 *
 *   左乘任意旋转  → 计数、角度、**记号**全不变;
 *   相似变换      → 计数、角度不变,**记号会变**。
 *
 * 第一版这里只有左乘那条,却顶着「传感器基未验也不影响结论」的标题,等于拿 W 的
 * 证明去替 M 背书。两条都在,才说得清哪半是真的免标定。
 */
describe('未知的传感器姿态:消掉的和消不掉的', () => {
  const o0 = QUAT_IDENTITY;
  const o1 = axis('y', 90);
  const o2 = quatMul(o1, axis('x', -90));
  const base = [...hold(o0, 0), ...hold(o1, 400), ...hold(o2, 800)];
  const want = detectRotations(base);

  it('基线', () => {
    expect(want.map(e => e.token)).toEqual(['y', "x'"]);
  });

  it('左乘任意固定旋转(传感器世界系 W):结论一个字都不变', () => {
    // 三个「未知的世界系」:轴对齐的、半转的、以及一个完全歪的
    const bases: Quat[] = [
      axis('z', 90),
      axis('x', 180),
      quatNormalize({ w: 0.3, x: 0.5, y: -0.7, z: 0.4 }),
    ];
    for (const W of bases) {
      const shifted = base.map(s => ({ tMs: s.tMs, q: quatNormalize(quatMul(W, s.q)) }));
      const got = detectRotations(shifted);
      expect(got.map(e => e.token), `W=${JSON.stringify(W)}`).toEqual(want.map(e => e.token));
      expect(got.map(e => e.tMs)).toEqual(want.map(e => e.tMs));
    }
  });

  it('相似变换(传感器装配姿态 M):**个数和角度**照旧,这半是真的免标定', () => {
    for (const M of [axis('z', 90), axis('x', 180), axis('y', 90)]) {
      const conj = base.map(s => ({
        tMs: s.tMs,
        q: quatNormalize(quatMul(quatMul(M, s.q), quatConjugate(M))),
      }));
      const got = detectRotations(conj);
      expect(got.length, `M=${JSON.stringify(M)}`).toBe(want.length);
      expect(got.map(e => e.tMs)).toEqual(want.map(e => e.tMs));
      expect(got.map(e => Math.round((e.angleRad * 180) / Math.PI)))
        .toEqual(want.map(e => Math.round((e.angleRad * 180) / Math.PI)));
    }
  });

  it('相似变换会把**记号**换掉 —— 所以轴向不是免标定的,别再这么写', () => {
    const M = axis('z', 90);
    const conj = base.map(s => ({
      tMs: s.tMs,
      q: quatNormalize(quatMul(quatMul(M, s.q), quatConjugate(M))),
    }));
    // y 绕 U-D 轴;把整套轴绕 Z 转 90° 之后,同一个物理动作就被读成绕别的轴。
    expect(detectRotations(conj).map(e => e.token)).not.toEqual(want.map(e => e.token));
  });

  it('不给 brand = 按正装算,不替调用方加一层它没要的换基', () => {
    expect(detectRotations(base, {}).map(e => e.token)).toEqual(want.map(e => e.token));
    expect(detectRotations(base, { brand: null }).map(e => e.token)).toEqual(want.map(e => e.token));
  });

  it('给了 brand 就吃那张表 —— 现在全表是 Z-up,记号跟着换', () => {
    // 这条不是废话:它把「记号正确」这件事的依赖钉在 `BRAND_SENSOR_BASIS` 上。
    // 表一动这里就红,那正是该重新看一眼记号的时候。
    //
    // 今天表里是 `rotY90X270`:传感器 z 是魔方朝上那根轴(渲染器的 y),而且整套
    // 轴还偏了 90° 的偏航 —— 两轮真机报告各定下一半,见 orientation.ts。所以一个
    // 绕**样本 y 轴**的合成动作在真机语义下根本不是 y。
    expect(detectRotations(base, { brand: 'gan-v4' }).map(e => e.token))
      .toEqual(["x'", 'z']);
  });

  it('真机语义:绕传感器 z 的一次转,带上牌子之后读成 y', () => {
    // 用户报的就是这个 —— 实体做 y,屏幕做 z。样本按传感器系造(绕 z),
    // 不带 brand 读成 z(错的那条路),带 brand 读成 y(对的)。
    const sensor = [...hold(QUAT_IDENTITY, 0), ...hold(axis('z', 90), 400)];
    expect(detectRotations(sensor).map(e => e.token)).toEqual(['z']);
    expect(detectRotations(sensor, { brand: 'gan-v4' }).map(e => e.token)).toEqual(['y']);
  });
});

/**
 * 文字复盘和分步分析表都要把「每步最后一手的下标」翻成时刻界。以前各写一遍,现在
 * 共用这个 —— 分叉的表现会是「同一把,文字里有那次转体、表里没有」,不好查。
 */
describe('stepTimeBounds', () => {
  const moves = [{ ts: 0 }, { ts: 100 }, { ts: 200 }, { ts: 300 }];

  it('界取那一步最后一手的时刻', () => {
    expect(stepTimeBounds([0, 1, 3], moves)).toEqual([0, 100, Infinity]);
  });

  it('最后一步管到无穷 —— 拧完再把魔方摆正那次转体归它', () => {
    // 末步的 endIdx 就算不是最后一手,也照样开口
    expect(stepTimeBounds([1, 2], moves)[1]).toBe(Infinity);
  });

  it('收尾在最后一手上的那步同样开口', () => {
    expect(stepTimeBounds([3, 3, 3], moves)).toEqual([Infinity, Infinity, Infinity]);
  });

  it('endIdx 是 null 的一步零宽,不从邻居那儿偷转体', () => {
    // 第 1 步没发生过(白给的那一对):它的界 = 上一界,窗口宽度为 0
    const b = stepTimeBounds([1, null, 2, 3], moves);
    expect(b[0]).toBe(100);
    expect(b[1]).toBe(100);
    expect(b[2]).toBe(200);
    expect(b[3]).toBe(Infinity);
  });

  it('第一步就是 null 时不炸,界回落到 0', () => {
    expect(stepTimeBounds([null, 2], moves)).toEqual([0, Infinity]);
  });

  it('空列表给空数组', () => {
    expect(stepTimeBounds([], moves)).toEqual([]);
  });
});

describe('rotationsByStep', () => {
  const evs = [
    { tMs: 100, token: 'y', angleRad: Math.PI / 2 },
    { tMs: 900, token: 'x', angleRad: Math.PI / 2 },
    { tMs: 1500, token: "y'", angleRad: Math.PI / 2 },
  ];

  it('按时刻落到各步里,边界归左边那步', () => {
    // 三步:0-900、900-1400、1400-2000
    const byStep = rotationsByStep(evs, [900, 1400, 2000]);
    expect(byStep.map(s => s.map(e => e.token))).toEqual([['y', 'x'], [], ["y'"]]);
  });

  it('最后一步之后的收尾转体归最后一步,不丢', () => {
    const byStep = rotationsByStep(evs, [200, 800]);
    expect(byStep.map(s => s.length)).toEqual([1, 2]);
  });

  it('没有转体时每一步都是空数组,不是 undefined', () => {
    expect(rotationsByStep([], [100, 200])).toEqual([[], []]);
  });
});
