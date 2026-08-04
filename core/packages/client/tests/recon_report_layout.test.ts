/**
 * 复盘报告的顺序:先「怎么拧的」,再「拧得怎么样」。
 * =========================================================================
 *
 * 2026-08-03 用户提的三件事,是同一个判断的三个面:
 *
 * **一、数据那一半排在回放和谱子后面。** 以前报告一开口就是质量分 + 阶段条 +
 * 5×7 的分步分析表,道理是「这把慢在哪」该一眼看到。但那假设了读者已经知道自己
 * 拧了什么 —— 真实顺序是反的:先认出这把是怎么拧的,那些数字才有东西可归因。
 * 屏幕上的证据是用户每次都直接往下翻去找谱子。
 *
 * **二、打乱是谱子的第一行。** 它以前孤零零挂在整页最底下,读谱子的人要滚到底
 * 再滚回来才凑齐「从这个局面开始,往下是这么拧的」。搬进谱子那一块之后这一块
 * 自己就是一份能照着复现的东西 —— 和复制按钮导出的那份逐字相同。
 *
 * 用的必须是 `recon.scramble`(视角归一化之后那条,见 orient.ts),不是成绩上的
 * 原始打乱:谱子写在「十字朝下」的视角里,记号已经换过名,配原始打乱对不上,
 * 而对不上的两行摆在一起没人看得出来是哪条错了。
 *
 * **三、智能魔方那把不摆打乱图。** 打乱图是给「照着拧」用的,而这把已经拧完了。
 * 手动计时的成绩仍然两样都有 —— 它们没有谱子可以承载打乱。
 */
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const TIMER = join(ROOT, 'app', '[lang]', 'timer');
const REPORT = join(TIMER, '_components', 'ReconstructReport.tsx');
const STEP_LIST = join(TIMER, '_components', 'StepMoveList.tsx');
const SOLVE_MODAL = join(TIMER, '_components', 'SolveModal.tsx');

const read = (p: string) => readFileSync(p, 'utf8');
/** 只留代码。断言「不许再出现某个写法」时用 —— 注释里讲得清来历,那不算回归。 */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('报告顺序:回放和谱子在前,数据在后', () => {
  const src = read(REPORT);

  it('数据那一半是一整块,不是散在各处的几段', () => {
    // 摘成一个 analysisBlock 才谈得上「排在哪」—— 散着的话下一个人往中间插一段
    // 就又回到了老顺序,而没有任何测试能看出来。
    expect(src).toMatch(/const analysisBlock = \(/);
  });

  it('那一块里确实是质量分 / 分步分析 / 总量,不是个空壳', () => {
    const from = src.indexOf('const analysisBlock = (');
    const block = src.slice(from, src.indexOf('\n  return (', from));
    expect(block).toMatch(/<QualityRow\b/);
    expect(block).toMatch(/<StepAnalysis\b/);
    expect(block).toMatch(/className="reconstruct-stats"/);
  });

  it('渲染时排在回放后面', () => {
    const playback = src.indexOf('<PlaybackPanel');
    const rendered = src.indexOf('{analysisBlock}');
    expect(playback, '报告里找不到回放面板').toBeGreaterThan(0);
    expect(rendered, '报告里没有渲染 analysisBlock').toBeGreaterThan(0);
    expect(rendered).toBeGreaterThan(playback);
  });

  it('回放默认展开 —— 它是主体,不是附录', () => {
    // 排到第一位却折叠着,等于把报告的主体藏在一次点击后面。
    expect(src).toMatch(/const \[playbackExpanded, setPlaybackExpanded\] = useState\(true\)/);
  });
});

describe('同一个数不写两遍', () => {
  const report = read(REPORT);
  const timeline = join(TIMER, '_components', 'SolveTimeline.tsx');

  it('阶段条整页只有一根,且长在回放上', () => {
    // 报告顶部那根和回放那根是同一个组件、同一份切分,只差一个游标。两根并存时
    // 读者第一反应是去找它们的区别 —— 而并不存在区别。
    expect(report).not.toMatch(/<SolveTimeline\b/);
    expect(read(join(TIMER, '_components', 'PlaybackPanel.tsx'))).toMatch(/<SolveTimeline\b/);
    expect(readFileSync(timeline, 'utf8')).toMatch(/export default function SolveTimeline/);
  });

  it('留下的那根带阶段名和阶段用时', () => {
    const pb = read(join(TIMER, '_components', 'PlaybackPanel.tsx'));
    // 一根没有标注的彩条只能看出「有几段」。
    expect(pb).toMatch(/<SolveTimeline[\s\S]{0,240}showLabels/);
  });

  it('HTM 那张卡不再和摘要里的「步数 / TPS」重复', () => {
    const from = report.indexOf('className="reconstruct-stats"');
    const stats = report.slice(from, report.indexOf('</div>\n    </>', from));
    expect(stats).not.toMatch(/>HTM</);
    // QTM 留着:四分之一圈是另一个口径,摘要里没有。
    expect(stats).toMatch(/>QTM</);
  });
});

describe('回放进度条匀速走', () => {
  const pb = read(join(TIMER, '_components', 'PlaybackPanel.tsx'));

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
    expect(read(join(TIMER, '_components', 'SolveTimeline.tsx'))).toMatch(/style\.left/);
  });

  it('该播到第几手是从时间反查的,不是自增', () => {
    // 自增会和墙钟脱钩:掉帧 / 后台标签页回来之后,魔方停在半路而游标已经到底。
    expect(pb).toMatch(/while \(i < total && moves\[i\]\.ts <= at\) i\+\+/);
  });
});

describe('打乱是谱子的第一行', () => {
  const src = read(STEP_LIST);

  it('谱子那一块自己摆打乱', () => {
    expect(src).toMatch(/className="sml-group sml-scramble"/);
  });

  it('摆的是 recon.scramble —— 和谱子同一个视角', () => {
    // 成绩上那条原始打乱是魔方配色系里的写法;谱子是「十字朝下」共轭之后的写法。
    // 两者记号不同,摆在一起对不上。
    expect(src).toMatch(/\{recon\.scramble\}/);
    expect(src).not.toMatch(/solve\.scramble/);
  });

  it('排在十字前面', () => {
    const scramble = src.indexOf('sml-scramble');
    const groups = src.indexOf('{groups.map(');
    expect(scramble).toBeGreaterThan(0);
    expect(groups).toBeGreaterThan(0);
    expect(scramble).toBeLessThan(groups);
  });

  it('屏上这条和复制出去的那条是同一条', () => {
    // reconTextForClipboard 拼的就是 r.scramble;哪天有人给显示换了个来源,
    // 「复制出来和看到的不一样」是最难被发现的那种 bug。
    const recon = read(join(TIMER, '_lib', 'reconstruct', 'recon_text.ts'));
    expect(recon).toMatch(/reconTextForClipboard[\s\S]{0,200}r\.scramble/);
  });
});

describe('阶段名和阶段用时只出现一次(2026-08-04)', () => {
  const src = stripComments(read(STEP_LIST));

  it('谱子这一块不写「十字 [4.02]」', () => {
    // 同一屏左边那根带游标的轴(SolveTimeline showLabels)已经把四段的名字和
    // 用时画出来了。两处都写等于同一件事说两次,而且两处口径一旦分叉没人看得出来。
    expect(src).not.toMatch(/sml-group-ms/);
    expect(src).not.toMatch(/data-stage=/);
  });

  it('组标题只剩打乱那一个', () => {
    expect(src.match(/sml-group-head/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/sml-scramble[\s\S]{0,200}sml-group-head/);
  });

  it('十字 / OLL / PLL 的徽章跟着动作那一行走,没有被一起删掉', () => {
    // 徽章以前挂在组标题上,标题没了要是不搬家就会静悄悄消失 —— 界面上少一个
    // 「妙手」不会报错,只会没人再看见。
    expect(src).toMatch(/g\.key === 'f2l' \|\| g\.lines\.length === 1 \? gradeFor\(line\)/);
    expect(src).toMatch(/className=\{`sa-grade \$\{grade\}`\}/);
  });
});

describe('打乱不许一个字都不剩', () => {
  const src = read(REPORT);

  it('没有文字复盘的那些把,报告自己兜一条', () => {
    // 非三阶、切分失败、半途放弃的把没有谱子可以承载打乱 —— 而详情页已经不摆了。
    expect(src).toMatch(/className="rc-scramble"/);
  });

  it('兜底只在没有谱子时出现,不和谱子里那条打对台', () => {
    expect(src).toMatch(/!\(reconText && reconText\.lines\.length > 0\)[\s\S]{0,120}rc-scramble/);
  });
});

describe('智能魔方那把不摆打乱图', () => {
  const src = read(SOLVE_MODAL);
  // 有动作流的那个分支 = 整屏详情页;下面 overlayStyle 起是手动计时那个小弹窗。
  const start = src.indexOf('if (hasMoves) {');
  const end = src.indexOf('const overlayStyle');
  const fullPage = src.slice(start, end);

  it('测试切到的确实是整屏那个分支', () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(fullPage).toMatch(/<ReconstructReport\b/);
  });

  it('整屏详情页不再摆打乱图', () => {
    expect(fullPage).not.toMatch(/\{cubeRow\}/);
  });

  it('整屏详情页不再第二次摆打乱 —— 谱子里已经有了', () => {
    expect(fullPage).not.toMatch(/\{scrambleSection\}/);
  });

  it('罚时是一个下拉,不是四个并排的按钮', () => {
    // 四选一、彼此互斥、任何时候只有一个是当前值。并排按钮把「现在是哪个」和
    // 「能改成哪些」画成同样的分量,而看一条成绩九成是在读它。
    expect(src).toMatch(/<select[\s\S]{0,200}className="solve-penalty-select"/);
    for (const v of ['ok', '+2', 'DNF', 'DNS']) {
      expect(src, `罚时下拉少了 ${v}`).toContain(`value="${v}"`);
    }
    expect(src).not.toMatch(/onClick=\{\(\) => onChangePenalty\(/);
  });

  it('手动 / 键盘计时那个弹窗照旧两样都有', () => {
    // 它们没有谱子可以承载打乱,拿掉就真的没了。
    const manual = src.slice(end);
    expect(manual).toMatch(/\{scrambleSection\}/);
    expect(manual).toMatch(/\{cubeRow\}/);
  });
});
