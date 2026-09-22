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
const WEB_RECAP = join(TIMER, '_components', 'SolveRecap.tsx');
const SHELL_CSS = join(TIMER, '_shell', 'shell.css');
const RECAP = join(ROOT, '..', 'timer-ui', 'src', 'reconstruct', 'SolveRecap.tsx');
const RECAP_PLACEHOLDER = join(ROOT, '..', 'timer-ui', 'src', 'reconstruct', 'SolveRecapPlaceholder.tsx');
const RECAP_CSS = join(ROOT, '..', 'timer-ui', 'src', 'reconstruct', 'solve-recap.css');

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

describe('复原后自动复盘', () => {
  const src = read(SOLO_VIEW);
  const recordStart = src.indexOf('const recordSolve = useCallback');
  const recordSolve = src.slice(recordStart, src.indexOf('const timer = useTimer', recordStart));
  const dismissStart = src.indexOf('const dismissAutoRecapOnMove');
  const dismissOnMove = src.slice(dismissStart, src.indexOf('subscribers.add', dismissStart));

  it('桌面继续在计时页右栏渲染复盘', () => {
    expect(src).toMatch(/<SolveRecap\b/);
    expect(src).toMatch(/\{isDesktop && !panelTab && solveRecap && \(/);
  });

  it('移动端停表后直接打开带来源标记的整屏详情', () => {
    expect(recordStart).toBeGreaterThan(0);
    expect(recordSolve).toMatch(/if \(showRecap && !isDesktop\) \{\s*setModalSolve\(\{ s: solve, idx: solveIndex, autoRecap: true \}\);/);
    expect(src).not.toMatch(/\{!isDesktop && solveRecap\}/);
  });

  it('仍是独立 chunk —— 手动计时的人不该为一份不会渲染的报告买单', () => {
    expect(src).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('\.\.\/_components\/SolveRecap'\)/);
  });

  it('该不该自动打开走 shouldAutoRecap,不在视图里另写一套判据', () => {
    expect(src).toMatch(/shouldAutoRecap\(/);
  });

  it('智能魔方任意一手都会关闭自动整屏复盘', () => {
    expect(dismissStart).toBeGreaterThan(0);
    expect(dismissOnMove).toMatch(/current\?\.autoRecap && current\.s\.id === recapId \? null : current/);
    expect(dismissOnMove).toMatch(/setRecapId\(null\)/);
  });

  it('历史记录手动打开的详情没有 autoRecap 标记,不会被转动订阅误关', () => {
    expect(src).toMatch(/onRowClick=\{\(s, idx\) => setModalSolve\(\{ s, idx \}\)\}/);
    expect(dismissOnMove).toMatch(/current\?\.autoRecap/);
  });

  it('开下一把就清掉复盘标识', () => {
    expect(src).toMatch(/timer\.phase !== 'stopped'[\s\S]{0,40}setRecapId\(null\)/);
  });

  it('报告本体只有一份实现:右栏和整屏都复用 ReconstructReport', () => {
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

describe('复盘异步加载时先稳定容器', () => {
  const solo = read(SOLO_VIEW);
  const recap = read(RECAP);

  it('外层 chunk 等待期间立即渲染与正式复盘同框的占位', () => {
    expect(solo).toMatch(/import SolveRecapPlaceholder from '@cuberoot\/timer-ui\/solve-recap-placeholder'/);
    expect(solo).toMatch(/const SolveRecap = dynamic\([\s\S]{0,220}loading:\s*SolveRecapPlaceholder/);

    const placeholder = read(RECAP_PLACEHOLDER);
    expect(placeholder).toMatch(/<section className="shell-recap shell-recap-placeholder"/);
    expect(placeholder).toMatch(/<div className="shell-recap-body">[\s\S]*<SolveRecapBodyPlaceholder\s*\/>/);
  });

  it('chunk 已缓存时，每一把只用一个绘制帧稳定空容器', () => {
    const adapter = read(WEB_RECAP);
    expect(adapter).toMatch(/import \{ useEffect, useState \} from 'react'/);
    expect(adapter).toMatch(/import SolveRecapPlaceholder from '@cuberoot\/timer-ui\/solve-recap-placeholder'/);
    expect(adapter).toMatch(/revealedSolveId !== props\.solve\.id[\s\S]{0,80}<SolveRecapPlaceholder\s*\/>/);
    expect(adapter.match(/requestAnimationFrame\(/g)).toHaveLength(1);

    const placeholder = read(RECAP_PLACEHOLDER);
    expect(placeholder).not.toMatch(/placeholder-(?:line|metrics)/);
  });

  it('桌面自动复盘不在完整报告挂载时动画改变栏宽', () => {
    const css = read(SHELL_CSS);
    const rule = css.match(/\.timer-shell\.recap-open\s*\{([^}]*)\}/);
    expect(rule, 'shell.css 里没有自动复盘右栏规则').not.toBeNull();
    expect(rule![1]).toMatch(/transition:\s*none/);
  });

  it('报告自身的 lazy 边界也保留正文占位', () => {
    expect(recap).toMatch(/import \{ SolveRecapBodyPlaceholder \} from '\.\/SolveRecapPlaceholder'/);
    expect(recap).toMatch(/<Suspense fallback=\{<SolveRecapBodyPlaceholder\s*\/>\}>/);
    expect(recap).not.toMatch(/<Suspense fallback=\{null\}>/);
  });

  it('占位没有额外动画，内容到达时只做原位替换', () => {
    const css = read(RECAP_CSS);
    const placeholderRules = css.match(/\/\* Recap loading placeholder[\s\S]*$/)?.[0] ?? '';
    expect(placeholderRules).toContain('.shell-recap-placeholder');
    expect(placeholderRules).not.toMatch(/placeholder-(?:line|metrics)/);
    expect(placeholderRules).not.toMatch(/animation\s*:/);
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

describe('移动端复盘不再挤压计时区', () => {
  const src = read(SOLO_VIEW);
  const shell = read(SHELL_CSS);
  const css = shell + read(RECAP_CSS);

  it('比赛来源跟随打乱滚动,不能吸附到短视口底部遮住下一把打乱', () => {
    const stripCss = read(join(ROOT, '..', 'timer-ui', 'src', 'scramble-strip.css'));
    const sourceRules = [...(css + stripCss).matchAll(/[^{}]*\.scramble-src-row[^{}]*\{([^}]*)\}/g)];
    expect(sourceRules.length).toBeGreaterThan(0);
    for (const rule of sourceRules) {
      expect(rule[1]).not.toMatch(/position:\s*(?:sticky|absolute|fixed)/);
    }
  });

  it('窄屏不再挂载内联复盘或预留垂直高度', () => {
    expect(src).not.toMatch(/\{!isDesktop && solveRecap\}/);
    expect(shell).not.toMatch(/--recap-h|:has\(> \.shell-recap\)|timer-shell:has\(\.shell-recap\)/);
  });

  it('桌面右栏形态保持不变', () => {
    expect(src).toMatch(/\{isDesktop && !panelTab && solveRecap && \(/);
    expect(shell).toMatch(/\.shell-recap-rail/);
  });

  it('普通态和桌面侧栏态都扣除页面通知栏高度', () => {
    const visibleHeight = String.raw`calc\(100dvh - var\(--page-notice-h,\s*0px\)\)`;
    expect(shell).toMatch(new RegExp(String.raw`\.timer-shell\s*\{[^}]*min-height:\s*${visibleHeight}`));
    expect(shell).toMatch(new RegExp(String.raw`\.timer-shell\.panel-open\s*\{[^}]*height:\s*${visibleHeight}`));
  });
});
