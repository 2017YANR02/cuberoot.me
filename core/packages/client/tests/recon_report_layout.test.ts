/**
 * 复盘报告的顺序:先「怎么拧的」,再「拧得怎么样」。
 * =========================================================================
 *
 * 2026-08-03 用户提的三件事,是同一个判断的三个面:
 *
 * **一、数据那一半排在回放和还原步骤后面。** 以前报告一开口就是质量分 + 阶段条 +
 * 5×7 的分步分析表,道理是「这把慢在哪」该一眼看到。但那假设了读者已经知道自己
 * 拧了什么 —— 真实顺序是反的:先认出这把是怎么拧的,那些数字才有东西可归因。
 * 屏幕上的证据是用户每次都直接往下翻去找还原步骤。
 *
 * **二、打乱是还原步骤的第一行。** 它以前孤零零挂在整页最底下,读还原步骤的人要滚到底
 * 再滚回来才凑齐「从这个局面开始,往下是这么拧的」。搬进还原步骤那一块之后这一块
 * 自己就是一份能照着复现的东西 —— 和复制按钮导出的那份逐字相同。
 *
 * 用的必须是 `recon.scramble`,而 2026-08-04 起它就是**这把真正的打乱** —— 和成绩
 * 里存的、和用户手上拧的那条逐字相同。以前它是「转进十字朝下」共轭之后的写法,
 * 理由是还原步骤写在那个视角里、配原始打乱对不上;理由没错,办法错了:用户做的是
 * `R2 B' L2 R D' …`,报告印的是 `R2 F' L2 R U' …`,「这不行,必须是原始打乱」。
 * 共轭过的那条不是任何人做过的打乱,粘到 cubedb 也对不上。
 *
 * 现在两边这么接:打乱印原始的,视角那一手写成还原步骤的第一行(`recon.inspection`,
 * `z2 // 观察`),和人写复盘一模一样 —— 打乱 + 观察 + 还原步骤接起来照着拧还是这把。
 *
 * **三、智能魔方那把不摆打乱图。** 打乱图是给「照着拧」用的,而这把已经拧完了。
 * 手动计时的成绩仍然两样都有 —— 它们没有还原步骤可以承载打乱。
 */
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { playbackMoveDurationTicks } from '@cuberoot/timer-ui/reconstruct/report-player';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const TIMER = join(ROOT, 'app', '[lang]', 'timer');
const REPORT = join(ROOT, '..', 'timer-ui', 'src', 'reconstruct', 'ReconstructReport.tsx');
const SOLVE_MODAL = join(TIMER, '_components', 'SolveModal.tsx');
const TIMER_UI = join(ROOT, '..', 'timer-ui', 'src');
const SHELL_CSS = join(TIMER, '_shell', 'shell.css');
const DETAIL_MODAL = join(TIMER_UI, 'TimerSolveDetailModal.tsx');
const CONTENT = join(TIMER_UI, 'reconstruct', 'report-content.ts');
const NOTATION = join(TIMER_UI, 'reconstruct', 'report-notation.ts');

const read = (p: string) => readFileSync(p, 'utf8');
/** 只留代码。断言「不许再出现某个写法」时用 —— 注释里讲得清来历,那不算回归。 */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('报告顺序:回放和还原步骤在前,数据在后', () => {
  const src = read(REPORT);

  it('数据那一半是一整块,不是散在各处的几段', () => {
    // 摘成一个 analysisBlock 才谈得上「排在哪」—— 散着的话下一个人往中间插一段
    // 就又回到了老顺序,而没有任何测试能看出来。
    expect(src).toMatch(/const analysisBlock = \(/);
  });

  it('那一块只保留分步分析和阶段补充信息', () => {
    const from = src.indexOf('const analysisBlock = (');
    const block = src.slice(from, src.indexOf('\n  return (', from));
    expect(block).toMatch(/<StepAnalysis\b/);
    expect(block).not.toMatch(/TimerReconstructMetrics|reconstruct-waste-line/);
  });

  it('渲染时排在回放后面', () => {
    const content=read(CONTENT);
    const playback = content.indexOf("slot('playback')");
    const rendered = content.indexOf("slot('analysis')");
    expect(playback, '报告里找不到回放面板').toBeGreaterThan(0);
    expect(rendered, '报告里没有渲染 analysisBlock').toBeGreaterThan(0);
    expect(rendered).toBeGreaterThan(playback);
  });

  it('回放固定展示,不再保留展开行', () => {
    const code = stripComments(src);
    expect(read(CONTENT)).toContain("timerEventNxnSize(solve.event)!=null&&slot('playback')");
    expect(code).not.toMatch(/playbackExpanded|reconstruct-playback-toggle|回放与分步动作/);
  });

  it('参考解法排在数据之后、动作序列之前', () => {
    const content=read(CONTENT);
    const analysis = content.indexOf("slot('analysis')");
    const reference = content.indexOf("disclosure('references'");
    const moves = content.indexOf("disclosure('raw'");
    expect(reference, '报告里找不到参考解法').toBeGreaterThan(analysis);
    expect(moves, '报告里找不到动作序列').toBeGreaterThan(reference);
  });

  it('整把补充统计不再显示拿起时长', () => {
    expect(stripComments(src)).not.toMatch(/stepMetrics\.pickupMs/);
    expect(src).toMatch(/stepMetrics\.putDownMs/);
  });
});

describe('CFOP 分步分析表头', () => {
  const src = read(join(TIMER_UI, 'reconstruct', 'report-columns.ts'));

  it('使用 Cross 与 F1-F4 的紧凑列名', () => {
    expect(src).toMatch(/label: 'Cross'/);
    expect(src).toMatch(/label: `F\$\{i \+ 1\}`/);
    expect(stripComments(src)).not.toMatch(/label: `F2L-/);
  });
});

describe('同一个数不写两遍', () => {
  const report = read(REPORT);
  const timeline = join(TIMER_UI, 'reconstruct', 'SolveTimeline.tsx');

  it('阶段条整页只有一根,且长在回放上', () => {
    // 报告顶部那根和回放那根是同一个组件、同一份切分,只差一个游标。两根并存时
    // 读者第一反应是去找它们的区别 —— 而并不存在区别。
    expect(report).not.toMatch(/<SolveTimeline\b/);
    expect(read(join(TIMER_UI, 'reconstruct', 'PlaybackPanel.tsx'))).toMatch(/<SolveTimeline\b/);
    expect(readFileSync(timeline, 'utf8')).toMatch(/export default function SolveTimeline/);
  });

  it('留下的那根带阶段名和阶段用时', () => {
    const pb = read(join(TIMER_UI, 'reconstruct', 'PlaybackPanel.tsx'));
    // 一根没有标注的彩条只能看出「有几段」。
    expect(pb).toMatch(/<SolveTimeline[\s\S]{0,240}showLabels/);
  });

  it('废步只在动作序列里标记,不再额外显示汇总说明', () => {
    expect(read(CONTENT)).toContain('wasted.has(i)');
    expect(read(CONTENT)).toMatch(/reconstruct-move-row[^\n]*wasted/);
    expect(report).not.toMatch(/reconstruct-waste-line/);
  });
});

describe('回放进度条匀速走', () => {
  const pb = read(join(TIMER_UI, 'reconstruct', 'PlaybackPanel.tsx'));

  it('时钟按墙钟每帧算,不是一手一个定时器', () => {
    // 一手一个 setTimeout 时长是对的,但游标只在那一手落下的瞬间跳一格 —— 两手
    // 之间那 200ms 屏幕完全静止,看起来就是一跳一跳的。
    expect(pb).toMatch(/requestAnimationFrame\(/);
    expect(pb).toMatch(/performance\.now\(\)/);
    // 注释里提得起老写法(那段来历值得留着),代码里不许再有。
    expect(stripComments(pb)).not.toMatch(/setTimeout\(/);
  });

  it('每帧不走 React 状态 —— 60fps 的 setState 会把右栏列表也重画', () => {
    expect(pb).toMatch(/setPlayhead\(/);
    expect(read(join(TIMER_UI, 'reconstruct', 'SolveTimeline.tsx'))).toMatch(/style\.left/);
  });

  it('该播到第几手是从时间反查的,不是自增', () => {
    // 自增会和墙钟脱钩:掉帧 / 后台标签页回来之后,魔方停在半路而游标已经到底。
    expect(pb).toMatch(/playbackFrame\(moves, lastTs, t\)/);
    expect(read(join(TIMER_UI, 'reconstruct', 'playback-track.ts'))).toContain('playbackIndexAt');
  });

  it('虚拟魔方按相邻动作的真实间隔转动', () => {
    // 引擎默认一手 500ms,比真实动作间隔长时会把动作排队,所以回放必须
    // 把当前动作到下一手(或结束)的时间间隔换成 60Hz ticks,并跟随播放倍率。
    expect(pb).toContain('playbackMoveDurationTicks(moves,idx,totalMs,speedMult)');
    const moves = [
      { m: 'R', ts: 100, endTs: 100, rawAfter: 1 },
      { m: 'U', ts: 300, endTs: 400, rawAfter: 2 },
    ];
    expect(playbackMoveDurationTicks(moves, 1, 600, 1)).toBe(12);
    expect(playbackMoveDurationTicks(moves, 1, 600, 2)).toBe(6);
    // Replaced moves must also finish inside their own allocated interval.
    expect(playbackMoveDurationTicks(moves, 2, 600, 1)).toBe(6);
    expect(pb).toMatch(/moveDurationTicks=\{moveDurationTicks\}/);
  });
});

describe('移动端自动打开的解法浮层可手动关闭', () => {
  const panel = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/TimerSolverPanel')), 'utf8');

  it('每个自动打开请求只消费一次,关闭后不会被同一个请求重新打开', () => {
    expect(panel).toMatch(/openedSolveRequestRef\.current === autoOpenOnSolve/);
    expect(panel).toMatch(/openedSolveRequestRef\.current = autoOpenOnSolve/);
  });

  it('自动打开只在桌面左栏生效,移动端保留手动入口', () => {
    expect(panel).toMatch(/if \(isDesktopRail\) setRailOpen\(true\);/);
    expect(panel).not.toMatch(/void setSheetOpen\(true\);\s*\n\s*\}, \[autoOpenOnSolve/);
  });

  it('ready 收起只响应 ready 状态变化,不监听浮层自身开关', () => {
    expect(panel).toMatch(/if \(sheetOpenRef\.current\) closeSheet\(\);/);
    expect(panel).toMatch(/\}, \[autoCollapseOnReady, closeSheet\]\);/);
  });
});

describe('移动端复盘直接进入整屏详情', () => {
  const shell = read(SHELL_CSS);
  const solo = read(join(TIMER, '_shell', 'SoloView.tsx'));

  it('不再挂在计时区下方或保留内联高度预算', () => {
    expect(solo).not.toMatch(/\{!isDesktop && solveRecap\}/);
    expect(shell).not.toMatch(/--recap-h|:has\(> \.shell-recap\)/);
  });

  it('打乱所属比赛留在正常文档流，不覆盖换行后的打乱', () => {
    expect(shell).not.toMatch(/\.timing-surface-scramble-top \.scramble-src-row \{[^}]*position:\s*sticky;/);
  });
});

describe('关闭连续陀螺仪仍回放已识别转体', () => {
  const report = read(REPORT);
  const pb = read(join(TIMER_UI, 'reconstruct', 'PlaybackPanel.tsx'));

  it('文字复盘的转体事件传进回放面板', () => {
    expect(report).toMatch(/<PlaybackPanel[\s\S]{0,500}rotations=\{reconText\?\.rotations\}/);
  });

  it('关闭时执行重建动作，开启时读取原始姿态', () => {
    expect(pb).toContain('reconstructedTrack(lines, rawMoves)');
    expect(pb).toContain('useRebuilt ? () => null');
    expect(pb).toMatch(/playbackQuatRef\.current = poseAt\(at\)/);
    expect(pb).toMatch(/quatRef=\{useRebuilt \? undefined : playbackQuatRef\}/);
  });
});

describe('打乱是还原步骤的第一行', () => {
  const src = read(NOTATION);

  it('还原步骤那一块自己摆打乱', () => {
    expect(src).toContain('sml-group sml-scramble');
  });

  it('摆的是 recon.scramble', () => {
    expect(src).toContain("text:recon.scramble,className:'sml-moves is-seek'");
    expect(src).not.toMatch(/solve\.scramble/);
  });

  it('recon.scramble 就是原始打乱,不是共轭过的那条(2026-08-04)', () => {
    const recon = read(join(ROOT, '..', 'shared', 'src', 'timer', 'reconstruct', 'recon_text.ts'));
    // `phys` 是「魔方自己配色系里的那一份」= 计时器发的原始打乱。
    expect(recon).toMatch(/scramble: phys\.scramble/);
  });

  it('观察那一手印在打乱下面 —— 少了它两边接不上', () => {
    expect(src).toContain('const inspection=projection.inspection');
    expect(src).toContain(":inspection,className:'sml-moves is-seek'");
    const scramble = src.indexOf('sml-scramble');
    const insp = src.indexOf(":inspection,className:'sml-moves is-seek'");
    expect(insp).toBeGreaterThan(scramble);
    expect(insp).toBeLessThan(src.indexOf('...groups,options.notice'));
    // 剪贴板那一份也得带上,否则粘出去的还原步骤照着拧是错的。
    const recon = read(join(ROOT, '..', 'shared', 'src', 'timer', 'reconstruct', 'recon_text.ts'));
    expect(recon).toMatch(/viewRot === '' \? \[\] : \[`\$\{viewRot\} \/\/ insp`\]/);
  });

  it('排在十字前面', () => {
    const scramble = src.indexOf('sml-scramble');
    const groups = src.indexOf('...groups,options.notice');
    expect(scramble).toBeGreaterThan(0);
    expect(groups).toBeGreaterThan(0);
    expect(scramble).toBeLessThan(groups);
  });

  it('屏上这条和复制出去的那条是同一条', () => {
    // reconTextForClipboard 拼的就是 r.scramble;哪天有人给显示换了个来源,
    // 「复制出来和看到的不一样」是最难被发现的那种 bug。
    const recon = read(join(ROOT, '..', 'shared', 'src', 'timer', 'reconstruct', 'recon_text.ts'));
    expect(recon).toMatch(/reconTextForClipboard[\s\S]{0,200}r\.scramble/);
  });
});

describe('阶段名和阶段用时只出现一次(2026-08-04)', () => {
  const src = stripComments(read(NOTATION));

  it('还原步骤这一块不写「十字 [4.02]」', () => {
    // 同一屏左边那根带游标的轴(SolveTimeline showLabels)已经把四段的名字和
    // 用时画出来了。两处都写等于同一件事说两次,而且两处口径一旦分叉没人看得出来。
    expect(src).not.toMatch(/sml-group-ms/);
    // Stage identity is also used for playback grouping; it must not add a second heading.
    expect(src.slice(src.indexOf('{groups.map'))).not.toMatch(/sml-group-head|sml-group-name/);
  });

  it('打乱直接展示原文，不再重复组标题', () => {
    expect(src).not.toMatch(/sml-group-head|sml-group-name/);
    expect(src).toContain("text:recon.scramble,className:'sml-moves is-seek'");
  });

  it('最优评价只保留在分步分析，不重复到动作记录里', () => {
    expect(src).not.toMatch(/sa-grade|gradeFor\(/);
    expect(read(CONTENT)).toContain('sa-grade optimal');
  });});

describe('打乱不许一个字都不剩', () => {
  const src = read(CONTENT);

  it('没有文字复盘的那些把,报告自己兜一条', () => {
    // 非三阶、切分失败、半途放弃的把没有还原步骤可以承载打乱 —— 而详情页已经不摆了。
    expect(src).toContain("'rc-scramble'");
  });

  it('兜底只在没有还原步骤时出现,不和还原步骤里那条打对台', () => {
    expect(src).toContain("!recon?.lines.length&&groupNode('scramble'");
  });
});

describe('智能魔方那把不摆打乱图', () => {
  const src = read(SOLVE_MODAL);
  const detail = read(DETAIL_MODAL);
  // Web 只决定是否注入复盘；共享详情组件据此选择整屏或普通弹窗。
  const start = detail.indexOf('{full ? (');
  const end = detail.indexOf(') : (', start);
  const fullPage = detail.slice(start, end);

  it('测试切到的确实是整屏那个分支', () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(src).toMatch(/report=\{hasMoves \? \([\s\S]{0,120}<ReconstructReport\b/);
    expect(fullPage).toMatch(/\{report\}/);
  });

  it('整屏详情页不再摆打乱图', () => {
    expect(fullPage).not.toMatch(/\{preview/);
  });

  it('整屏详情页不再第二次摆打乱 —— 还原步骤里已经有了', () => {
    expect(fullPage).not.toMatch(/solve\.scramble/);
  });

  it('罚时是一个下拉,不是四个并排的按钮', () => {
    // 四选一、彼此互斥、任何时候只有一个是当前值。并排按钮把「现在是哪个」和
    // 「能改成哪些」画成同样的分量,而看一条成绩九成是在读它。
    expect(detail).toMatch(/const penalty = \([\s\S]{0,300}<select/);
    for (const v of ['ok', '+2', 'DNF', 'DNS']) {
      expect(detail, `罚时下拉少了 ${v}`).toContain(`value="${v}"`);
    }
    expect(detail).not.toMatch(/onClick=\{\(\) => onChangePenalty\(/);
  });

  it('手动 / 键盘计时那个弹窗照旧两样都有', () => {
    // 它们没有还原步骤可以承载打乱,拿掉就真的没了。
    const manual = detail.slice(end);
    expect(manual).toMatch(/solve\.scramble/);
    expect(manual).toMatch(/\{preview/);
  });
});
