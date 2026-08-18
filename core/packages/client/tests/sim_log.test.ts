/**
 * planSimUpdate —— 回放/实时那颗魔方到底是「转给你看」还是「瞬切」。
 *
 * 这里最要紧的一条不是判据,是**共轭对不对**:push 的记号错了,屏幕上会转错一层,
 * 而且转得理直气壮 —— 状态和真实局面从此分岔,直到某一步看着不对劲。所以有一组测试
 * 不看返回值长什么样,直接拿 timer 自己的 facelet 模型算:
 *
 *     瞬切会得到的局面  ==  「上一帧的局面」再接上 push 的那串
 *
 * 两边都用 `applyScramble` 独立算,共轭写反了立刻红 —— 这正是 humanize 那次抓到方向
 * 搞反的同一种测法(`conjugateToken` 给的是 ρ⁻¹tρ,不是 ρtρ⁻¹,肉眼看不出来)。
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_LIVE_ANIMATION_BACKLOG,
  planLiveSimUpdate,
  planSimUpdate,
} from '@/app/[lang]/timer/_lib/cube/sim_log';
import { applyScramble, type CubeFaces } from '@/app/[lang]/timer/_lib/cube/state';

const S = (turns: string, pose = '') => ({ turns, pose });

/** 一条串作用在复原三阶上的六面贴纸。 */
const faces = (exp: string): CubeFaces => applyScramble(3, exp);

/** 两个局面完全一致(六个面逐格比)。 */
function sameState(a: CubeFaces, b: CubeFaces): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

describe('planSimUpdate:什么时候瞬切', () => {
  it('animate 关 = 一律 setup', () => {
    const p = planSimUpdate(S('R U'), S('R U F'), false);
    expect(p).toEqual({ mode: 'setup', exp: 'R U F' });
  });

  it('首次挂载(老日志是空的)不播 —— 整条打乱「播放」一遍不是动画', () => {
    const p = planSimUpdate(S(''), S("R U R' U'"), true);
    expect(p.mode).toBe('setup');
  });

  it('往回退(不是追加)瞬切', () => {
    const p = planSimUpdate(S('R U F'), S('R U'), true);
    expect(p).toEqual({ mode: 'setup', exp: 'R U' });
  });

  it('中途改写(前缀不同)瞬切', () => {
    const p = planSimUpdate(S('R U F'), S("R U' F"), true);
    expect(p.mode).toBe('setup');
  });

  it('前缀撞车:`R` 不是 `R2` 的前缀', () => {
    // 只比字符串会把 'R2' 看成 'R' + '2';判据带了空格才不会。
    const p = planSimUpdate(S('R'), S('R2'), true);
    expect(p.mode).toBe('setup');
  });

  it('姿态自己变了(开/关陀螺仪)瞬切,哪怕动作也在往下写', () => {
    const p = planSimUpdate(S('R U', 'x'), S('R U F', ''), true);
    expect(p).toEqual({ mode: 'setup', exp: 'R U F' });
  });

  it('什么都没变也瞬切(不会 push 一个空串)', () => {
    const p = planSimUpdate(S('R U'), S('R U'), true);
    expect(p.mode).toBe('setup');
  });
});

describe('planSimUpdate:追加就转给你看', () => {
  it('没有姿态时 push 的就是新那几手', () => {
    const p = planSimUpdate(S('R U'), S("R U F'"), true);
    expect(p).toEqual({ mode: 'push', exp: "F'" });
  });

  it('一次追加多手也一起 push(BLE 一个包里落两手)', () => {
    const p = planSimUpdate(S('R U'), S("R U F' D2"), true);
    expect(p).toEqual({ mode: 'push', exp: "F' D2" });
  });

  it('有姿态时 push 的是共轭过的记号,不是原记号', () => {
    // x 之后原来的 F 层跑到了 U 的位置 —— 直接 push 'F' 会转错层。
    const p = planSimUpdate(S('R U', 'x'), S('R U F', 'x'), true);
    expect(p.mode).toBe('push');
    expect(p.exp).not.toBe('F');
  });

  it('宽层能共轭(它只是个面 + w),照样播', () => {
    const p = planSimUpdate(S('R U', 'x'), S('R U Rw2', 'x'), true);
    expect(p).toEqual({ mode: 'push', exp: 'Rw2' });   // x 不动 R 面
  });

  it('认不出来的记号整串放弃共轭 → 瞬切(宁可少段动画,不押猜出来的一手)', () => {
    // 宽中层不是我们要认的东西 —— conjugateToken 对它返回 null。
    const p = planSimUpdate(S('R U', 'x'), S('R U Mw2', 'x'), true);
    expect(p.mode).toBe('setup');
  });
});

describe('planLiveSimUpdate:实况追帧', () => {
  it('没有积压时保留完整动画', () => {
    expect(planLiveSimUpdate(S('R U'), S('R U F'), true, 0)).toEqual({
      mode: 'push',
      exp: 'F',
    });
  });

  it('当前动画加待播未超过上限时不跳步', () => {
    expect(planLiveSimUpdate(
      S('R U'),
      S("R U F'"),
      true,
      MAX_LIVE_ANIMATION_BACKLOG - 1,
    )).toEqual({ mode: 'push', exp: "F'" });
  });

  it('积压超过上限时瞬时应用旧动作,只动画最新动作', () => {
    expect(planLiveSimUpdate(
      S('R U'),
      S("R U F' D2"),
      true,
      1,
    )).toEqual({
      mode: 'catch-up',
      setupExp: "R U F'",
      pushExp: 'D2',
    });
  });

  it('带观看姿态追帧后仍把最新动作共轭到正确层', () => {
    const next = S('R U F D', 'x');
    const plan = planLiveSimUpdate(S('R U', 'x'), next, true, 1);
    expect(plan.mode).toBe('catch-up');
    if (plan.mode !== 'catch-up') return;
    expect(sameState(faces(`${plan.setupExp} ${plan.pushExp}`), faces('R U F D x'))).toBe(true);
  });
});

describe('共轭真的对:算局面,不看记号', () => {
  // 六个视角旋转(orient.ts 的 ROTATION_TO_D)+ 恒等,各配一手不同的新招。
  const POSES = ['', 'x', "x'", 'x2', 'y', "y'", 'z', "z'", 'z2', 'x y'];
  const NEXT = ['R', "R'", 'R2', 'U', "F'", 'D2', 'L', "B'", 'M', "S'", 'E2', 'x', "y'"];
  const PREV = "R U R' U' F2 D";

  for (const pose of POSES) {
    for (const m of NEXT) {
      it(`pose=${pose || '(无)'} 追加 ${m}`, () => {
        const plan = planSimUpdate(S(PREV, pose), S(`${PREV} ${m}`, pose), true);
        // 瞬切会得到的那个局面 —— 这是唯一的正确答案,与本函数无关地算出来。
        const goal = faces(pose ? `${PREV} ${m} ${pose}` : `${PREV} ${m}`);
        const shown = pose ? `${PREV} ${pose}` : PREV;
        if (plan.mode === 'setup') {
          expect(sameState(faces(plan.exp), goal)).toBe(true);
          return;
        }
        // push:引擎是在**当前屏幕上那个局面**后面接着转 plan.exp。
        expect(sameState(faces(`${shown} ${plan.exp}`), goal)).toBe(true);
      });
    }
  }
});

describe('回放那条路:一手一手走完整把,每一步都必须动画且状态不漂', () => {
  const SCRAMBLE = "R U R' U' D2 F R2 B' L U2";
  const SOLVE = "y R U R' F' L D2 M' U2 B R2 S".split(' ');
  const POSE = "x'";

  it('第一步之后每一步都是 push,且局面始终等于瞬切的结果', () => {
    let prev = S(SCRAMBLE, POSE);
    // 屏幕上此刻的串。push 之后它就是「老串 + push 的那段」。
    let shown = `${SCRAMBLE} ${POSE}`;
    let pushes = 0;
    for (let i = 0; i < SOLVE.length; i++) {
      const turns = `${SCRAMBLE} ${SOLVE.slice(0, i + 1).join(' ')}`;
      const next = S(turns, POSE);
      const plan = planSimUpdate(prev, next, true);
      if (plan.mode === 'push') {
        pushes += 1;
        shown = `${shown} ${plan.exp}`;
      } else {
        shown = plan.exp;
      }
      expect(sameState(faces(shown), faces(`${turns} ${POSE}`))).toBe(true);
      prev = next;
    }
    // 全都得动画 —— 一次 setup 都不该有,这正是修好的那条 bug。
    expect(pushes).toBe(SOLVE.length);
  });
});
