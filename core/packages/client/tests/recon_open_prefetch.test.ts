/**
 * 复盘打开路径:同一页 + 懒加载守卫。
 * =========================================================================
 *
 * 两件事钉在一起,因为它们是同一条路径的两头。
 *
 * **一、复盘不许再退回第二次点击。** 2026-08-02 用户报的:成绩详情里要再点一下
 * 「查看复盘」才看得到报告,而那一下要先知道有这个东西。现在报告就渲染在成绩详情
 * 这一页上。这里守住它别被改回去 —— 详情页必须自己渲染 ReconstructReport,且不
 * 存在一个把报告藏到另一屏去的回调。
 *
 * **二、别把瀑布拉回来。** 起因(2026-08-01,Chrome resource timing 实测):点
 * 「查看复盘」到面板能滚要等 1473ms —— 不是算法慢,是**三级串行**的懒加载链,每
 * 一层都得等上一层先执行起来才开始下载:
 *
 *   打开 ─┬─ 报告自己的 chunk(211 KB)────────────────────────── 916ms
 *         └─ 等它执行 ─┬─ oll/pll 查找表 chunk ──────────────── 405ms
 *                      │        └─ 再等它去取 /oll /pll 公式库
 *                      └─ SimCubeView → mountSimWorld → three ─ 213ms
 *
 * 修法是在成绩详情挂载时就把整条链并行拉下来(SolveModal 的 onIdle),轮到渲染时
 * 模块已在注册表里。实测 1473ms → 98ms,主线程长任务 633ms → 171ms。
 *
 * 这条守的是**覆盖关系**,不是速度:复盘路径上每一个 `import()` 出去的模块,都必须
 * 在 SolveModal 的清单里。以后谁给这条路径再加一个动态模块却忘了预取,瀑布会悄悄
 * 长回一级 —— 页面照常能用,只是又卡了,没有测试的话没人会发现。
 *
 * 一并钉住那颗 3D 魔方的可见性门:页面刚打开时它在视口外,建 WebGL world 是主线程
 * 上 76ms 的活,不该抢在首屏前面。
 */
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const TIMER = join(ROOT, 'app', '[lang]', 'timer');

const SOLVE_MODAL = join(TIMER, '_components', 'SolveModal.tsx');
const SOLO_VIEW = join(TIMER, '_shell', 'SoloView.tsx');
const PLAYBACK = join(TIMER, '_components', 'PlaybackPanel.tsx');
// 三维魔方是 /timer 和公式训练器共用的,住在共享的 sim-embed 里,不在 timer 页里。
const SIM_CUBE = join(ROOT, 'components', 'sim-embed', 'SimCubeView.tsx');

const read = (p: string) => readFileSync(p, 'utf8');

/** 每个 `import('x')` 的说明符。静态 `import x from 'y'` 不算 —— 那是同一个 chunk。 */
function dynamicImports(src: string): string[] {
  return [...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]);
}

/**
 * 说明符 → 相对 client 根的 posix 路径,好跨文件比较:`./ReconstructModal`(在
 * _components 里写的)和 `../_components/ReconstructModal`(在 _shell 里写的)是
 * 同一个模块,不归一化就比不出来。`@/` 是 client 根别名。
 */
function resolveSpec(spec: string, fromFile: string): string {
  const abs = spec.startsWith('@/')
    ? join(ROOT, spec.slice(2))
    : resolve(dirname(fromFile), spec);
  return relative(ROOT, abs).split('\\').join('/');
}

const prefetched = new Set(
  dynamicImports(read(SOLVE_MODAL)).map(s => resolveSpec(s, SOLVE_MODAL)),
);

describe('复盘就在成绩详情这一页上', () => {
  const src = read(SOLVE_MODAL);

  it('成绩详情自己渲染报告', () => {
    expect(src).toMatch(/<ReconstructReport\b/);
  });

  it('报告仍是独立 chunk —— 没录动作的成绩不该为它买单', () => {
    // 静态 import 会把 211 KB 并进「点一条成绩」那一下,连手动计时的成绩也一起付。
    expect(src).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('\.\/ReconstructReport'\)/);
  });

  it('没有「把报告挪到另一屏」的回调 —— 那正是用户报的那一下多余点击', () => {
    expect(src).not.toMatch(/onOpenReconstruct/);
    // 按钮文案,不是注释里提这四个字 —— 那段来历值得留着。
    expect(src).not.toMatch(/zh:\s*'查看复盘'/);
  });

  it('详情页开着的是报告组件,不是复盘弹窗(否则会有两层 dialog)', () => {
    expect(src).not.toMatch(/ReconstructModal/);
  });

  it('独立复盘弹窗还在,给 ?replay= 那种没有成绩页可挂的场合,且照旧懒加载', () => {
    const specs = dynamicImports(read(SOLO_VIEW)).map(s => resolveSpec(s, SOLO_VIEW));
    expect(specs).toContain('app/[lang]/timer/_components/ReconstructModal');
  });
});

describe('复盘打开路径:懒加载的都得先预取', () => {
  it('SolveModal 确实在预取(不是空清单)', () => {
    expect(prefetched.size).toBeGreaterThanOrEqual(3);
  });

  // 链上三段,各自由不同的文件 import() 出去 —— 少任何一段,打开后就多一级往返。
  // 头一段和后两段的区别:报告本体是 SolveModal 自己 dynamic 出去的(渲染即下载),
  // 后两段藏在它内部,不显式预取就得等它先跑起来。
  const CHAIN: Array<{ what: string; file: string; match: RegExp }> = [
    { what: '报告本体', file: SOLVE_MODAL, match: /_components\/ReconstructReport$/ },
    { what: '三维魔方', file: PLAYBACK, match: /sim-embed\/SimCubeView$/ },
    { what: 'sim 引擎挂载', file: SIM_CUBE, match: /sim-embed\/mountSimWorld$/ },
  ];

  for (const { what, file, match } of CHAIN) {
    it(`${what} —— 懒加载,且在预取清单里`, () => {
      const specs = dynamicImports(read(file)).map(s => resolveSpec(s, file));
      const found = specs.filter(s => match.test(s));
      // 先确认它真是动态加载的。哪天改成静态 import 了,这条会红 —— 那时该做的是
      // 删掉对应的预取,而不是放宽断言。
      expect(found, `${file} 里没有匹配 ${match} 的 import()`).not.toHaveLength(0);
      for (const spec of found) expect(prefetched, `${what}(${spec})未被预取`).toContain(spec);
    });
  }

  it('OLL / PLL 查找表不止拉下来,还要建好表', () => {
    const src = read(SOLVE_MODAL);
    // 光 import 只是把模块拿到手;表是几千次 cubing.js 解析,得显式 prewarm。
    expect(src).toMatch(/prewarmOllTable\(\)/);
    expect(src).toMatch(/prewarmPllTable\(\)/);
  });

  it('预取推到空闲,且有上界 —— 一直不闲也不能干等', () => {
    const src = read(SOLVE_MODAL);
    expect(src).toMatch(/onIdle\(/);
    const timeout = src.match(/\{\s*timeout:\s*(\d+)\s*\}/);
    expect(timeout, '预取的 onIdle 没给 timeout').not.toBeNull();
    expect(Number(timeout![1])).toBeLessThanOrEqual(1000);
  });
});

describe('三维魔方等滚到跟前再建', () => {
  const src = read(PLAYBACK);

  it('SimCubeView 挂在可见性门后面,不是无条件渲染', () => {
    // `cubeNear ? <SimCubeView` —— 中间允许换行/空白。
    expect(src).toMatch(/cubeNear\s*\?\s*\(\s*\n\s*<SimCubeView/);
  });

  it('门是 IntersectionObserver,且带提前量', () => {
    expect(src).toMatch(/new IntersectionObserver\(/);
    expect(src).toMatch(/rootMargin:\s*'\d+px'/);
  });

  it('没有 IntersectionObserver 的浏览器直接放行,不能永远空着', () => {
    expect(src).toMatch(/typeof IntersectionObserver !== 'function'.*setCubeNear\(true\)/s);
  });

  it('占位盒和魔方宿主同一个 class —— 尺寸一致,替换时不跳', () => {
    // 实测过:少了这个占位,盒子高度是 0,魔方一出现下面的内容整体跳 200px。
    expect(src).toMatch(/<div className="timer-live-cube-3d" aria-hidden \/>/);
  });
});
