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

describe('报告顺序:回放和谱子在前,数据在后', () => {
  const src = read(REPORT);

  it('数据那一半是一整块,不是散在各处的几段', () => {
    // 摘成一个 analysisBlock 才谈得上「排在哪」—— 散着的话下一个人往中间插一段
    // 就又回到了老顺序,而没有任何测试能看出来。
    expect(src).toMatch(/const analysisBlock = \(/);
  });

  it('那一块里确实是质量分 / 分步分析 / 四个总量,不是个空壳', () => {
    const from = src.indexOf('const analysisBlock = (');
    const block = src.slice(from, src.indexOf('\n  return (', from));
    expect(block).toMatch(/<QualityRow\b/);
    expect(block).toMatch(/<StepAnalysis\b/);
    expect(block).toMatch(/className="reconstruct-stats"/);
    expect(block).toMatch(/<SolveTimeline\b/);
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

  it('手动 / 键盘计时那个弹窗照旧两样都有', () => {
    // 它们没有谱子可以承载打乱,拿掉就真的没了。
    const manual = src.slice(end);
    expect(manual).toMatch(/\{scrambleSection\}/);
    expect(manual).toMatch(/\{cubeRow\}/);
  });
});
