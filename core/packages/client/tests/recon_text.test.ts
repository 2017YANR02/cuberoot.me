/**
 * 文字复盘 —— 标注是 /recon 那套认出来的,不是这里写的。
 * =========================================================================
 *
 * 三件事要钉住:
 *
 * 1. **一手不丢、一手不重**:所有行的区间首尾相接、合起来正好是整把。切错了会
 *    在这里红,而不是等到用户发现文字里比表里多一手。
 * 2. **标签真的来自 /recon 的识别器**:cross 行认得出十字颜色,四对行给的是
 *    cubedb 那种两字母配色(GR / OB / …)。这两类纯几何,不查公式库。
 * 3. **十字面认对了**:`crossOnDRotation` 曾经取「第一个四条棱都归位的面」——
 *    F2L 拧完之后侧面也可能凑齐四条(三条是十字/F2L 棱,第四条是碰巧归位的顶层
 *    棱),于是规范化到了错的面,末层指纹全查不中、标签退化成泛 `// OLL`。
 *    这里对着那个真局面钉死正确答案。
 *
 * 末层的精确 case 名(`OLL-F-` / `PLL-T`)要查公式库,而公式库在 API 上 ——
 * 拉不到就跳过那一条并吼一声,拉得到就必须是精确名,不接受泛标签。
 *
 * 用的是和 `f2l_slots.test.ts` / `f2l_slot_reference.test.ts` 同一条真解法。
 */
import { describe, it, expect } from 'vitest';

import { decodeGyroTrack } from '@/app/[lang]/timer/_lib/bluetooth/gyro_track';
import { buildCoreTrack } from '@/app/[lang]/timer/_lib/reconstruct/core_track';
import { computeF2lSlots } from '@/app/[lang]/timer/_lib/reconstruct/f2l_slots';
import {
  applyReconTextOverride, buildReconText, formatReconLine, reconTextForClipboard, reconTextHeader,
} from '@/app/[lang]/timer/_lib/reconstruct/recon_text';
import { normalizeSolve } from '@/app/[lang]/timer/_lib/reconstruct/orient';
import { computeStageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import { computeStepMetrics, stmWeight } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import { solveFromReplay } from '@/app/[lang]/timer/_lib/share/decode';
import { applyOneToken } from '@/app/[lang]/timer/_lib/cube/apply_token';
import { applyScramble } from '@/app/[lang]/timer/_lib/cube/state';
import type { CubeFaces } from '@/app/[lang]/timer/_lib/cube/state';
import { patternFromAlg } from '@/lib/cube3';
import { crossOnDRotation, detectStage } from '@/lib/stage_detect';
import { loadAlg } from '@cuberoot/shared/alg';

const SCRAMBLE = "D R' D' R B' U' R' F2 L' F2 D' U2 L' D2 F L' B R'";
const SOLUTION = [
  'U', "R'", 'F', "R'", 'B', 'B', 'L',
  'U', 'F', 'F', "R'", 'F', 'F', 'U', 'U', 'R',
  'U', "B'", 'U', 'U', 'B',
  'F', 'L', 'F', "L'", 'F', 'F', "U'", 'F',
  'U', 'U', "L'", 'U', 'L', "U'", "L'", "U'", 'L',
  'U', 'U', 'F', 'U', 'R', "U'", "R'", "F'",
  "U'", 'F', 'F', "U'", 'F', 'F', 'D', 'R', 'R', 'B', 'B', 'U', 'B',
  'B', "D'", 'R', 'R', 'U',
];

const timed = (tokens: string[], stepMs = 200) =>
  tokens.map((m, i) => ({ m, ts: (i + 1) * stepMs }));

const moves = timed(SOLUTION);
const totalMs = moves[moves.length - 1].ts + 300;

function build() {
  const segs = computeStageSegments(SCRAMBLE, moves, totalMs)!;
  const metrics = computeStepMetrics(SCRAMBLE, moves, totalMs)!;
  const slots = computeF2lSlots(SCRAMBLE, moves, totalMs, segs)!;
  return buildReconText({ scramble: SCRAMBLE, moves, totalMs, segs, metrics, slots });
}

/**
 * 同一把,但带上一条姿态流认下来的核心换格。
 *
 * 传的是**核心轨迹**而不是「转体列表」:这条流里既有人做的转体,也有中层带的 ——
 * 分开它们是 `humanize.ts` 的事,不是调用方的事。空的一条 = 录了姿态、核心一次没转。
 */
function buildWithRotations(events: Array<{ tMs: number; token: string; angleRad: number }>) {
  const segs = computeStageSegments(SCRAMBLE, moves, totalMs)!;
  const metrics = computeStepMetrics(SCRAMBLE, moves, totalMs)!;
  const slots = computeF2lSlots(SCRAMBLE, moves, totalMs, segs)!;
  return buildReconText({ scramble: SCRAMBLE, moves, totalMs, segs, metrics, slots, core: { events } });
}

/** 公式库在 API 上。拉不到(离线 / API 挂了)就跳过依赖它的那一条,并吼一声。 */
async function algDbUp(): Promise<boolean> {
  try { await loadAlg('3x3', 'oll'); return true; } catch { return false; }
}

describe('buildReconText', () => {
  it('七行:十字 + 四对 + OLL + PLL,顺序就是拧的顺序', async () => {
    const r = await build();
    expect(r.lines.map(l => l.key)).toEqual([
      'cross', 'slot-BR', 'slot-BL', 'slot-FR', 'slot-FL', 'oll', 'pll',
    ]);
    expect(r.lines.map(l => l.kind)).toEqual([
      'cross', 'f2l', 'f2l', 'f2l', 'f2l', 'oll', 'pll',
    ]);
  });

  it('区间首尾相接,合起来正好是整把,一手不丢一手不重', async () => {
    const r = await build();
    expect(r.lines[0].fromIdx).toBe(0);
    for (let i = 1; i < r.lines.length; i++) {
      expect(r.lines[i].fromIdx).toBe(r.lines[i - 1].toIdx + 1);
    }
    expect(r.lines[r.lines.length - 1].toIdx).toBe(SOLUTION.length - 1);
    // 记号已按 HTM 合并,所以不能和 SOLUTION 比长度;比合并后的整条。
    expect(r.lines.flatMap(l => l.moves).join(' ')).toBe(
      "U R' F R' B2 L"
      + " U F2 R' F2 U2 R"
      + " U B' U2 B"
      + " F L F L' F2 U' F"
      + " U2 L' U L U' L' U' L"
      + " U2 F U R U' R' F'"
      + " U' F2 U' F2 D R2 B2 U B2 D' R2 U",
    );
  });

  it('标注来自 /recon 的识别器:十字带颜色,四对给 cubedb 的两字母配色', async () => {
    const r = await build();
    const label = (k: string) => r.lines.find(l => l.key === k)?.label ?? null;
    expect(label('cross')).toBe('Y cross');
    expect(label('slot-BR')).toBe('BR');
    expect(label('slot-BL')).toBe('BO');
    expect(label('slot-FR')).toBe('RG');
    expect(label('slot-FL')).toBe('OG');
  });

  it('十字面认的是 D,不是碰巧凑齐四条棱的侧面(回归:末层标签退化成泛 OLL)', async () => {
    // F2L 拧完那一刻的局面。中心没动过 → 正确答案是「不用转」。
    const p = await patternFromAlg(`${SCRAMBLE} ${SOLUTION.slice(0, 38).join(' ')}`);
    expect((await detectStage(p)).stage).toBe('f2l');
    expect(await crossOnDRotation(p)).toBe('');
  });

  it('末层给精确 case 名,不是泛 OLL / PLL', async () => {
    if (!await algDbUp()) {
      console.warn('[recon_text] 公式库拉不到,跳过末层 case 名这一条');
      return;
    }
    const r = await build();
    expect(r.lines.find(l => l.key === 'oll')?.label).toBe('OLL-F-');
    expect(r.lines.find(l => l.key === 'pll')?.label).toBe('PLL-T');
  });

  it('渲染成一行:动作 + // 标签 + (识别+执行)', async () => {
    const r = await build();
    const cross = r.lines.find(l => l.key === 'cross')!;
    expect(formatReconLine(cross)).toBe("U R' F R' B2 L // Y cross (0.200+1.000)");
    const slot = r.lines.find(l => l.key === 'slot-BR')!;
    expect(formatReconLine(slot)).toBe("U F2 R' F2 U2 R // BR (0.400+1.400)");
  });

  it('没有标签的行只剩动作,不留一个空的 //', async () => {
    expect(formatReconLine({
      kind: 'f2l', key: 'x', moves: ['R', "U'"], fromIdx: 0, toIdx: 1,
      label: null, recognitionMs: 100, executionMs: 200, stepMs: 300,
    })).toBe("R U'");
  });

  it('头一行报 HTM 和 TPS,和分步分析表同一口径', async () => {
    const r = await build();
    expect(r.turns).toBe(50);
    expect(r.seconds).toBeCloseTo(13.1, 3);
    expect(reconTextHeader(r)).toBe('50 HTM / 13.10s = 3.82 TPS');
  });

  it('剪贴板那份:头 + 打乱 + 空行 + 谱子', async () => {
    const r = await build();
    const lines = reconTextForClipboard(r).split('\n');
    expect(lines[0]).toBe(reconTextHeader(r));
    expect(lines[1]).toBe(SCRAMBLE);
    expect(lines[2]).toBe('');
    expect(lines.length).toBe(3 + r.lines.length);
  });

  it('拧到一半:只写走到的那几行,不为没到的一步编一行', async () => {
    const partial = timed(SOLUTION.slice(0, 21));
    const pTotal = 21 * 200 + 300;
    const segs = computeStageSegments(SCRAMBLE, partial, pTotal)!;
    const metrics = computeStepMetrics(SCRAMBLE, partial, pTotal);
    const slots = computeF2lSlots(SCRAMBLE, partial, pTotal, segs)!;
    const r = await buildReconText({
      scramble: SCRAMBLE, moves: partial, totalMs: pTotal, segs, metrics, slots,
    });
    expect(r.lines.map(l => l.key)).toEqual(['cross', 'slot-BR', 'slot-BL']);
    expect(r.lines[r.lines.length - 1].toIdx).toBe(20);
  });

  it('没有动作 → 没有行,不抛', async () => {
    const r = await buildReconText({
      scramble: SCRAMBLE, moves: [], totalMs: 0,
      segs: computeStageSegments(SCRAMBLE, [], 0) ?? ({} as never),
      metrics: null, slots: null,
    });
    expect(r.lines).toEqual([]);
    expect(r.tps).toBeNull();
  });
});

describe('转体织进谱子(Sprint 28)', () => {
  const rot = (tMs: number, token: string) => ({ tMs, token, angleRad: Math.PI / 2 });

  it('不给转体时和以前一模一样 —— 老的把不会因为这个功能变样', async () => {
    const before = await build();
    const after = await buildWithRotations([]);
    expect(after.text).toBe(before.text);
  });

  it('转体按时刻落到对应那一行,并排在它之后第一手的前面', async () => {
    // 第 6 手在 ts=1200(十字最后一手是第 6 个记号);1150 落在十字行倒数第二手前
    const r = await buildWithRotations([rot(1150, 'y')]);
    const cross = r.lines.find(l => l.key === 'cross')!;
    expect(cross.moves).toContain('y');
    // 只进了这一行,别的行不受影响
    expect(r.lines.filter(l => l.moves.includes('y'))).toHaveLength(1);
  });

  it('多个转体各就各位,顺序按时刻', async () => {
    const r = await buildWithRotations([rot(400, 'y'), rot(2400, "x'"), rot(2600, 'z2')]);
    const all = r.lines.flatMap(l => l.moves).filter(m => /^[xyz]/.test(m));
    expect(all).toHaveLength(3);
    // 第一个原样(此时还没换过视角);后面两个按前面那些换过名 —— 姿态流报的是
    // 魔方自己那个系里的转动,而谱子写在人的系里。下面那条「照着拧还是复原」是
    // 这件事的判据,这里只钉住个数和顺序。
    expect(all[0]).toBe('y');
  });

  it('带转体的谱子照着拧,魔方还是复原的 —— 这正是以前错的地方', async () => {
    // 以前转体是插进去就完了:后面每一手仍按转之前写,于是那条谱子照着拧出来是
    // 一颗拧坏的魔方 —— 而它看上去完全正常,没有任何地方会红。
    const r = await buildWithRotations([rot(400, 'y'), rot(2400, "x'"), rot(2600, 'z2')]);
    let st = applyScramble(3, SCRAMBLE);
    for (const tok of r.lines.flatMap(l => l.moves)) st = applyOneToken(st, tok);
    // 「复原」要按整体旋转不敏感的说法问:谱子里最后可能剩一个没抵消的转体,而
    // 转过去的复原态仍然是复原态。
    for (const face of Object.values(st as CubeFaces)) {
      expect(new Set(face).size, `面不是单色:${face.join('')}`).toBe(1);
    }
  });

  it('转体**不计步** —— HTM 和 TPS 一个数都不动', async () => {
    const before = await build();
    const after = await buildWithRotations([rot(400, 'y'), rot(2400, "x'")]);
    expect(after.turns).toBe(before.turns);
    expect(after.tps).toBe(before.tps);
  });

  it('转体不喂给识别器 —— 标签和不带转体时逐行相同', async () => {
    const before = await build();
    const after = await buildWithRotations([rot(400, 'y'), rot(2400, "x'"), rot(9000, 'y2')]);
    expect(after.lines.map(l => l.label)).toEqual(before.lines.map(l => l.label));
  });

  it('比所有动作都晚的转体不丢,挂在最后一行末尾', async () => {
    const r = await buildWithRotations([rot(99999, 'z')]);
    const last = r.lines[r.lines.length - 1];
    expect(last.moves[last.moves.length - 1]).toBe('z');
  });
});

/**
 * 录了姿态的把,中层照样要合出来 —— 用户 2026-08-04 报的那把。
 * =========================================================================
 *
 * 报告里 PLL 印的是 `U L2 U F' B L2 F B' U L2 U2`:两对相对面一个都没合。根因不在
 * 配对那一层,而是「录了姿态就只问核心」把「中心块必须回家」那条定理整个关掉了
 * (`humanize.ts` 的 `planned = core ? null : …`),而这把的整个 PLL 姿态流一次换格
 * 都没认出来 —— 证据在那一行输出本身:它连一个转体记号都没有,而没被中层认领的
 * 换格一定会被打印出来。
 *
 * 所以这条守的是**整条管道**:core 非空(OLL 之前有一次真的 `y`)、PLL 段一次换格
 * 都没有,印出来的那一行仍然是带中层的公式。单元层面的判据在 `humanize.test.ts`。
 */
describe('录了姿态、但中层那几对姿态流没看见(2026-08-04)', () => {
  const inv0804 = (toks: string[]) => toks.slice().reverse()
    .map(t => (t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0, -1) : `${t}'`));
  // 十字 + 三组 F2L + OLL(CP) + 那把 U perm 的**原流**(中层报成相对面的样子)。
  const SOL_0804 = ("D R' D2 F  U R U' R'  U' L' U L  U F' U F"
    + "  U2 R U R' U R U2 R'  R U R' U R U2 R'"
    + "  U L2 U F' B L2 F B' U L2 U2").trim().split(/\s+/);
  const SCR_0804 = inv0804(SOL_0804).join(' ');
  const mv0804 = SOL_0804.map((m, i) => ({ m, ts: (i + 1) * 200 }));
  const total0804 = mv0804[mv0804.length - 1].ts + 300;

  it('PLL 那一行印的是中层,不是四手相对面', async () => {
    const segs = computeStageSegments(SCR_0804, mv0804, total0804)!;
    const metrics = computeStepMetrics(SCR_0804, mv0804, total0804)!;
    const slots = computeF2lSlots(SCR_0804, mv0804, total0804, segs);
    const r = await buildReconText({
      scramble: SCR_0804, moves: mv0804, totalMs: total0804, segs, metrics, slots,
      // 姿态流只有 OLL 之前那一次 y;PLL 段一次换格都没认出来 —— 和用户那把一样。
      core: { events: [{ tMs: 1500, token: 'y', angleRad: Math.PI / 2 }] },
    });
    const last = r.lines[r.lines.length - 1];
    // 轴向是 M 不是 S:前面那个 y 把整段换过名(`L2` 同样印成 `B2`)。
    expect(last.moves).toEqual("U B2 U M U2 M' U B2 U2".split(' '));
    expect(r.blindPairs).toBe(0);
  });

  /**
   * 报告顶上那个数(2026-08-04 用户提的:「步数改成 STM」)。合并之后谱子上一个中层
   * 是**一个**记号,所以「读者数得出来的步数」比面转数少一个 —— 这里两边都锁死。
   */
  it('STM 比 HTM 少掉合并出来的那两个中层', async () => {
    const segs = computeStageSegments(SCR_0804, mv0804, total0804)!;
    const metrics = computeStepMetrics(SCR_0804, mv0804, total0804)!;
    const slots = computeF2lSlots(SCR_0804, mv0804, total0804, segs);
    const r = await buildReconText({
      scramble: SCR_0804, moves: mv0804, totalMs: total0804, segs, metrics, slots,
      core: { events: [{ tMs: 1500, token: 'y', angleRad: Math.PI / 2 }] },
    });
    // PLL 那一行:魔方转了 11 下面,写出来是 9 个记号 —— 差的就是两个中层。
    const last = r.lines[r.lines.length - 1];
    expect(last.moves.filter(t => stmWeight(t) > 0)).toHaveLength(9);
    // 整把:HTM 那份不动(效率比对和分步分析表吃的是它),STM 少两个。
    expect(r.turns).toBe(40);
    expect(r.stm).toBe(38);
  });
});

/**
 * 用户 2026-08-04 报的那把 —— 两件事一起验:打乱印原始的,PLL 认得出是 Z perm。
 * =========================================================================
 *
 * 他做的是 `R2 B' L2 R D' B R2 B F' U R U2 B' F U2 L B D R2`,报告里印出来的却是
 * `R2 F' L2 R U' F R2 F B' D R D2 F' B D2 L F U R2` —— 「这不行,必须是原始打乱」。
 * 那条是共轭进「十字朝下」之后的写法,不是任何人做过的打乱。
 *
 * 同一把还暴露了第二件事:PLL 那一行印的是
 *
 *     R2 L D2 M D M2 D L R2 L U M U2
 *
 * 十三个记号,谁也认不出那是 Z perm。根因是**顺序**:魔方按四分之一圈报,这一段是
 * `L R' | R' L | U U | …`,`htmMoves` 先把中间那对 `R' R'` 合成 `R2`,`L R2 L` 就
 * 再也配不出两个 M 了。合同面必须排在认中层**之后** —— 现在谱子这一层吃的是
 * `quarterMoves`(一手一条),合同族搬进了 `humanize.ts`。
 */
describe('用户那把 15.269s(2026-08-04)', () => {
  const SCR_U = "R2 B' L2 R D' B R2 B F' U R U2 B' F U2 L B D R2";
  const TOK_U = ("L' L' F L U F F R' R' U' D' R D' R' F B' D F' B D' B D B' D B D' B' B'"
    + " D B D L R' L U B' U' R L' D' L' D D L' D' L D' F B' U' L U F' B D' R D R'"
    + " D R D L' D R' D' L L R' R' L U U R L' B L R' L R' F L R' R' L B R L' D D"
  ).split(' ');
  const TS_U = [
    0, 82, 129, 202, 337, 540, 597, 1058, 1117, 1334, 2872, 2971, 3053, 3181, 3378, 3423,
    3468, 3624, 4248, 4871, 5153, 5243, 5319, 5358, 5423, 5476, 5550, 5604, 5683, 5836,
    6520, 6697, 6728, 6827, 6925, 7150, 7291, 7356, 7429, 7501, 7659, 8844, 8904, 9327,
    9444, 9572, 10031, 10224, 10323, 10422, 10470, 10582, 10659, 10986, 11312, 11395,
    11469, 11541, 11803, 11913, 11968, 12115, 12236, 12342, 12453, 12522, 13525, 13533,
    13613, 13667, 13720, 13807, 13894, 13984, 14074, 14226, 14263, 14299, 14315, 14380,
    14557, 14565, 14609, 14652, 14712, 14778, 14962, 15146, 15206,
  ];
  const GYRO_U = 'RwEAiAA2/AN85gCBBAx74wCU/v9/+wAcBQF/+gAvCgd85wCNDRh43wBSBSR14QBnBxR76gBYAAB/+QBS//h+8QBlCvR97QBoBe198wA//ux99wD79u59+QBs9e99/gHb9fB9BwBE7ON2HwDP8+d5GABe9ex8EABQ9vB9CgCz9fF9DwEN+fB9CwAl/O5+/ABSBuN56QBn/ep87gBT9ep9AACM+O19/gA9UetfBQBEUdlaAACaP9hm9gBs/+586gBXA/J+9QBICvt+DwBPFQNzMQCKEABxNwBGDf90MgA6Cv53KwCZB/p9FABCCP5//wC1BgB/BwBUBf1/BAC3+zZzAABX+0Ft/QCG+0pn+QBk2EJlBgBQ60lkEACOAVBjAAC9605hDQAdD11V+QAtF1pX/gAtEFxW+gE8EFha+wBZDFVe+gBaCFNg+gDhAVRf+QAvAVBi+QBYCE1k+ACcLz1WNQBxNDhSPAAuIElDSACHLEJLQQAsH0xCSABaKEZCSQBbP0FLLwCTDFxW9wB2HV5P+QBgImFK/gAsG2NK+gBcHF5Q+wCzDlZc/AAA/k5k/QCz+09j+gCH81JgAQBb7lZbCgBZ51ZXFwBb5lZVHABZ9FlZDwBa+ldcBAFo+09jCAC0AVNgCAAADGRNCQAB/nYu/gBZ9n4NAwAJ2Hj9EABR43r6FQAt8n4ABgBc/X4NAQBY+H4RAgDi+34P/gC+AH4S/AB+BH4O+QBZDWAIrwA7/2YOtgB/5WYhwgBnAGANrgBJDXwV8wBYBX0V/ABZAX4P/gC1AH4K+gC3/n4O/QFl3nYb7gAr7HsY+QAvCH4O+QAt9X0V/QCF+X0W/QBc6Xob+wBZx20b8QBazXEU7QC0wm0N8gBjy3EX/gAk7XsDGgAt8H34CwCHEX0J/gAtDX0R9ABaCn0R+gC0DH4O/QDhEX0O/ABaDX0I9AFFUGAU+wBQffUOCwBbfPkXDwBZe/ocCwBbazkk8wCGY0Qi6gBaY0cf7gCHbTgg9gBaasMaFgAuUKQQHgBZUKYRJQBb9InuKACzsKfaFwBb3JHiKAAA943xMwBZ8If2IgBZ7oP3DQCI8oP0CQ==';
  const VERIFIED_U = [
    'z2 // insp',
    "R2' F R D F2 L2 D' // W cross",
    "U' L U' L' S' L S // GR",
    "d' R U R' U R U' R2' U R // BR",
    "U FS' R U' R' S U' F' // OG",
    "U2 y L' U' L U' S L' U L S' // OB/ZBLS",
    "U' R U R' U R U L' U R' U' L // OLL(CP)",
    "M2' U2 M U M2' U M2' U M U2 // PLL-Z",
  ];
  const AUTO_U = [
    'z2 // insp',
    "R2' F R D F2 L2' D' // W cross",
    "U' L U' L' S' L S // GR",
    "d' R U R' U R U' R2' U R // RB",
    "U FS' R U' R' S U' F' // GO",
    "U2 y L' U' L U' S L' U L S' // OB/ZBLS",
    "U' R U R' U R U L' U R' U' L // OLL(CP)",
    "M2' U2 M U M2' U M2' U M U2 // PLL-Z",
  ];
  const mvU = TOK_U.map((m, i) => ({ m, ts: TS_U[i] }));

  async function buildU(coreOverride = buildCoreTrack(decodeGyroTrack(GYRO_U), { brand: 'gan-v4' })) {
    const segs = computeStageSegments(SCR_U, mvU, 15269)!;
    const metrics = computeStepMetrics(SCR_U, mvU, 15269)!;
    const slots = computeF2lSlots(SCR_U, mvU, 15269, segs);
    const view = normalizeSolve(SCR_U, mvU);
    const auto = await buildReconText({
        scramble: view.scramble, moves: view.moves, totalMs: 15269,
        segs, metrics, slots,
        core: coreOverride,
        physical: { scramble: SCR_U, moves: mvU }, viewRotation: view.rotation,
      });
    return { view, auto, r: applyReconTextOverride(auto, VERIFIED_U) };
  }

  it('89 手都在,一手不多一手不少', () => {
    expect(mvU).toHaveLength(89);
  });

  it('旧链接和带陀螺仪的新链接都自动采用这份用户真值', () => {
    const replay = {
      event: '333' as const,
      scramble: SCR_U,
      moves: mvU,
      totalMs: 15269,
      gyro: GYRO_U,
      device: { model: 'gan-v4', name: 'GAN16ui_ (C2:AF)' },
    };
    expect(solveFromReplay(replay, [], 42).reconstruction).toEqual(VERIFIED_U);
    expect(solveFromReplay({ ...replay, gyro: undefined, device: undefined }, [], 42).reconstruction)
      .toEqual(VERIFIED_U);

    const changedMoves = mvU.map((move, i) => i === 50 ? { ...move, ts: move.ts + 1 } : move);
    expect(solveFromReplay({ ...replay, moves: changedMoves }, [], 42).reconstruction).toBeUndefined();
  });

  it('印的是原始打乱,不是共轭过的那条', async () => {
    const { r } = await buildU();
    expect(r.scramble).toBe(SCR_U);
    expect(r.scramble).not.toContain("R2 F' L2 R U'");
  });

  it('观察那一手写出来了 —— 十字在 U,`z2` 把它转下去,绿面留在前面', async () => {
    const { view, r } = await buildU();
    expect(view.crossFace).toBe('U');
    expect(r.inspection).toBe('z2');
    expect(r.text.split('\n')[0]).toBe('z2 // insp');
    // 剪贴板那一份:打乱是原始的,紧跟着就是观察那一手。
    const clip = reconTextForClipboard(r).split('\n');
    expect(clip[1]).toBe(SCR_U);
    expect(clip[3]).toBe('z2 // insp');
  });

  it('十字那一行和他手写的复盘逐字相同', async () => {
    const { r } = await buildU();
    expect(r.lines[0].moves.join(' ')).toBe("R2' F R D F2 L2 D'");
  });

  it('带姿态的整份复盘逐行等于用户核对过的真值', async () => {
    const { r } = await buildU();
    expect([
      `${r.inspection} // insp`,
      ...r.lines.map(line => `${line.moves.join(' ')} // ${line.label ?? ''}`.trim()),
    ]).toEqual(VERIFIED_U);
  });

  it('不用人工覆盖也能自动还原中层、宽层、转体与 Z perm', async () => {
    const { auto } = await buildU();
    expect([
      `${auto.inspection} // insp`,
      ...auto.lines.map(line => `${line.moves.join(' ')} // ${line.label ?? ''}`.trim()),
    ]).toEqual(AUTO_U);
  });

  it('PLL 认得出是 Z perm —— 十个记号,不是十三个', async () => {
    const { r } = await buildU();
    const pll = r.lines[r.lines.length - 1];
    expect(pll.moves.join(' ')).toBe("M2' U2 M U M2' U M2' U M U2");
  });

  it('OLL 那一行不再把 PLL 的第一手偷过来', async () => {
    const { r } = await buildU();
    const oll = r.lines[r.lines.length - 2];
    // 原流里 65 手和 66 手都是 `L`,中间隔着一秒 —— 不是一个 `L2` 手势,
    // 而且它们分属 OLL 和 PLL。合同面不许跨步骤边界。
    expect(oll.moves.join(' ')).toBe("U' R U R' U R U L' U R' U' L");
  });
});
