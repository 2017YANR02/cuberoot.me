/**
 * 拧完那把的复盘,就在计时页上。
 * =========================================================================
 *
 * 2026-08-03 用户提的两件事,守在一起,因为它们是同一个场景的两半:智能魔方拧完
 * 一把,屏幕上该有东西看,而不用自己去成绩里翻。
 *
 * **一、拧完就摊开。** 判据是 `shouldAutoRecap` —— 只有录到动作流的成绩才配这半屏
 * (报告里每个数都从动作流来),开关关掉则一律不摊。判定写错不是显示 bug 是打扰:
 * 手动计时的人每把都要点一下收起。
 *
 * **二、计时中那颗智能魔方不许被淡掉。** 「专注模式」(`.is-solving`)本来是给静态
 * 打乱图和打乱文字设计的 —— 拧起来之后它们确实只剩干扰。实时魔方是反过来的:它讲
 * 的是手里那颗现在什么样,每一手都在变,只有计时中才有内容。跟着一起淡掉等于在唯一
 * 有意义的那段时间里关掉它,而 /alg 训练器那颗是全程都在的。
 *
 * 还钉住那块的懒加载:报告 200 KB 起步(还牵三维魔方和 cubing.js),不能焊进计时页
 * 首屏 —— 手动计时的人一次也不会渲染它。但它又是「拧完必然出现」的东西,所以魔方
 * 一连上就预取整条链,而不是等停表那一下才开始下载。
 */
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { shouldAutoRecap } from '@/app/[lang]/timer/_lib/reconstruct/recap';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const TIMER = join(ROOT, 'app', '[lang]', 'timer');
const SOLO_VIEW = join(TIMER, '_shell', 'SoloView.tsx');
const SHELL_CSS = join(TIMER, '_shell', 'shell.css');
const RECAP = join(TIMER, '_components', 'SolveRecap.tsx');

const read = (p: string) => readFileSync(p, 'utf8');

describe('shouldAutoRecap —— 哪把成绩配得上那半屏', () => {
  const moves = [{ m: 'R', ts: 0 }];

  it('录到动作流 + 开关默认(未设) → 摊开', () => {
    expect(shouldAutoRecap({ moves }, {})).toBe(true);
  });

  it('录到动作流 + 开关显式开 → 摊开', () => {
    expect(shouldAutoRecap({ moves }, { autoRecap: true })).toBe(true);
  });

  it('开关关掉 → 再有动作流也不摊(仍可从成绩里点开)', () => {
    expect(shouldAutoRecap({ moves }, { autoRecap: false })).toBe(false);
  });

  it('没有动作流(手动 / 键盘计时)→ 不摊', () => {
    // 报告里每个数都从动作流来,没有它剩下的只是读数上已经写着的那个时间。
    expect(shouldAutoRecap({ moves: undefined }, {})).toBe(false);
    expect(shouldAutoRecap({ moves: [] }, {})).toBe(false);
  });
});

describe('复盘挂在计时页上', () => {
  const src = read(SOLO_VIEW);

  it('计时页自己渲染那块', () => {
    expect(src).toMatch(/<SolveRecap\b/);
  });

  it('仍是独立 chunk —— 手动计时的人不该为一份不会渲染的报告买单', () => {
    expect(src).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('\.\.\/_components\/SolveRecap'\)/);
  });

  it('该不该摊开走 shouldAutoRecap,不在视图里另写一套判据', () => {
    expect(src).toMatch(/shouldAutoRecap\(/);
  });

  it('开下一把就收起 —— 停表以外的任何阶段都清掉', () => {
    // 观察、按住、计时中都不该有半屏复盘压在下面。
    expect(src).toMatch(/timer\.phase !== 'stopped'[\s\S]{0,40}setRecapId\(null\)/);
  });

  it('报告本体只有一份实现:这块渲染的是 ReconstructReport,不是精简版分叉', () => {
    expect(read(RECAP)).toMatch(/import\('\.\/ReconstructReport'\)/);
  });
});

describe('停表那一下不该现下载 200 KB', () => {
  const src = read(SOLO_VIEW);
  // 链上四段各自由不同文件 import() 出去,少任何一段,拧完就多等一级往返。
  const CHAIN = ['SolveRecap', 'ReconstructReport', 'SimCubeView', 'mountSimWorld'];

  for (const mod of CHAIN) {
    it(`${mod} 在预取清单里`, () => {
      expect(src).toMatch(new RegExp(`import\\('[^']*${mod}'\\)`));
    });
  }

  it('预取由「魔方连上」触发,推到空闲且有上界', () => {
    // 连了智能魔方的人下一步几乎必然是拧一把 —— 那是这条链唯一的用户。
    expect(src).toMatch(/if \(!cubeConnected\) return;[\s\S]{0,200}onIdle\(/);
    const idle = src.match(/onIdle\([\s\S]{0,600}?\{ timeout: (\d+) \}\)/);
    expect(idle, 'SoloView 的预取没有 onIdle + timeout').not.toBeNull();
    expect(Number(idle![1])).toBeLessThanOrEqual(2000);
  });
});

describe('计时中那颗智能魔方留在屏幕上', () => {
  const css = read(SHELL_CSS);

  it('专注模式对实时魔方开了例外', () => {
    // `:has(.timer-live-cube)` 精确挑出实时那一种:同一个格子的另一位租客是静态
    // 打乱图,那个照旧淡出。
    const rule = css.match(
      /\.timer-shell\.is-solving[^{]*\.timing-surface-cube:has\(\.timer-live-cube\)\s*\{([^}]*)\}/,
    );
    expect(rule, 'shell.css 里没有「计时中保留实时魔方」那条规则').not.toBeNull();
    expect(rule![1]).toMatch(/opacity:\s*1/);
  });

  it('例外不越过用户显式选的「计时中隐藏全部界面」', () => {
    expect(css).toMatch(/\.timer-shell\.is-solving:not\(\.hide-ui\)[^{]*\.timing-surface-cube:has\(\.timer-live-cube\)/);
  });

  it('留下的是魔方本身,不是它底下的校准按钮', () => {
    // 校准是拧之前摆正朝向的动作,计时中没人按它。
    expect(css).toMatch(/\.timer-shell\.is-solving[^{]*\.live-cube-calibrate\s*\{[^}]*opacity:\s*0/);
  });
});

describe('复盘那一格不许把计时区挤出视口', () => {
  const css = read(SHELL_CSS);

  it('展开时外壳钉成正好一屏', () => {
    // 平时外壳是 min-height:100dvh(可被内容撑高)。不钉死,「空间不足」这个前提就
    // 不成立,flex-shrink 永远不触发 —— 实测是整页多出 105px 滚动条。
    expect(css).toMatch(/\.timer-shell:has\(\.shell-recap\)\s*\{[^}]*height:\s*100dvh/);
  });

  it('那一格自己可收缩,让位给计时区压不动的部分', () => {
    const rule = css.match(/\n\.shell-recap\s*\{([^}]*)\}/);
    expect(rule, 'shell.css 里没有 .shell-recap').not.toBeNull();
    expect(rule![1]).toMatch(/flex:\s*0 1 auto/);
    expect(rule![1]).toMatch(/min-height:\s*0/);
  });

  it('绝对定位的统计条跟着往上让 —— 它是成绩面板的唯一入口', () => {
    expect(css).toMatch(/:has\(> \.shell-recap\) \.shell-stat-rail\s*\{[^}]*bottom:\s*calc\(var\(--recap-h\)/);
  });
});
